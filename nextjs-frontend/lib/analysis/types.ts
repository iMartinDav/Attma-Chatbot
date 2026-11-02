import { z } from 'zod';

// The schemas are the contract the model must satisfy, so code can refuse bad input instead of trusting prose.
export const checklistItemKindSchema = z.enum([
  'phenotype_match',
  'variant_evidence',
  'counterevidence',
  'literature',
  'other',
]);

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  kind: checklistItemKindSchema,
  evidenceNeeded: z.string().min(1),
});

export const checklistSchema = z
  .array(checklistItemSchema)
  .min(4)
  .max(8)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate checklist item id "${item.id}".`,
          path: [index, 'id'],
        });
      }
      seen.add(item.id);
    }
  });

export const factValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const factSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  ref: z.string().min(1),
  path: z.string().min(1),
  value: factValueSchema,
  recordedAt: z.string().min(1),
});

export const reportFindingSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(['proven', 'gap']),
  text: z.string().min(1),
  factIds: z.array(z.string().min(1)),
});

export const reportSchema = z.object({
  answer: z.string().min(1),
  findings: z.array(reportFindingSchema),
  gaps: z.array(z.string()),
});

export const analysisStatusSchema = z.enum([
  'collecting',
  'needs_input',
  'awaiting_review',
  'approved',
  'escalated',
]);

export type ChecklistItemKind = z.infer<typeof checklistItemKindSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
export type FactValue = z.infer<typeof factValueSchema>;
export type Fact = z.infer<typeof factSchema>;
export type ReportFinding = z.infer<typeof reportFindingSchema>;
export type Report = z.infer<typeof reportSchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

// A snapshot is plain JSON so a session can be rebuilt from saved chat messages in T2.
export interface CapturedResult {
  toolName: string;
  output: unknown;
}

export interface InputRequest {
  question: string;
  itemId?: string;
  requestedAt: string;
}

export interface AnalysisSnapshot {
  results: Record<string, CapturedResult>;
  checklist: ChecklistItem[] | null;
  facts: Fact[];
  report: Report | null;
  openInputRequest: InputRequest | null;
  refusals: number;
  status: AnalysisStatus;
  // Optional so snapshots saved before QC existed still restore.
  qc?: { status: 'pass' | 'warn' | 'fail'; problems: string[] } | null;
}
