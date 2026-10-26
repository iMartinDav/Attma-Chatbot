/**
 * Benchmarks the rare-disease tools on solved cases from phenopacket-store.
 *
 * 1. Phenotype -> gene: rank of the causal gene from the observed HPO terms,
 *    for each similarity mode of the local engine.
 * 2. Variant prioritization: rank of the causal variant among 19 decoys, which
 *    are causal variants from other patients (so pathogenicity alone cannot
 *    separate them), with and without phenotypes.
 *
 * Usage:
 *   bun scripts/rare-disease-eval/run.ts                     # test set, writes results.json
 *   bun scripts/rare-disease-eval/run.ts cases-tune.json     # tuning set, phenotype modes only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { annotateWithVep } from '@/lib/rare-disease/clients';
import type { SimilarityMode } from '@/lib/rare-disease/hpo-engine';
import {
  type DiagnosisRanking,
  prioritizeVariants,
  rankDiagnoses,
} from '@/lib/rare-disease/rank';

interface Case {
  id: string;
  gene: string;
  disease: { id: string; label: string };
  hpo: { id: string; label: string }[];
  variants: string[];
}

const DIR = join(process.cwd(), 'scripts/rare-disease-eval');
const DECOYS = 19;
const MODES: SimilarityMode[] = ['patient', 'symmetric'];
const DEFAULT_MODE: SimilarityMode = 'patient';
const HELD_OUT = Boolean(process.env.HPO_INDEX_PATH);

const casesFile = process.argv[2] ?? 'cases.json';
const isTestSet = casesFile === 'cases.json';
const benchmark = JSON.parse(readFileSync(join(DIR, casesFile), 'utf8'));
const cases: Case[] = benchmark.cases;

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/**
 * Expected 1-based rank of the target under random tie-breaking: ties neither
 * flatter nor penalize, which keeps the method and its baselines comparable.
 */
function rankOf<T>(
  items: T[],
  isTarget: (t: T) => boolean,
  score: (t: T) => number,
) {
  const target = items.filter(isTarget).map(score);
  if (target.length === 0) return null;
  const best = Math.max(...target);
  const others = items.filter((t) => !isTarget(t));
  const higher = others.filter((t) => score(t) > best).length;
  const tied = others.filter((t) => score(t) === best).length;
  return 1 + higher + tied / 2;
}

function summarize(ranks: (number | null)[], cutoffs: number[]) {
  const n = ranks.length;
  const pct = (k: number) =>
    (100 * ranks.filter((r) => r != null && r <= k).length) / n;
  const mrr = ranks.reduce<number>((sum, r) => sum + (r ? 1 / r : 0), 0) / n;
  return {
    n,
    ...Object.fromEntries(
      cutoffs.map((k) => [`top${k}`, Number(pct(k).toFixed(1))]),
    ),
    mrr: Number(mrr.toFixed(3)),
    notRanked: ranks.filter((r) => r == null).length,
  };
}

const phenotypes = (c: Case) =>
  c.hpo.map((h) => ({ label: h.label, hpoId: h.id }));

console.log(`${cases.length} cases from ${casesFile}`);
const phenotypeToGene: Record<string, ReturnType<typeof summarize>> = {};
const rankingsByMode = new Map<SimilarityMode, DiagnosisRanking[]>();
const timings: number[] = [];
for (const mode of MODES) {
  const rankings: DiagnosisRanking[] = [];
  for (const c of cases) {
    const ranking = await rankDiagnoses(phenotypes(c), 10, mode);
    timings.push(ranking.elapsedMs);
    rankings.push(ranking);
  }
  rankingsByMode.set(mode, rankings);
  phenotypeToGene[mode] = summarize(
    rankings.map((r, i) =>
      rankOf(
        r.genes,
        (g) => g.symbol === cases[i].gene,
        (g) => g.phenotypeScore,
      ),
    ),
    [1, 3, 5, 10],
  );
  console.log(mode, JSON.stringify(phenotypeToGene[mode]));
}
timings.sort((a, b) => a - b);

if (!isTestSet) process.exit(0);

console.log('Annotating the variant pool with VEP');
const pool = [...new Set(cases.flatMap((c) => c.variants))];
let started = Date.now();
const annotated = await annotateWithVep(pool);
const vepSeconds = (Date.now() - started) / 1000;
console.log(
  `  ${annotated.size}/${pool.length} annotated in ${vepSeconds.toFixed(0)} s`,
);

const random = seededRandom(2026);
const rankings = rankingsByMode.get(DEFAULT_MODE) ?? [];
const variantRuns: {
  annotated: boolean;
  combined: number | null;
  variantOnly: number | null;
}[] = [];
started = Date.now();
for (const [i, c] of cases.entries()) {
  const others = cases
    .filter((o) => o.gene !== c.gene)
    .flatMap((o) => o.variants);
  const decoys = new Set<string>();
  while (decoys.size < DECOYS && decoys.size < others.length) {
    decoys.add(others[Math.floor(random() * others.length)]);
  }
  const candidates = [...c.variants, ...decoys];
  const isCausal = (v: { input: string }) => c.variants.includes(v.input);
  const [withPhenotype, variantOnly] = await Promise.all([
    prioritizeVariants(candidates, rankings[i].genes),
    prioritizeVariants(candidates),
  ]);
  variantRuns.push({
    annotated: withPhenotype.variants.some(isCausal),
    combined: rankOf(withPhenotype.variants, isCausal, (v) => v.combinedScore),
    variantOnly: rankOf(variantOnly.variants, isCausal, (v) => v.variantScore),
  });
}
const prioritizationSeconds = (Date.now() - started) / 1000;

const report = {
  date: new Date().toISOString().slice(0, 10),
  source: benchmark.source,
  hpoVersion: rankings[0]?.hpoVersion,
  index: HELD_OUT
    ? 'held-out: annotations sourced only from benchmark case publications removed'
    : 'full HPO release',
  cases: cases.length,
  phenotypeToGene,
  selectedMode: DEFAULT_MODE,
  phenotypeRankingMs: {
    median: timings[Math.floor(timings.length / 2)],
    p95: timings[Math.floor(timings.length * 0.95)],
  },
  variantPrioritization: {
    candidatesPerCase: DECOYS + 1,
    variantPoolAnnotated: `${annotated.size}/${pool.length}`,
    casesWithCausalAnnotated: variantRuns.filter((r) => r.annotated).length,
    withPhenotypes: summarize(
      variantRuns.map((r) => r.combined),
      [1, 3, 5],
    ),
    variantEvidenceOnly: summarize(
      variantRuns.map((r) => r.variantOnly),
      [1, 3, 5],
    ),
    vepSeconds: Math.round(vepSeconds),
    prioritizationSeconds: Number(prioritizationSeconds.toFixed(1)),
  },
  perCase: cases.map((c, i) => ({
    id: c.id,
    gene: c.gene,
    disease: c.disease.label,
    hpoTerms: c.hpo.length,
    geneRank: rankOf(
      rankings[i].genes,
      (g) => g.symbol === c.gene,
      (g) => g.phenotypeScore,
    ),
    variantRank: variantRuns[i].combined,
    variantOnlyRank: variantRuns[i].variantOnly,
  })),
};

writeFileSync(
  join(DIR, HELD_OUT ? 'results-held-out.json' : 'results.json'),
  `${JSON.stringify(report, null, 1)}\n`,
);
console.log(JSON.stringify({ ...report, perCase: undefined }, null, 2));
