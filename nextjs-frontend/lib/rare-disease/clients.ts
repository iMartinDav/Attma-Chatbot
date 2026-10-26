/**
 * Thin clients for the public services behind the rare-disease tools:
 * HPO (JAX ontology API), Monarch Initiative (phenotype similarity and
 * gene-disease associations) and Ensembl VEP (variant annotation, gnomAD,
 * ClinVar, AlphaMissense, CADD). Responses are cached in memory per instance.
 */

const HPO_API = 'https://ontology.jax.org/api/hp';
const MONARCH_API = 'https://api-v3.monarchinitiative.org/v3/api';
const VEP_API = 'https://rest.ensembl.org/vep/human';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).host} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// HPO

export interface HpoTerm {
  id: string;
  label: string;
}

export function getHpoTerm(id: string): Promise<HpoTerm | null> {
  return cached(`hpo:${id}`, async () => {
    try {
      const term = await getJson<{ id: string; name: string }>(
        `${HPO_API}/terms/${encodeURIComponent(id)}`,
      );
      return { id: term.id, label: term.name };
    } catch {
      return null;
    }
  });
}

export function searchHpoTerm(label: string): Promise<HpoTerm | null> {
  return cached(`hpo-search:${label.toLowerCase()}`, async () => {
    const result = await getJson<{ terms?: { id: string; name: string }[] }>(
      `${HPO_API}/search?q=${encodeURIComponent(label)}&limit=1`,
    );
    const term = result.terms?.[0];
    return term ? { id: term.id, label: term.name } : null;
  });
}

// Monarch

export interface DiseaseMatch {
  id: string;
  name: string;
  score: number;
}

export function matchDiseases(
  hpoIds: string[],
  limit: number,
): Promise<DiseaseMatch[]> {
  const termset = [...new Set(hpoIds)].sort();
  return cached(`semsim:${termset.join(',')}:${limit}`, async () => {
    const results = await getJson<
      { score: number; subject: { id: string; name: string } }[]
    >(`${MONARCH_API}/semsim/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termset, group: 'Human Diseases', limit }),
    });
    return results.map((r) => ({
      id: r.subject.id,
      name: r.subject.name,
      score: r.score,
    }));
  });
}

export interface CausalGene {
  diseaseId: string;
  geneId: string;
  symbol: string;
}

export function causalGenes(diseaseIds: string[]): Promise<CausalGene[]> {
  const ids = [...new Set(diseaseIds)].sort();
  return cached(`causal:${ids.join(',')}`, async () => {
    const params = new URLSearchParams({
      category: 'biolink:CausalGeneToDiseaseAssociation',
      limit: '500',
    });
    for (const id of ids) params.append('object', id);
    const result = await getJson<{
      items: { subject: string; subject_label: string; object: string }[];
    }>(`${MONARCH_API}/association?${params}`);
    return result.items.map((a) => ({
      diseaseId: a.object,
      geneId: a.subject,
      symbol: a.subject_label,
    }));
  });
}

// Ensembl VEP

export interface VepTranscript {
  gene_symbol?: string;
  canonical?: number;
  mane_select?: string;
  consequence_terms?: string[];
  hgvsc?: string;
  hgvsp?: string;
  cadd_phred?: number;
  alphamissense?: { am_pathogenicity: number; am_class: string };
}

export interface VepResult {
  input: string;
  most_severe_consequence?: string;
  transcript_consequences?: VepTranscript[];
  colocated_variants?: {
    id?: string;
    clin_sig?: string[];
    frequencies?: Record<string, Record<string, number>>;
  }[];
}

const VEP_PARAMS =
  'AlphaMissense=1&CADD=1&canonical=1&mane=1&hgvs=1&af_gnomade=1&af_gnomadg=1';

type VariantKind = 'id' | 'region' | 'hgvs';

const VCF_LIKE =
  /^(?:chr)?([0-9]{1,2}|X|Y|MT?)[-:_\s]+(\d+)[-:_\s]+([ACGTN]+)[-:_\s>/]+([ACGTN]+)$/i;

export function classifyVariant(input: string): {
  kind: VariantKind;
  query: string;
} {
  const value = input.trim();
  if (/^rs\d+$/i.test(value)) return { kind: 'id', query: value };
  const vcf = value.match(VCF_LIKE);
  if (vcf) {
    const [, chrom, pos, ref, alt] = vcf;
    return {
      kind: 'region',
      query: `${chrom.toUpperCase().replace(/^M$/, 'MT')} ${pos} . ${ref.toUpperCase()} ${alt.toUpperCase()} . . .`,
    };
  }
  return { kind: 'hgvs', query: value };
}

const VEP_BODY_KEY: Record<VariantKind, string> = {
  id: 'ids',
  region: 'variants',
  hgvs: 'hgvs_notations',
};

/** Annotates variants with VEP, one request per input kind, in parallel. */
export async function annotateWithVep(
  inputs: string[],
): Promise<Map<string, VepResult>> {
  const byKind = new Map<VariantKind, { input: string; query: string }[]>();
  for (const input of inputs) {
    const { kind, query } = classifyVariant(input);
    byKind.set(kind, [...(byKind.get(kind) ?? []), { input, query }]);
  }

  const annotated = new Map<string, VepResult>();
  await Promise.all(
    [...byKind].map(async ([kind, items]) => {
      const queries = items.map((i) => i.query);
      const results = await cached(`vep:${kind}:${queries.join('|')}`, () =>
        getJson<VepResult[]>(`${VEP_API}/${kind}?${VEP_PARAMS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [VEP_BODY_KEY[kind]]: queries }),
          signal: AbortSignal.timeout(60_000),
        }).catch(() => [] as VepResult[]),
      );
      for (const item of items) {
        const match = results.find(
          (r) => r.input === item.query || r.input === item.input,
        );
        if (match) annotated.set(item.input, match);
      }
    }),
  );
  return annotated;
}
