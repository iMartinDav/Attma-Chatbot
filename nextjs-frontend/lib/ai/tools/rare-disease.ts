/**
 * @fileoverview Rare disease tools: phenotype-driven disease ranking and
 * variant prioritization. Research use; every result needs clinical review.
 */

import { prioritizeVariants, rankDiagnoses } from '@/lib/rare-disease/rank';
import { tool } from 'ai';
import { z } from 'zod';

const phenotypeSchema = z.object({
  label: z
    .string()
    .describe('Clinical finding as written, e.g. "febrile seizures"'),
  hpoId: z
    .string()
    .regex(/^HP:\d{7}$/)
    .optional()
    .describe('HPO term ID if known, e.g. HP:0002373'),
});

export const rankDiagnosesTool = tool({
  description: `Rank rare diseases and candidate genes for a patient's phenotypes.
Pass only findings the patient HAS (not negated ones), mapped to HPO terms.
Ranks all ~12,900 OMIM, Orphanet and DECIPHER diseases by HPO semantic similarity and returns the diseases ranked by phenotype similarity with each disease's causal genes.`,
  inputSchema: z.object({
    phenotypes: z.array(phenotypeSchema).min(1).max(40),
    variants: z
      .array(z.string())
      .max(200)
      .optional()
      .describe(
        "The patient's candidate variants, if any. They are annotated and ranked against these phenotypes in the same call.",
      ),
  }),
  execute: async ({ phenotypes, variants }) => {
    const ranking = rankDiagnoses(phenotypes);
    const [diagnosis, variantRanking] = await Promise.all([
      ranking,
      variants?.length
        ? prioritizeVariants(
            variants,
            ranking.then((r) => r.genes),
          )
        : undefined,
    ]);
    return {
      ...diagnosis,
      genes: diagnosis.genes.slice(0, 20),
      variantRanking: variantRanking && {
        ...variantRanking,
        variants: variantRanking.variants.slice(0, 25),
      },
    };
  },
});

export const prioritizeVariantsTool = tool({
  description: `Annotate and rank a patient's variants (HGVS like NM_001165963.4:c.4573C>T, rsIDs, or chr-pos-ref-alt on GRCh38).
Uses Ensembl VEP with gnomAD, ClinVar, AlphaMissense and CADD. When phenotypes are given, ranks variants by how well their gene explains them.`,
  inputSchema: z.object({
    variants: z.array(z.string()).min(1).max(200),
    phenotypes: z.array(phenotypeSchema).max(40).optional(),
  }),
  execute: async ({ variants, phenotypes }) => {
    const ranking = phenotypes?.length ? rankDiagnoses(phenotypes) : undefined;
    const [result, diseases] = await Promise.all([
      prioritizeVariants(
        variants,
        ranking?.then((r) => r.genes),
      ),
      ranking?.then((r) => r.diseases),
    ]);
    return {
      ...result,
      variants: result.variants.slice(0, 25),
      topDiseases: diseases?.slice(0, 5),
    };
  },
});
