'use client';

/**
 * Cards for the agent's compute and model steps: Python runs in the chat's
 * workspace (code, logs, figures, tables), protein context from UniProt and
 * AlphaFold DB, and AlphaGenome variant effect predictions.
 */

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { StepError } from './agent-activity';
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CodeIcon,
  DownloadIcon,
  HardDriveIcon,
  TerminalIcon,
} from 'lucide-react';

export const WORKFLOW_TOOLS = [
  'runPython',
  'proteinStructure',
  'predictVariantEffect',
] as const;
export type WorkflowToolName = (typeof WORKFLOW_TOOLS)[number];

interface WorkflowResultProps {
  toolName: WorkflowToolName;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

const RUNNING: Record<
  WorkflowToolName,
  (input?: Record<string, unknown>) => string
> = {
  runPython: (input) =>
    `Running ${input?.title ? `“${input.title}”` : 'Python'} in the sandbox…`,
  proteinStructure: (input) =>
    `Looking up ${input?.gene ?? 'the protein'} in UniProt and AlphaFold DB…`,
  predictVariantEffect: () =>
    'AlphaGenome is scoring the variant across tissues and modalities…',
};

export function WorkflowResult({
  toolName,
  state,
  input,
  output,
  errorText,
}: WorkflowResultProps) {
  if (state === 'output-error') {
    return (
      <StepError
        label={
          toolName === 'runPython'
            ? String(input?.title ?? 'Python step')
            : RUNNING[toolName](input).replace(/…$/, '')
        }
        errorText={errorText}
      />
    );
  }
  if (state !== 'output-available' || !output) {
    if (toolName === 'runPython' && typeof input?.code === 'string') {
      return <PythonStep input={input} running />;
    }
    return (
      <Shimmer as="p" className="p-2 text-sm">
        {RUNNING[toolName](input)}
      </Shimmer>
    );
  }
  if (toolName === 'runPython') {
    return <PythonStep input={input} run={output as PythonRun} />;
  }
  if (toolName === 'proteinStructure') {
    return <ProteinCard protein={output as ProteinContext} />;
  }
  return <AlphaGenomeCard result={output as AlphaGenomeResult} />;
}

interface OutputFile {
  name: string;
  url: string | null;
  mediaType: string;
  size: number;
}

interface PythonRun {
  title: string;
  step: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  files: OutputFile[];
  durationMs: number;
}

const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

function Section({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: typeof CodeIcon;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]/section:rotate-90" />
        <Icon className="size-3.5" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function PythonStep({
  input,
  run,
  running = false,
}: {
  input?: Record<string, unknown>;
  run?: PythonRun;
  running?: boolean;
}) {
  const code = String(input?.code ?? '');
  const failed = run ? run.exitCode !== 0 : false;
  const figures =
    run?.files.filter(
      (f): f is OutputFile & { url: string } =>
        Boolean(f.url) && f.mediaType.startsWith('image/'),
    ) ?? [];
  const tables =
    run?.files.filter((f) => !f.url || !f.mediaType.startsWith('image/')) ?? [];
  const log = [run?.stdout, run?.stderr].filter(Boolean).join('\n');

  return (
    <div className="w-full space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <TerminalIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">
          {run ? `Step ${run.step} · ` : ''}
          {String(input?.title ?? 'Python')}
        </span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1 text-xs',
            failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {running ? (
            <Shimmer as="span">Running in sandbox</Shimmer>
          ) : failed ? (
            <>
              <CircleAlertIcon className="size-3.5" /> exit {run?.exitCode}
            </>
          ) : (
            <>
              <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {((run?.durationMs ?? 0) / 1000).toFixed(1)} s
            </>
          )}
        </span>
      </div>

      {figures.length > 0 && (
        <div
          className={cn('grid gap-2', figures.length > 1 && 'sm:grid-cols-2')}
        >
          {figures.map((figure) => (
            <a
              key={figure.url}
              href={figure.url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-lg border bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- figures are run outputs on Blob */}
              <img
                src={figure.url}
                alt={figure.name}
                className="w-full object-contain"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {tables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tables.map((file) =>
            file.url ? (
              <a
                key={file.name}
                href={file.url}
                download={file.name}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
              >
                <DownloadIcon className="size-3" />
                {file.name}
                <span className="text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </a>
            ) : (
              <span
                key={file.name}
                title="Kept in the chat's workspace for later steps"
                className="flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
              >
                <HardDriveIcon className="size-3" />
                {file.name}
                <span>{formatBytes(file.size)} · in workspace</span>
              </span>
            ),
          )}
        </div>
      )}

      {code && (
        // Remounts when the run finishes, so the code shown while it runs
        // folds away once figures and logs arrive.
        <Section
          key={running ? 'running' : 'done'}
          icon={CodeIcon}
          label="Code"
          defaultOpen={running}
        >
          <CodeBlock code={code} language="python">
            <CodeBlockHeader>
              <CodeBlockTitle>
                <CodeBlockFilename>
                  {run
                    ? `steps/${String(run.step).padStart(2, '0')}.py`
                    : 'step.py'}
                </CodeBlockFilename>
              </CodeBlockTitle>
              <CodeBlockActions>
                <CodeBlockCopyButton />
              </CodeBlockActions>
            </CodeBlockHeader>
          </CodeBlock>
        </Section>
      )}

      {log && (
        <Section icon={TerminalIcon} label="Output" defaultOpen={failed}>
          <pre className="max-h-72 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {log}
          </pre>
        </Section>
      )}
    </div>
  );
}

interface ProteinFeature {
  type: string;
  description: string;
  start: number;
  end: number;
}

interface ProteinContext {
  gene: string;
  accession: string;
  protein: string;
  length?: number;
  function?: string;
  residue?: number;
  residueFeatures: ProteinFeature[];
  domains: ProteinFeature[];
  structure: {
    modelId: string;
    meanPlddt: number;
    fractionConfident: number;
    url: string;
  } | null;
  uniprotUrl: string;
}

function plddtLabel(plddt: number) {
  if (plddt >= 90) return 'very high';
  if (plddt >= 70) return 'confident';
  if (plddt >= 50) return 'low';
  return 'very low';
}

function ProteinCard({ protein }: { protein: ProteinContext }) {
  return (
    <div className="w-full space-y-3 rounded-xl border bg-card p-3 text-sm">
      <div>
        <div className="font-medium">
          {protein.gene} · {protein.protein}
        </div>
        <div className="text-xs text-muted-foreground">
          <a
            href={protein.uniprotUrl}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            UniProt {protein.accession}
          </a>
          {protein.length ? ` · ${protein.length} aa` : ''}
          {protein.structure && (
            <>
              {' · '}
              <a
                href={protein.structure.url}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                AlphaFold mean pLDDT {protein.structure.meanPlddt.toFixed(1)} (
                {plddtLabel(protein.structure.meanPlddt)})
              </a>
            </>
          )}
        </div>
      </div>

      {protein.residue !== undefined && (
        <div className="rounded-lg bg-muted/50 p-2">
          <div className="text-xs font-medium">Residue {protein.residue}</div>
          {protein.residueFeatures.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              Outside annotated domains and functional sites.
            </div>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {protein.residueFeatures.map((f) => (
                <li
                  key={`${f.type}-${f.start}-${f.end}`}
                  className="rounded-full border bg-background px-2 py-0.5 text-xs"
                >
                  {f.type}
                  {f.description ? `: ${f.description}` : ''} ({f.start}–{f.end}
                  )
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {protein.domains.length > 0 && protein.length && (
        <div className="space-y-1">
          <div className="relative h-3 rounded-full bg-muted">
            {protein.domains.map((d) => (
              <div
                key={`${d.start}-${d.end}`}
                title={`${d.description} (${d.start}–${d.end})`}
                className="absolute top-0 h-3 rounded-full bg-primary/50"
                style={{
                  left: `${(d.start / protein.length!) * 100}%`,
                  width: `${Math.max(((d.end - d.start) / protein.length!) * 100, 0.6)}%`,
                }}
              />
            ))}
            {protein.residue !== undefined && (
              <div
                className="absolute -top-1 h-5 w-0.5 bg-destructive"
                style={{ left: `${(protein.residue / protein.length) * 100}%` }}
              />
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Domains: {protein.domains.map((d) => d.description).join(' · ')}
          </div>
        </div>
      )}

      {protein.function && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {protein.function}
        </p>
      )}
    </div>
  );
}

interface AlphaGenomeResult {
  variant: string;
  score: string;
  outputs: {
    output: string;
    tracks: number;
    maxMagnitude: number;
    top: Record<string, string | number | null>[];
  }[];
  files: OutputFile[];
}

function AlphaGenomeCard({ result }: { result: AlphaGenomeResult }) {
  return (
    <div className="w-full space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="font-medium">AlphaGenome · {result.variant}</div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="text-left">
            <th className="py-1 font-normal">Modality</th>
            <th className="py-1 font-normal">Strongest effect</th>
            <th className="py-1 text-right font-normal">|{result.score}|</th>
          </tr>
        </thead>
        <tbody>
          {result.outputs.map((o) => {
            const top = o.top[0] ?? {};
            return (
              <tr key={o.output} className="border-t">
                <td className="py-1.5">{o.output.replaceAll('_', ' ')}</td>
                <td className="py-1.5 text-muted-foreground">
                  {[top.gene_name, top.biosample_name ?? top.track_name]
                    .filter(Boolean)
                    .join(' · ')}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {o.maxMagnitude.toFixed(3)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.files[0]?.url && (
        <a
          href={result.files[0].url}
          download
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <DownloadIcon className="size-3" /> All tracks (CSV)
        </a>
      )}
    </div>
  );
}
