/**
 * Rare disease agent: Muse Wonder plans and decides; Muse Spark sub-agents read
 * clinical documents and review the literature; deterministic engines rank
 * diagnoses (local HPO similarity) and variants (VEP, gnomAD, ClinVar,
 * AlphaMissense). Research use: the agent never states a final diagnosis.
 */

import { myProvider } from '@/lib/ai/providers';
import {
  prioritizeVariantsTool,
  rankDiagnosesTool,
} from '@/lib/ai/tools/rare-disease';
import { searchPubMed } from '@/lib/rare-disease/pubmed';
import { generateText, isStepCount, Output, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

export const RARE_DISEASE_INSTRUCTIONS = `You are Attma's rare disease agent, supporting a clinical geneticist.
Work through the case on your own, using tools, until you can give a well-supported answer:
1. If documents are attached (lab reports, clinic letters, photos of them), call readClinicalDocument for each one, in parallel.
2. Combine the note and the documents. Use only findings the patient HAS as phenotypes, with the HPO ID for each one you know (laboratory findings too, e.g. elevated 7-dehydrocholesterol); keep negated or absent findings out of the tools.
3. Call rankDiagnoses once with the phenotypes and every candidate variant.
4. Call reviewLiterature for the one or two leading candidate genes, in parallel.
5. Answer in under 250 words: the leading hypothesis and why (which findings and which variant evidence), what argues against the runners-up, and 2-4 concrete next steps (confirmatory testing, segregation in parents, specialist referral, management cautions).
The tool results already appear to the user as tables, so do not repeat them. Cite HPO, OMIM or Orphanet, ClinVar, gnomAD, AlphaMissense and PubMed (PMID) inline. Describe frequencies precisely (AF < 0.0001 is rare, > 0.01 is common). This is decision support for research use: never state a final diagnosis.`;

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

const caseExtraction = z.object({
  documentType: z
    .string()
    .describe('e.g. "exome report", "clinic letter", "lab results"'),
  sex: z.enum(['female', 'male', 'unknown']),
  age: z.string().describe('Age or age at onset as written, or "unknown"'),
  presentFindings: z.array(
    z.object({
      label: z.string().describe('Clinical finding the patient has'),
      hpoId: z.string().nullable().describe('HPO ID if known, e.g. HP:0001250'),
    }),
  ),
  absentFindings: z
    .array(z.string())
    .describe('Findings explicitly reported as absent or normal'),
  variants: z.array(
    z.object({
      notation: z
        .string()
        .describe(
          'HGVS with transcript (NM_...:c.), rsID, or chrom-pos-ref-alt on GRCh38',
        ),
      gene: z.string().nullable(),
      zygosity: z.enum(['heterozygous', 'homozygous', 'hemizygous', 'unknown']),
      inheritance: z.enum(['de novo', 'maternal', 'paternal', 'unknown']),
      reportedClassification: z
        .string()
        .nullable()
        .describe('Classification stated in the document, if any'),
    }),
  ),
  familyHistory: z.string().describe('As written, or "not reported"'),
});

/** Muse Spark reads a PDF or image and returns the structured case it states. */
export async function extractCaseFromDocument(
  data: URL | Uint8Array,
  mediaType: string,
) {
  const started = Date.now();
  const { output } = await generateText({
    model: myProvider.languageModel('subagent-model'),
    instructions:
      'Extract exactly what the document states. Do not infer findings or variants that are not written. Copy variant notation verbatim.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the case from this document.' },
          { type: 'file', data, mediaType },
        ],
      },
    ],
    output: Output.object({ schema: caseExtraction }),
  });
  return { ...output, elapsedMs: Date.now() - started };
}

export const readClinicalDocument = tool({
  description: `Read an attached clinical document (PDF lab report, clinic letter, or an image of one) with a vision sub-agent and extract the patient's sex, age, present and absent findings, variants (with zygosity and inheritance) and family history.`,
  inputSchema: z.object({
    url: z.string().url().describe('The attachment URL from the message'),
    mediaType: z
      .string()
      .describe('application/pdf, image/png, image/jpeg, image/webp'),
    name: z.string().optional(),
  }),
  execute: async ({ url, mediaType }) => {
    if (!BLOB_HOST.test(new URL(url).hostname)) {
      throw new Error('Only documents uploaded to this chat can be read.');
    }
    return extractCaseFromDocument(new URL(url), mediaType);
  },
});

const literatureAssessment = z.object({
  verdict: z.enum(['strong', 'moderate', 'limited', 'none']),
  summary: z
    .string()
    .describe(
      'Two sentences on how well the literature supports the gene for this phenotype',
    ),
  articles: z.array(
    z.object({
      pmid: z.string(),
      supports: z.enum(['supports', 'neutral', 'against']),
      finding: z.string().describe('One sentence: what this paper shows'),
    }),
  ),
});

export const reviewLiterature = tool({
  description: `Search PubMed for a candidate gene and have a sub-agent read the abstracts and judge whether each paper supports that gene for the patient's phenotype. Returns cited evidence.`,
  inputSchema: z.object({
    gene: z.string(),
    disease: z.string().describe('Leading disease for this gene'),
    phenotypes: z.array(z.string()).describe("The patient's key findings"),
  }),
  execute: async ({ gene, disease, phenotypes }) => {
    const started = Date.now();
    let articles = await searchPubMed(
      `${gene}[tiab] AND (${disease} OR case report[pt])`,
      6,
    );
    // Gene symbols that are English words (WAS, CAT) are ignored by PubMed,
    // so fall back to the disease name.
    if (articles.length === 0) {
      articles = await searchPubMed(`"${disease}" AND case report[pt]`, 6);
    }
    if (articles.length === 0) {
      articles = await searchPubMed(`"${disease}"`, 6);
    }
    if (articles.length === 0) {
      return {
        gene,
        verdict: 'none' as const,
        summary: 'No PubMed records found.',
        articles: [],
        elapsedMs: Date.now() - started,
      };
    }

    const { output } = await generateText({
      model: myProvider.languageModel('subagent-model'),
      instructions:
        'You review case reports for a clinical geneticist. Judge each abstract only on what it states.',
      prompt: `Gene: ${gene}\nCandidate disease: ${disease}\nPatient findings: ${phenotypes.join('; ')}\n\n${articles
        .map(
          (a) =>
            `PMID ${a.pmid} (${a.year}) ${a.title}\n${a.abstract.slice(0, 1800)}`,
        )
        .join('\n\n')}`,
      output: Output.object({ schema: literatureAssessment }),
    });

    const byPmid = new Map(articles.map((a) => [a.pmid, a]));
    return {
      gene,
      verdict: output.verdict,
      summary: output.summary,
      articles: output.articles
        .filter((a) => byPmid.has(a.pmid))
        .map((a) => {
          const article = byPmid.get(a.pmid);
          return {
            ...a,
            title: article?.title ?? '',
            year: article?.year ?? '',
            journal: article?.journal ?? '',
            url: article?.url ?? '',
          };
        }),
      elapsedMs: Date.now() - started,
    };
  },
});

export const rareDiseaseTools = {
  readClinicalDocument,
  rankDiagnoses: rankDiagnosesTool,
  prioritizeVariants: prioritizeVariantsTool,
  reviewLiterature,
};

export const rareDiseaseAgent = new ToolLoopAgent({
  model: myProvider.languageModel('agent-model'),
  instructions: RARE_DISEASE_INSTRUCTIONS,
  tools: rareDiseaseTools,
  stopWhen: isStepCount(10),
});
