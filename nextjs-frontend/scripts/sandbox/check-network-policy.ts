/**
 * Live check for the sandbox network allow-list. Run deliberately:
 *   bun --env-file=.env.local scripts/sandbox/check-network-policy.ts
 * Creates one sandbox, tries an allowed and a blocked host, then stops it.
 */
import { Sandbox } from '@vercel/sandbox';

import {
  blobStoreHost,
  sandboxAllowedHosts,
} from '@/lib/sandbox/network-policy';

const snapshotId = process.env.ATTMA_SANDBOX_SNAPSHOT;
if (!snapshotId) throw new Error('ATTMA_SANDBOX_SNAPSHOT is not set.');

const sandbox = await Sandbox.getOrCreate({
  name: `attma-policy-check-${Date.now()}`,
  source: { type: 'snapshot', snapshotId },
  resources: { vcpus: 1 },
  timeout: 120_000,
  networkPolicy: { allow: sandboxAllowedHosts() },
});

try {
  const allowed = await sandbox.runCommand({
    cmd: 'python3',
    args: [
      '-c',
      "import urllib.request; print(urllib.request.urlopen('https://rest.ensembl.org/info/ping?content-type=application/json', timeout=20).status)",
    ],
  });
  console.log('allowed rest.ensembl.org exit:', allowed.exitCode);
  console.log('allowed stdout:', (await allowed.stdout()).slice(0, 200));

  const blocked = await sandbox.runCommand({
    cmd: 'python3',
    args: [
      '-c',
      "import urllib.request; print(urllib.request.urlopen('https://example.com', timeout=20).status)",
    ],
  });
  console.log('blocked example.com exit:', blocked.exitCode);
  console.log('blocked stderr tail:', (await blocked.stderr()).slice(-300));

  // Any HTTP status proves a host is reachable; only a connection error means it is blocked.
  const reachable = async (host: string) => {
    const probe = await sandbox.runCommand({
      cmd: 'python3',
      args: [
        '-c',
        [
          'import urllib.request, urllib.error',
          'try:',
          `    print('status', urllib.request.urlopen('https://${host}/', timeout=20).status)`,
          'except urllib.error.HTTPError as error:',
          "    print('status', error.code)",
        ].join('\n'),
      ],
    });
    console.log(
      `allowed ${host.replace(/^[a-z0-9]+(?=\.public\.blob)/, '<store>')} exit:`,
      probe.exitCode,
      (await probe.stdout()).trim(),
    );
  };
  await reachable('gdmscience.googleapis.com');
  const ownBlobHost = blobStoreHost();
  if (ownBlobHost) await reachable(ownBlobHost);

  // The snapshot installs unpinned packages, so the dataset host is read from its own scanpy, not assumed.
  const scanpyHosts = await sandbox.runCommand({
    cmd: '/opt/attma/venv/bin/python',
    args: [
      '-c',
      [
        'import re, pathlib, scanpy',
        'root = pathlib.Path(scanpy.__file__).parent / "datasets"',
        'hosts = sorted({h for f in root.rglob("*.py") for h in re.findall(r"https://([a-z0-9.-]+)/", f.read_text())})',
        'print(scanpy.__version__, hosts)',
      ].join('\n'),
    ],
  });
  console.log(
    'snapshot scanpy dataset hosts:',
    (await scanpyHosts.stdout()).trim(),
  );
} finally {
  await sandbox.stop();
  console.log('sandbox stopped');
}
