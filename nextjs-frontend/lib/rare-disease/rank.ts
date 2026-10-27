/**
 * Phenotype-driven diagnosis ranking and variant prioritization.
 *
 * Diseases are ranked locally by HPO semantic similarity (see hpo-engine.ts).
 * Each gene's phenotype score is the best normalized score of a disease it
 * causes. Variants get a deleteriousness score from consequence, AlphaMissense,
 * CADD, gnomAD frequency and ClinVar, and the final rank is the geometric mean
 * of the two, in the spirit of Exomiser. Every number is traceable to its source.
 */

import { annotateWithVep, type VepResult, type VepTranscript } from './clients';
import {
  type EngineDisease,
  type EngineTerm,
  getHpoEngine,
  type SimilarityMode,
} from './hpo-engine';

export interface PhenotypeInput {
  label: string;
  hpoId?: string;
}

export interface RankedDisease {
  rank: number;
  id: string;
  name: string;
  score: number;
  genes: string[];
  url: string;
}

export interface GeneCandidate {
  symbol: string;
  phenotypeScore: number;
  diseases: string[];
}

export interface DiagnosisRanking {
  phenotypes: EngineTerm[];
  unresolved: string[];
  diseases: RankedDisease[];
  genes: GeneCandidate[];
  hpoVersion: string;
  elapsedMs: number;
}

// Every disease contributes its genes; ranking all of them takes ~50 ms.
const DISEASES_FOR_GENES = Number.POSITIVE_INFINITY;

function diseaseUrl(id: string): string {
  const [prefix, accession] = id.split(':');
  if (prefix === 'OMIM') return `https://omim.org/entry/${accession}`;
  if (prefix === 'ORPHA') {
    return `https://www.orpha.net/en/disease/detail/${accession}`;
  }
  return `https://monarchinitiative.org/${id}`;
}

/** Maps each finding to a live HPO term by ID, exact label or synonym, then text search. */
export function resolvePhenotypes(phenotypes: PhenotypeInput[]): {
  terms: EngineTerm[];
  unresolved: string[];
} {
  const engine = getHpoEngine();
  const terms = new Map<string, EngineTerm>();
  const unresolved: string[] = [];
  for (const p of phenotypes) {
    const term = engine.resolve(p.hpoId, p.label);
    if (term) terms.set(term.id, term);
    else unresolved.push(p.label);
  }
  return { terms: [...terms.values()], unresolved };
}

export async function rankDiagnoses(
  phenotypes: PhenotypeInput[],
  limit = 10,
  mode?: SimilarityMode,
): Promise<DiagnosisRanking> {
  const started = performance.now();
  const engine = getHpoEngine();
  const { terms, unresolved } = resolvePhenotypes(phenotypes);
  const matches = engine.rankDiseases(
    terms.map((t) => t.id),
    DISEASES_FOR_GENES,
    mode,
  );
  const topScore = matches[0]?.score || 1;

  const genes = new Map<string, GeneCandidate>();
  for (const match of matches) {
    for (const symbol of match.genes) {
      const gene = genes.get(symbol) ?? {
        symbol,
        phenotypeScore: 0,
        diseases: [],
      };
      gene.phenotypeScore = Math.max(
        gene.phenotypeScore,
        round(match.score / topScore),
      );
      gene.diseases.push(match.name);
      genes.set(symbol, gene);
    }
  }

  return {
    phenotypes: terms,
    unresolved,
    diseases: mergeSameDisease(matches, limit).map((m, i) => ({
      rank: i + 1,
      id: m.id,
      name: m.name,
      score: m.score,
      genes: m.genes,
      url: diseaseUrl(m.id),
    })),
    genes: [...genes.values()].sort(
      (a, b) => b.phenotypeScore - a.phenotypeScore,
    ),
    hpoVersion: engine.version,
    elapsedMs: Math.round(performance.now() - started),
  };
}

// Variants

const LOSS_OF_FUNCTION = new Set([
  'transcript_ablation',
  'splice_acceptor_variant',
  'splice_donor_variant',
  'stop_gained',
  'frameshift_variant',
  'start_lost',
]);
const MODERATE = new Set([
  'inframe_insertion',
  'inframe_deletion',
  'stop_lost',
  'protein_altering_variant',
]);
const SPLICE_REGION = new Set([
  'splice_region_variant',
  'splice_donor_5th_base_variant',
  'splice_donor_region_variant',
  'splice_polypyrimidine_tract_variant',
]);

export interface VariantCandidate {
  rank: number;
  input: string;
  gene: string | null;
  consequence: string | null;
  hgvsc: string | null;
  hgvsp: string | null;
  gnomadAf: number | null;
  clinvar: string[];
  alphaMissense: { score: number; class: string } | null;
  cadd: number | null;
  variantScore: number;
  phenotypeScore: number | null;
  combinedScore: number;
  reasons: string[];
}

export interface VariantPrioritization {
  variants: VariantCandidate[];
  notAnnotated: string[];
  elapsedMs: number;
}

function pickTranscript(result: VepResult): VepTranscript | undefined {
  const transcripts = result.transcript_consequences ?? [];
  return (
    transcripts.find((t) => t.mane_select) ??
    transcripts.find((t) => t.canonical) ??
    transcripts[0]
  );
}

function maxGnomadAf(result: VepResult): number | null {
  let max: number | null = null;
  for (const colocated of result.colocated_variants ?? []) {
    for (const byAllele of Object.values(colocated.frequencies ?? {})) {
      for (const [key, value] of Object.entries(byAllele)) {
        if ((key === 'gnomade' || key === 'gnomadg') && value > (max ?? -1)) {
          max = value;
        }
      }
    }
  }
  return max;
}

function clinvarSignificance(result: VepResult): string[] {
  const significance = new Set<string>();
  for (const colocated of result.colocated_variants ?? []) {
    if (!colocated.id?.startsWith('rs')) continue;
    for (const s of colocated.clin_sig ?? []) significance.add(s);
  }
  return [...significance];
}

function scoreVariant(
  consequence: string | null,
  transcript: VepTranscript | undefined,
  af: number | null,
  clinvar: string[],
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0.1;

  if (consequence && LOSS_OF_FUNCTION.has(consequence)) {
    score = 1;
    reasons.push(`predicted loss of function (${consequence})`);
  } else if (consequence === 'missense_variant') {
    const am = transcript?.alphamissense;
    if (am) {
      score = am.am_pathogenicity;
      reasons.push(
        `AlphaMissense ${am.am_pathogenicity.toFixed(3)} (${am.am_class.replace('_', ' ')})`,
      );
    } else if (transcript?.cadd_phred != null) {
      score = Math.min(transcript.cadd_phred / 35, 1);
      reasons.push(`CADD ${transcript.cadd_phred}`);
    } else {
      score = 0.5;
    }
  } else if (consequence && MODERATE.has(consequence)) {
    score = 0.7;
    reasons.push(consequence.replaceAll('_', ' '));
  } else if (consequence && SPLICE_REGION.has(consequence)) {
    score = Math.max(0.4, Math.min((transcript?.cadd_phred ?? 0) / 35, 0.8));
    reasons.push(
      `splice region${transcript?.cadd_phred != null ? `, CADD ${transcript.cadd_phred}` : ''}`,
    );
  }

  // ClinVar counts only when its assertions agree; mixed calls are conflicting.
  const saysPathogenic = clinvar.some(
    (s) => /(^|_)pathogenic/.test(s) && !s.includes('conflicting'),
  );
  const saysBenign = clinvar.some((s) => /benign/.test(s));
  const pathogenic = saysPathogenic && !saysBenign;
  if (pathogenic) {
    score = Math.max(score, 0.95);
    reasons.push(`ClinVar: ${clinvar.join(', ')}`);
  } else if (saysBenign && !saysPathogenic) {
    score *= 0.1;
    reasons.push(`ClinVar: ${clinvar.join(', ')}`);
  } else if (saysPathogenic) {
    reasons.push(`ClinVar conflicting: ${clinvar.join(', ')}`);
  }

  // Frequency is applied last: a common variant cannot cause a rare disease
  // (ACMG BA1 uses AF > 5%). Below 1%, known pathogenic recessive alleles keep their score.
  if (af == null || af < 1e-4) {
    reasons.push(
      af == null
        ? 'absent from gnomAD'
        : `rare in gnomAD (AF ${af.toExponential(1)})`,
    );
  } else if (af < 1e-3) {
    if (!pathogenic) score *= 0.8;
    reasons.push(`low-frequency in gnomAD (AF ${af.toExponential(1)})`);
  } else if (af < 0.01) {
    if (!pathogenic) score *= 0.5;
    reasons.push(`uncommon in gnomAD (AF ${af.toFixed(4)})`);
  } else if (af < 0.05) {
    score *= 0.2;
    reasons.push(`common in gnomAD (AF ${af.toFixed(3)})`);
  } else {
    score *= 0.02;
    reasons.push(
      `very common in gnomAD (AF ${af.toFixed(3)}), cannot cause a rare disease`,
    );
  }

  return { score: round(score), reasons };
}

export async function prioritizeVariants(
  inputs: string[],
  phenotypeGenes?: GeneCandidate[] | Promise<GeneCandidate[]>,
): Promise<VariantPrioritization> {
  const started = Date.now();
  const unique = [...new Set(inputs.map((v) => v.trim()).filter(Boolean))];
  // VEP is the slow call; it runs while the phenotype ranking resolves.
  const [annotated, genes] = await Promise.all([
    annotateWithVep(unique),
    phenotypeGenes,
  ]);
  const geneScores = new Map(
    (genes ?? []).map((g) => [g.symbol, g.phenotypeScore]),
  );

  const candidates: Omit<VariantCandidate, 'rank'>[] = [];
  for (const [input, result] of annotated) {
    const transcript = pickTranscript(result);
    const consequence =
      transcript?.consequence_terms?.[0] ??
      result.most_severe_consequence ??
      null;
    const af = maxGnomadAf(result);
    const clinvar = clinvarSignificance(result);
    const { score, reasons } = scoreVariant(
      consequence,
      transcript,
      af,
      clinvar,
    );
    const gene = transcript?.gene_symbol ?? null;

    let phenotypeScore: number | null = null;
    let combined = score;
    if (genes) {
      phenotypeScore = gene ? (geneScores.get(gene) ?? 0) : 0;
      if (phenotypeScore > 0) {
        reasons.push(
          `${gene} explains the phenotype (score ${phenotypeScore.toFixed(2)})`,
        );
      } else {
        reasons.push(`${gene ?? 'gene'} not linked to the patient's phenotype`);
      }
      // A floor keeps a strong variant visible when its gene has no known disease link.
      combined = Math.sqrt(score * Math.max(phenotypeScore, 0.05));
    }

    candidates.push({
      input,
      gene,
      consequence,
      hgvsc: transcript?.hgvsc ?? null,
      hgvsp: transcript?.hgvsp ?? null,
      gnomadAf: af,
      clinvar,
      alphaMissense: transcript?.alphamissense
        ? {
            score: transcript.alphamissense.am_pathogenicity,
            class: transcript.alphamissense.am_class,
          }
        : null,
      cadd: transcript?.cadd_phred ?? null,
      variantScore: score,
      phenotypeScore,
      combinedScore: round(combined),
      reasons,
    });
  }

  candidates.sort((a, b) => b.combinedScore - a.combinedScore);
  return {
    variants: candidates.map((c, i) => ({ rank: i + 1, ...c })),
    notAnnotated: unique.filter((v) => !annotated.has(v)),
    elapsedMs: Date.now() - started,
  };
}

/** OMIM and Orphanet often list the same disease; show it once with both genes. */
function mergeSameDisease(matches: EngineDisease[], limit: number) {
  const merged = new Map<string, EngineDisease>();
  for (const match of matches) {
    const key = match.name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.genes = [...new Set([...existing.genes, ...match.genes])];
    } else if (merged.size < limit) {
      merged.set(key, { ...match, genes: [...match.genes] });
    }
  }
  return [...merged.values()];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
