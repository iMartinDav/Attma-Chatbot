import { tool, type StopCondition, type ToolSet } from 'ai';
import { z } from 'zod';
import type { AnalysisSession, ClaimsCheck } from './session';
import {
  checklistItemSchema,
  factValueSchema,
  reportFindingSchema,
} from './types';

function errorProblems(error: unknown): string[] {
  // Tool failures are returned as problems so the model can fix its input instead of crashing the run.
  return [error instanceof Error ? error.message : String(error)];
}

// The run ends once a report waits for a person or the agent has asked for the one missing input.
export const analysisStopCondition: StopCondition<ToolSet> = ({ steps }) => {
  const last = steps.at(-1);
  if (!last) return false;
  return last.toolResults.some((result) => {
    const output = result.output as { ok?: unknown; status?: unknown } | null;
    if (output === null || typeof output !== 'object') return false;
    if (result.toolName === 'submitReport') {
      return (
        output.status === 'awaiting_review' || output.status === 'escalated'
      );
    }
    if (result.toolName === 'requestInput') return output.ok === true;
    return false;
  });
};

export function analysisTools(
  session: AnalysisSession,
  options: { claimsCheck?: ClaimsCheck } = {},
): ToolSet {
  return {
    setChecklist: tool({
      description:
        'Set the analysis checklist before gathering evidence: 4 to 8 answerable items, including one phenotype_match item and one counterevidence item (conflicting ClinVar, high gnomAD frequency or a benign AlphaMissense class). Replacing the checklist drops facts for items that are no longer listed.',
      inputSchema: z.object({
        items: z.array(checklistItemSchema),
      }),
      execute: async ({ items }) => {
        try {
          const result = session.setChecklist(items);
          if (!result.ok)
            return { ok: false as const, problems: result.problems };
          return {
            ok: true as const,
            status: session.status,
            checklist: result.checklist,
            droppedFacts: result.droppedFacts,
          };
        } catch (error) {
          return { ok: false as const, problems: errorProblems(error) };
        }
      },
    }),
    checkVariantInput: tool({
      description:
        'Check the candidate variant list before ranking: count (1 to 200), GRCh38 chr-pos-ref-alt format, and identifier mix. A fail is a hard stop: fix the list or call requestInput, and do not submit a report until a corrected list passes. Call this first when the case gives candidate variants.',
      inputSchema: z.object({
        variants: z.array(z.string()),
      }),
      execute: async ({ variants }) => {
        try {
          const qc = session.runQc(variants);
          return {
            ok: qc.status !== 'fail',
            status: session.status,
            qc,
            ...(qc.status === 'fail' ? { problems: qc.problems } : {}),
          };
        } catch (error) {
          return { ok: false as const, problems: errorProblems(error) };
        }
      },
    }),
    recordFact: tool({
      description:
        'Record one fact from an earlier evidence tool result. The ref is the ref field of that tool result, and path is the JSON path inside it, for example variants[0].cadd. Copy the value exactly from the result. At most 4 facts per checklist item.',
      inputSchema: z.object({
        itemId: z.string().min(1),
        ref: z.string().min(1),
        path: z.string().min(1),
        value: factValueSchema,
      }),
      execute: async ({ itemId, ref, path, value }) => {
        try {
          const result = session.recordFact({ itemId, ref, path, value });
          if (!result.ok)
            return { ok: false as const, problems: result.problems };
          return {
            ok: true as const,
            status: session.status,
            fact: result.fact,
          };
        } catch (error) {
          return { ok: false as const, problems: errorProblems(error) };
        }
      },
    }),
    submitReport: tool({
      description:
        'Submit the finished analysis report. Every checklist item needs one finding: proven findings cite 1 to 4 recorded facts, and every number in the answer, findings and gaps must match a cited fact. Never call this in parallel with other tools. A refusal says what to fix; after 3 refusals the analysis escalates to a person.',
      inputSchema: z.object({
        answer: z.string().min(1),
        findings: z.array(reportFindingSchema),
        gaps: z.array(z.string()),
      }),
      execute: async ({ answer, findings, gaps }) => {
        const refusalsLeft = () => Math.max(0, 3 - session.refusals);
        try {
          const result = await session.submitReport(
            { answer, findings, gaps },
            options.claimsCheck,
          );
          if (!result.ok) {
            return {
              ok: false as const,
              problems: result.problems,
              status: session.status,
              refusalsLeft: refusalsLeft(),
            };
          }
          return {
            ok: true as const,
            status: session.status,
            report: result.report,
            refusalsLeft: refusalsLeft(),
          };
        } catch (error) {
          return {
            ok: false as const,
            problems: errorProblems(error),
            status: session.status,
            refusalsLeft: refusalsLeft(),
          };
        }
      },
    }),
    requestInput: tool({
      description:
        'Ask the researcher for exactly one missing input the checklist needs, for example no phenotypes provided, and stop. Use this only when an item cannot be settled from the data given.',
      inputSchema: z.object({
        itemId: z.string().min(1).optional(),
        missing: z.string().min(1),
      }),
      execute: async ({ itemId, missing }) => {
        try {
          const result = session.requestInput({ itemId, missing });
          if (!result.ok)
            return { ok: false as const, problems: result.problems };
          return {
            ok: true as const,
            status: session.status,
            request: result.request,
          };
        } catch (error) {
          return { ok: false as const, problems: errorProblems(error) };
        }
      },
    }),
  };
}
