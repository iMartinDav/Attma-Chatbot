/**
 * Python compute for the agent: one Vercel Sandbox (Firecracker microVM) per
 * chat, started from a snapshot with the bioinformatics stack preinstalled
 * (scripts/sandbox/build-snapshot.ts). Each chat keeps its sandbox, so data
 * files, intermediate results and figures carry over from one step and one
 * message to the next, like a notebook.
 */

import 'server-only';

import { put } from '@vercel/blob';
import { Sandbox } from '@vercel/sandbox';

const WORKDIR = '/vercel/sandbox';
const PYTHON = '/opt/attma/venv/bin/python';
const SESSION_MS = 30 * 60_000;
const RUN_TIMEOUT_MS = 150_000;
const MAX_LOG_CHARS = 6_000;
const MAX_OUTPUT_FILES = 12;
// Larger outputs (usually intermediate .h5ad objects) stay in the workspace
// for later steps instead of being copied to Blob on every run.
const MAX_PUBLISHED_BYTES = 15 * 1024 * 1024;
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

const OUTPUT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  json: 'application/json',
  html: 'text/html',
  vcf: 'text/plain',
  h5ad: 'application/octet-stream',
};

export interface InputFile {
  url: string;
  name: string;
}

export interface OutputFile {
  name: string;
  /** Null when the file is too large to publish and stays in the workspace. */
  url: string | null;
  mediaType: string;
  size: number;
}

export interface PythonRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  files: OutputFile[];
  durationMs: number;
  step: number;
}

export const isPythonAvailable = () =>
  Boolean(process.env.ATTMA_SANDBOX_SNAPSHOT);

/** The chat's sandbox: resumed if it exists, otherwise created from the snapshot. */
function sandboxFor(chatId: string): Promise<Sandbox> {
  const snapshotId = process.env.ATTMA_SANDBOX_SNAPSHOT;
  if (!snapshotId) throw new Error('Python compute is not configured.');
  return Sandbox.getOrCreate({
    name: `attma-${chatId}`,
    resume: true,
    source: { type: 'snapshot', snapshotId },
    resources: { vcpus: 2 },
    timeout: SESSION_MS,
    persistent: true,
    snapshotExpiration: 7 * 24 * 60 * 60_000,
    env: { MPLBACKEND: 'Agg', PYTHONUNBUFFERED: '1' },
    tags: { app: 'attma' },
  });
}

const tail = (text: string) =>
  text.length > MAX_LOG_CHARS
    ? `…(${text.length - MAX_LOG_CHARS} characters omitted)\n${text.slice(-MAX_LOG_CHARS)}`
    : text;

/** Downloads uploaded files into data/ unless they are already there. */
async function stageInputs(sandbox: Sandbox, inputs: InputFile[]) {
  for (const input of inputs) {
    const url = new URL(input.url);
    if (!BLOB_HOST.test(url.hostname)) {
      throw new Error(`Only files uploaded to this chat can be used: ${url}`);
    }
    const name = input.name.replace(/[^\w.-]/g, '_');
    const staged = await sandbox.runCommand('bash', [
      '-c',
      `test -s "data/${name}" || curl -sSfL --max-time 120 -o "data/${name}" "${url.href}"`,
    ]);
    if (staged.exitCode !== 0) {
      throw new Error(
        `Could not download ${input.name}: ${await staged.stderr()}`,
      );
    }
  }
}

async function listOutputs(sandbox: Sandbox) {
  const listing = await sandbox.runCommand('bash', [
    '-c',
    `cd outputs && find . -maxdepth 2 -type f -printf '%T@ %s %P\\n' | sort -n`,
  ]);
  return (await listing.stdout())
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [mtime, size, ...path] = line.split(' ');
      return { mtime: Number(mtime), size: Number(size), path: path.join(' ') };
    });
}

/** Runs one analysis step and publishes the files it wrote to outputs/. */
export async function runPython({
  chatId,
  code,
  inputs = [],
  args = [],
  env,
  signal,
}: {
  chatId: string;
  code: string;
  inputs?: InputFile[];
  args?: string[];
  /** Passed to this run only, never written to disk (API keys). */
  env?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<PythonRun> {
  const started = Date.now();
  const sandbox = await sandboxFor(chatId);
  // Each step keeps the session alive a little longer, not indefinitely.
  await sandbox.extendTimeout(5 * 60_000).catch(() => {});
  await stageInputs(sandbox, inputs);

  // scanpy's save= writes plots to figures/, so that points at outputs/ and
  // they are published like any other figure. Checked on every run so
  // workspaces created before this still get it.
  const steps = await sandbox.runCommand('bash', [
    '-c',
    'mkdir -p data outputs steps && { [ -e figures ] || ln -s outputs figures; } && ls steps | wc -l',
  ]);
  const step = Number((await steps.stdout()).trim() || 0) + 1;
  const script = `steps/${String(step).padStart(2, '0')}.py`;
  await sandbox.writeFiles([{ path: script, content: Buffer.from(code) }]);

  const before = new Map(
    (await listOutputs(sandbox)).map((f) => [f.path, f.mtime]),
  );
  const timeout = AbortSignal.timeout(RUN_TIMEOUT_MS);
  const result = await sandbox.runCommand({
    cmd: PYTHON,
    args: [script, ...args],
    cwd: WORKDIR,
    env,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  const changed = (await listOutputs(sandbox))
    .filter((f) => before.get(f.path) !== f.mtime)
    .slice(-MAX_OUTPUT_FILES);
  const files = await Promise.all(
    changed.map(async (f) => {
      const extension = f.path.split('.').pop()?.toLowerCase() ?? '';
      const mediaType = OUTPUT_TYPES[extension] ?? 'application/octet-stream';
      if (f.size > MAX_PUBLISHED_BYTES) {
        return { name: f.path, url: null, mediaType, size: f.size };
      }
      const content = await sandbox.readFileToBuffer({
        path: `outputs/${f.path}`,
      });
      const blob = await put(
        `runs/${chatId}/${step}-${f.path.replace(/\//g, '_')}`,
        content ?? Buffer.alloc(0),
        { access: 'public', contentType: mediaType, addRandomSuffix: true },
      );
      return { name: f.path, url: blob.url, mediaType, size: f.size };
    }),
  );

  return {
    exitCode: result.exitCode,
    stdout: tail(await result.stdout()),
    stderr: tail(await result.stderr()),
    files,
    durationMs: Date.now() - started,
    step,
  };
}
