/**
 * Builds the Vercel Sandbox snapshot the agent's runPython tool starts from:
 * a uv-managed Python 3.12 (the image's own Python lacks the bz2 module that
 * anndata needs) with the bioinformatics stack preinstalled in /opt/attma, so
 * a run starts in under a second instead of installing packages first.
 *
 *   bun --env-file=.env.local scripts/sandbox/build-snapshot.ts [old snapshot ids]
 *
 * Put the printed id in ATTMA_SANDBOX_SNAPSHOT on Vercel and in .env.local.
 */
import { Sandbox, Snapshot } from '@vercel/sandbox';

// Snapshot ids passed as arguments are replaced builds: delete them, since
// snapshots built here never expire.
for (const id of process.argv.slice(2)) {
  await (await Snapshot.get({ snapshotId: id })).delete();
  console.log(`Deleted ${id}`);
}

const PACKAGES = [
  'numpy',
  'pandas',
  'scipy',
  'statsmodels',
  'scikit-learn',
  'matplotlib',
  'seaborn',
  'biopython',
  'pysam',
  'cyvcf2',
  'anndata',
  'scanpy',
  'leidenalg',
  'pydeseq2',
  'gseapy',
  'requests',
  'pyarrow',
  'openpyxl',
  'alphagenome',
];

const started = Date.now();
const sandbox = await Sandbox.create({
  runtime: 'python3.13',
  resources: { vcpus: 4 },
  timeout: 20 * 60_000,
});

const VENV = '/opt/attma/venv';

const run = (script: string, sudo = false) =>
  sandbox.runCommand({
    cmd: 'bash',
    args: ['-lc', script],
    sudo,
    stdout: process.stdout,
    stderr: process.stderr,
  });

await run('mkdir -p /opt/attma && chown -R $SUDO_USER /opt/attma', true);
const install = await run(
  `uv venv ${VENV} --python 3.12 && VIRTUAL_ENV=${VENV} uv pip install ${PACKAGES.join(' ')}`,
);
if (install.exitCode !== 0) {
  await sandbox.stop();
  throw new Error(`Package install failed with exit code ${install.exitCode}`);
}

const check = await sandbox.runCommand(`${VENV}/bin/python`, [
  '-c',
  'import scanpy, pysam, cyvcf2, pydeseq2, gseapy, matplotlib; print("scanpy", scanpy.__version__)',
]);
console.log(await check.stdout(), await check.stderr());
if (check.exitCode !== 0) {
  await sandbox.stop();
  throw new Error('The installed stack does not import.');
}

const snapshot = await sandbox.snapshot({ expiration: 0 });
console.log(`ATTMA_SANDBOX_SNAPSHOT=${snapshot.snapshotId}`);
console.log(`Built in ${Math.round((Date.now() - started) / 1000)} s`);
