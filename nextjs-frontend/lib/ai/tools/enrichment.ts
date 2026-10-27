/**
 * Functional enrichment with g:Profiler g:GOSt (ELIXIR): one request tests a
 * gene list against GO (BP, MF, CC), Reactome, KEGG and WikiPathways, with
 * g:SCS multiple-testing correction. It answers in about a second, where
 * PANTHER's API often takes minutes.
 */

import { tool } from 'ai';
import { z } from 'zod';

const GPROFILER = 'https://biit.cs.ut.ee/gprofiler/api/gost/profile/';
const SOURCES = ['GO:BP', 'GO:MF', 'GO:CC', 'REAC', 'KEGG', 'WP'] as const;
const ORGANISMS = { human: 'hsapiens', mouse: 'mmusculus', rat: 'rnorvegicus' };

interface GostTerm {
  source: string;
  native: string;
  name: string;
  p_value: number;
  term_size: number;
  intersection_size: number;
  intersections: string[][];
}

export const enrichGenesTool = tool({
  description: `Functional enrichment of a gene list with g:Profiler: GO biological process, molecular function and cellular component, Reactome, KEGG and WikiPathways, corrected for multiple testing (g:SCS). Use it for marker genes, differentially expressed genes or any candidate gene set.`,
  inputSchema: z.object({
    genes: z.array(z.string()).min(2).describe('Gene symbols'),
    organism: z.enum(['human', 'mouse', 'rat']).default('human'),
    sources: z
      .array(z.enum(SOURCES))
      .default([...SOURCES])
      .describe('Databases to test'),
    background: z
      .array(z.string())
      .optional()
      .describe(
        'Expressed genes to use as the statistical background, when known',
      ),
  }),
  execute: async ({ genes, organism, sources, background }) => {
    const started = Date.now();
    const response = await fetch(GPROFILER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organism: ORGANISMS[organism],
        query: genes,
        sources,
        user_threshold: 0.05,
        significance_threshold_method: 'g_SCS',
        no_evidences: false,
        ...(background?.length ? { domain_scope: 'custom', background } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      throw new Error(`g:Profiler returned ${response.status}`);
    }
    const data = (await response.json()) as {
      result: GostTerm[];
      meta: { version: string; genes_metadata?: { failed?: string[] } };
    };

    const terms = [...data.result].sort((a, b) => a.p_value - b.p_value);
    return {
      query: genes.length,
      unrecognized: data.meta.genes_metadata?.failed ?? [],
      significant: terms.length,
      terms: terms.slice(0, 25).map((t) => ({
        source: t.source,
        id: t.native,
        name: t.name,
        adjustedP: t.p_value,
        overlap: `${t.intersection_size}/${t.term_size}`,
        genes: genes.filter((_, i) => t.intersections[i]?.length),
      })),
      database: `g:Profiler ${data.meta.version}`,
      elapsedMs: Date.now() - started,
    };
  },
});
