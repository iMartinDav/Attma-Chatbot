/**
 * Ensembl VEP client for variant annotation (consequence, gnomAD, ClinVar,
 * AlphaMissense, CADD). Each variant's annotation is cached in memory per instance.
 */

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

const MAX_CONCURRENT_REQUESTS = 2;
const MAX_ATTEMPTS = 4;
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/**
 * POSTs JSON with at most two requests in flight, retrying rate limits (429),
 * server errors and timeouts with backoff that honors Retry-After.
 */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await withSlot(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        }),
      );
    } catch (error) {
      // Network failure or timeout: retry.
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return (await response.json()) as T;

    lastError = new Error(`${new URL(url).host} returned ${response.status}`);
    if (response.status !== 429 && response.status < 500) throw lastError;
    const retryAfter = Number(response.headers.get('retry-after'));
    if (attempt < MAX_ATTEMPTS) {
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const VEP_BATCH_SIZE = 50;

interface PendingVariant {
  input: string;
  query: string;
  resolve: (result: VepResult | undefined) => void;
  reject: (error: unknown) => void;
}

/**
 * Annotates variants with VEP. Each variant is cached on its own; only uncached
 * ones are sent, in batches of up to 200 per input kind, in parallel.
 */
export async function annotateWithVep(
  inputs: string[],
): Promise<Map<string, VepResult>> {
  const pending = new Map<VariantKind, PendingVariant[]>();
  const lookups = inputs.map((input) => {
    const { kind, query } = classifyVariant(input);
    const result = cached(
      `vep:${kind}:${query}`,
      () =>
        new Promise<VepResult | undefined>((resolve, reject) => {
          const batch = pending.get(kind) ?? [];
          batch.push({ input, query, resolve, reject });
          pending.set(kind, batch);
        }),
    );
    return result.then(
      (r) => [input, r] as const,
      () => [input, undefined] as const,
    );
  });

  for (const [kind, items] of pending) {
    for (let i = 0; i < items.length; i += VEP_BATCH_SIZE) {
      const batch = items.slice(i, i + VEP_BATCH_SIZE);
      postJson<VepResult[]>(`${VEP_API}/${kind}?${VEP_PARAMS}`, {
        [VEP_BODY_KEY[kind]]: batch.map((b) => b.query),
      }).then(
        (results) => {
          for (const item of batch) {
            item.resolve(
              results.find(
                (r) => r.input === item.query || r.input === item.input,
              ),
            );
          }
        },
        // A failed request is not cached, so the next call retries it.
        (error) => {
          for (const item of batch) item.reject(error);
        },
      );
    }
  }

  const annotated = new Map<string, VepResult>();
  for (const [input, result] of await Promise.all(lookups)) {
    if (result) annotated.set(input, result);
  }
  return annotated;
}
