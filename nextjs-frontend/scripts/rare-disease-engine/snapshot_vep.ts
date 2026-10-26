/**
 * Captures Ensembl VEP annotations for the benchmark and demo variants into
 * lib/rare-disease/data/vep-snapshot.json, trimmed to the fields the ranking
 * reads. Variants already in the snapshot are kept; only new ones are fetched.
 *
 * Usage: bun scripts/rare-disease-engine/snapshot_vep.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  annotateWithVep,
  classifyVariant,
  trimVepResult,
  VEP_SNAPSHOT_PATH,
} from '@/lib/rare-disease/clients';
import { DEMO_CASES } from '@/lib/rare-disease/demo-cases';

const evalDir = join(process.cwd(), 'scripts/rare-disease-eval');
const variants = new Set<string>(DEMO_CASES.flatMap((d) => d.variants));
for (const file of ['cases.json', 'cases-tune.json']) {
  const { cases } = JSON.parse(readFileSync(join(evalDir, file), 'utf8'));
  for (const c of cases as { variants: string[] }[]) {
    for (const v of c.variants) variants.add(v);
  }
}

const release = await fetch('https://rest.ensembl.org/info/software', {
  headers: { Accept: 'application/json' },
})
  .then((r) => r.json() as Promise<{ release: number }>)
  .then((r) => r.release)
  .catch(() => null);

const started = Date.now();
const annotated = await annotateWithVep([...variants]);
const entries: Record<string, unknown> = {};
for (const [input, result] of annotated) {
  const { kind, query } = classifyVariant(input);
  entries[`${kind}:${query}`] = trimVepResult(result);
}

writeFileSync(
  VEP_SNAPSHOT_PATH,
  JSON.stringify({
    source: 'Ensembl VEP REST (rest.ensembl.org)',
    ensemblRelease: release,
    captured: new Date().toISOString().slice(0, 10),
    entries: Object.fromEntries(Object.entries(entries).sort()),
  }),
);
const missing = [...variants].filter((v) => !annotated.has(v));
console.log(
  `${annotated.size}/${variants.size} variants in ${((Date.now() - started) / 1000).toFixed(0)} s` +
    (missing.length ? `; not annotated: ${missing.join(', ')}` : ''),
);
