/**
 * Compute tools: Python in the chat's sandbox, and AlphaGenome variant effect
 * prediction, which runs DeepMind's SDK in the same sandbox.
 */

import { runPython } from '@/lib/sandbox/python';
import { tool } from 'ai';
import { z } from 'zod';

const inputFile = z.object({
  url: z.string().url().describe('The attachment URL from the message'),
  name: z.string().describe('File name to save it under in data/'),
});

export const runPythonTool = (chatId: string) =>
  tool({
    description: `Run Python 3.12 in this chat's isolated workspace (a Vercel Sandbox microVM). Use it for any computation on data: parsing and filtering VCFs, statistics, differential expression, single-cell analysis, plots.
- Installed: numpy, pandas, scipy, statsmodels, scikit-learn, matplotlib, seaborn, biopython, pysam, cyvcf2, anndata, scanpy (with leidenalg), pydeseq2, gseapy, pyarrow, openpyxl, requests. Network access to public APIs and datasets is available (e.g. scanpy.datasets.pbmc3k()).
- The working directory persists across steps and messages in this chat, like a notebook whose variables do not persist: save intermediate results to files (e.g. .h5ad, .parquet) and reload them in the next step.
- Attached files: list them in inputs; they are downloaded to data/<name> before the code runs.
- Save every figure (PNG, dpi=150, tight bbox, readable labels and a title) and every result table (CSV) to outputs/; they are shown to the user, so each analysis step should leave at least one figure. scanpy's save= also lands there. Do not call plt.show().
- Print a short summary of what the step found (shapes, counts, top rows, key statistics), not whole tables.
- Each step has a 150-second limit; split long analyses into steps.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          'What this step does, in a few words, e.g. "QC and filtering"',
        ),
      code: z.string().describe('The complete Python script for this step'),
      inputs: z.array(inputFile).optional(),
    }),
    execute: async ({ title, code, inputs }, { abortSignal }) => ({
      title,
      ...(await runPython({ chatId, code, inputs, signal: abortSignal })),
    }),
  });

const ALPHAGENOME_SCRIPT = `
import json, os, sys
import pandas as pd
from alphagenome.data import genome
from alphagenome.models import dna_client, variant_scorers

spec = json.loads(sys.argv[1])
chrom = spec["chromosome"]
chrom = chrom if chrom.startswith("chr") else "chr" + chrom
variant = genome.Variant(
    chromosome=chrom,
    position=spec["position"],
    reference_bases=spec["ref"],
    alternate_bases=spec["alt"],
)
interval = variant.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)
model = dna_client.create(os.environ["ALPHAGENOME_API_KEY"])
scorers = [variant_scorers.RECOMMENDED_VARIANT_SCORERS[o] for o in spec["outputs"]]
scores = model.score_variant(interval=interval, variant=variant, variant_scorers=scorers)
df = variant_scorers.tidy_scores(scores)

name = f"{chrom}_{spec['position']}_{spec['ref']}_{spec['alt']}"
os.makedirs("outputs", exist_ok=True)
df.to_csv(f"outputs/alphagenome_{name}.csv", index=False)

score = "quantile_score" if "quantile_score" in df.columns else "raw_score"
df["magnitude"] = df[score].abs()
keep = [c for c in ["gene_name", "biosample_name", "track_name", score] if c in df.columns]
summary = []
for output, group in df.groupby("output_type"):
    top = group.nlargest(5, "magnitude")
    summary.append({
        "output": str(output),
        "tracks": int(len(group)),
        "maxMagnitude": round(float(top["magnitude"].iloc[0]), 4),
        "top": json.loads(top[keep].to_json(orient="records")),
    })
summary.sort(key=lambda s: -s["maxMagnitude"])
print(json.dumps({"variant": f"{chrom}:{spec['position']}:{spec['ref']}>{spec['alt']}", "score": score, "outputs": summary}))
`;

const ALPHAGENOME_OUTPUTS = [
  'RNA_SEQ',
  'SPLICE_SITES',
  'SPLICE_SITE_USAGE',
  'SPLICE_JUNCTIONS',
  'CAGE',
  'ATAC',
  'DNASE',
  'CHIP_HISTONE',
  'CHIP_TF',
  'POLYADENYLATION',
] as const;

export const predictVariantEffectTool = (chatId: string) =>
  tool({
    description: `Predict a variant's effect on gene regulation and splicing with Google DeepMind's AlphaGenome (1 Mb context, GRCh38): expression (RNA-seq, CAGE), chromatin accessibility (ATAC, DNase), histone marks, TF binding, splice sites, splice-site usage and junctions, polyadenylation, across tissues and cell types. Best for non-coding, splice-region and synonymous variants that protein-level predictors miss. Scores are quantiles relative to common variants (|score| near 1 is extreme).`,
    inputSchema: z.object({
      chromosome: z.string().describe('e.g. chr22'),
      position: z.number().int().positive().describe('1-based GRCh38'),
      ref: z.string(),
      alt: z.string(),
      outputs: z
        .array(z.enum(ALPHAGENOME_OUTPUTS))
        .default([
          'RNA_SEQ',
          'SPLICE_SITES',
          'SPLICE_SITE_USAGE',
          'CAGE',
          'ATAC',
        ])
        .describe('Which modalities to score; fewer is faster'),
    }),
    execute: async (spec, { abortSignal }) => {
      const run = await runPython({
        chatId,
        code: ALPHAGENOME_SCRIPT,
        args: [JSON.stringify(spec)],
        env: { ALPHAGENOME_API_KEY: process.env.ALPHAGENOME_API_KEY ?? '' },
        signal: abortSignal,
      });
      if (run.exitCode !== 0) {
        throw new Error(`AlphaGenome failed: ${run.stderr.slice(-800)}`);
      }
      const lastLine = run.stdout.trim().split('\n').at(-1) ?? '{}';
      return {
        ...JSON.parse(lastLine),
        files: run.files,
        durationMs: run.durationMs,
      };
    },
  });
