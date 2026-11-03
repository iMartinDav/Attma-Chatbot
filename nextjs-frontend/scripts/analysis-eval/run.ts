/**
 * Live evaluation for the analysis trust gate, outside Next.js.
 *
 * Usage:
 *   bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts [--dry] [--max-steps N] [--repeat N] [caseId ...]
 *
 * The react-server condition lets `import 'server-only'` load outside Next.
 * Without --dry this calls the real model, so run it deliberately.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStepCount } from 'ai';
import { createAttmaAgent } from '@/lib/ai/agents/attma-agent';
import {
  DEFAULT_CONNECTORS,
  type ConnectorId,
} from '@/lib/ai/connectors/catalog';
import { AnalysisSession } from '@/lib/analysis/session';
import { screenBiosecurity } from '@/lib/biosecurity/screen';
import { analysisStopCondition } from '@/lib/analysis/tools';
import { EVAL_CASES, type EvalCase } from './cases';
import {
  estimateCostUsd,
  printCaseSummary,
  printStep,
  problemsFrom,
  verdictFor,
  SPARK_PRICES,
  WONDER_PRICES,
  type TokenUsage,
} from './print';

const EXCLUDED: ConnectorId[] = ['python', 'web', 'alphagenome'];
// The sandbox, web and AlphaGenome tools need extra services, so the gate can be judged without them.
const EVAL_CONNECTORS: ConnectorId[] = DEFAULT_CONNECTORS.filter(
  (id) => !EXCLUDED.includes(id),
);

interface CliOptions {
  dry: boolean;
  maxSteps: number;
  repeat: number;
  caseIds: string[];
}

function parseArgs(argv: string[]): CliOptions {
  let dry = false;
  let maxSteps = 24;
  let repeat = 1;
  const caseIds: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--dry') {
      dry = true;
    } else if (arg === '--max-steps') {
      const value = argv[index + 1];
      if (!value) throw new Error('--max-steps needs a number.');
      maxSteps = Number(value);
      index++;
    } else if (arg.startsWith('--max-steps=')) {
      maxSteps = Number(arg.slice('--max-steps='.length));
    } else if (arg === '--repeat') {
      const value = argv[index + 1];
      if (!value) throw new Error('--repeat needs a number.');
      repeat = Number(value);
      index++;
    } else if (arg.startsWith('--repeat=')) {
      repeat = Number(arg.slice('--repeat='.length));
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag ${arg}.`);
    } else {
      caseIds.push(arg);
    }
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new Error('--max-steps must be a positive integer.');
  }
  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error('--repeat must be a positive integer.');
  }
  return { dry, maxSteps, repeat, caseIds };
}

function selectCases(caseIds: string[]): EvalCase[] {
  if (caseIds.length === 0) return EVAL_CASES;
  const selected: EvalCase[] = [];
  for (const id of caseIds) {
    const found = EVAL_CASES.find((entry) => entry.id === id);
    if (!found) {
      const known = EVAL_CASES.map((entry) => entry.id).join(', ');
      throw new Error(`Unknown case "${id}". Known cases: ${known}.`);
    }
    selected.push(found);
  }
  return selected;
}

interface StepRecord {
  step: number;
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
  refusals: Array<{ toolName: string; problems: string[] }>;
  text: string;
}

interface CaseRecord {
  caseId: string;
  prompt: string;
  expect: EvalCase['expect'];
  status: string;
  checklist: unknown;
  facts: unknown;
  factsPerItem: Record<string, number>;
  report: unknown;
  openInputRequest: unknown;
  refusals: number;
  steps: StepRecord[];
  stepCount: number;
  finalText: string;
  usage: TokenUsage;
  estimatedCostUsd: number;
  verdict: { pass: boolean; reasons: string[] };
  biosecurity: unknown;
  error?: string;
}

const options = parseArgs(process.argv.slice(2));
const cases = selectCases(options.caseIds);

if (options.dry) {
  // Building the agent proves the server-only import and tool wiring load outside Next, without calling the model.
  const agent = createAttmaAgent({
    chatId: 'eval-dry',
    connectors: EVAL_CONNECTORS,
    analysis: new AnalysisSession(),
  });
  console.log(`connectors: ${EVAL_CONNECTORS.join(', ')}`);
  console.log('tools:');
  for (const name of Object.keys(agent.tools).sort()) {
    console.log(`  - ${name}`);
  }
  console.log(`cases: ${cases.map((entry) => entry.id).join(', ')}`);
  console.log('dry run: agent built, no model call made.');
  process.exit(0);
}

const records: CaseRecord[] = [];
let anyFailed = false;

for (const evalCase of cases) {
  let passed = 0;
  for (let runIndex = 1; runIndex <= options.repeat; runIndex++) {
    console.log(`\n=== ${evalCase.id} (run ${runIndex}/${options.repeat}) ===`);
    console.log(`prompt: ${evalCase.prompt}`);
    // The intake screen is part of the verdict: a research case the reviewer blocks is an over-refusal failure.
    const screen = await screenBiosecurity({
      checkpoint: 'intake',
      text: evalCase.prompt,
    });
    console.log(
      `  biosecurity: ${screen.decision} (${screen.category}, ${screen.durationMs}ms)`,
    );
    const session = new AnalysisSession();
    const agent = createAttmaAgent({
      chatId: `eval-${evalCase.id}`,
      connectors: EVAL_CONNECTORS,
      analysis: session,
    });

    let stepRecords: StepRecord[] = [];
    let finalText = '';
    let usage: TokenUsage = {
      inputTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    };
    let errorMessage: string | undefined;

    try {
      // Passing stopWhen here replaces the agent default for this run only, so --max-steps is honoured without changing the app.
      const callOptions: Parameters<typeof agent.generate>[0] & {
        stopWhen: [
          ReturnType<typeof isStepCount>,
          typeof analysisStopCondition,
        ];
      } = {
        prompt: evalCase.prompt,
        stopWhen: [isStepCount(options.maxSteps), analysisStopCondition],
      };
      const result = await agent.generate(callOptions);
      finalText = result.text;
      const rawUsage = result.usage;
      usage = {
        inputTokens: rawUsage.inputTokens ?? 0,
        cachedTokens: rawUsage.inputTokenDetails.cacheReadTokens ?? 0,
        outputTokens: rawUsage.outputTokens ?? 0,
        reasoningTokens: rawUsage.outputTokenDetails.reasoningTokens ?? 0,
        totalTokens: rawUsage.totalTokens ?? 0,
      };
      stepRecords = result.steps.map((step, index) => {
        const toolCalls = step.toolCalls.map((call) => ({
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.input as unknown,
        }));
        const toolResults = step.toolResults.map((entry) => ({
          toolCallId: entry.toolCallId,
          toolName: entry.toolName,
          output: entry.output as unknown,
        }));
        const refusals = toolResults
          .map((entry) => ({
            toolName: entry.toolName,
            problems: problemsFrom(entry.output),
          }))
          .filter((entry) => entry.problems.length > 0);
        return {
          step: index + 1,
          toolCalls,
          toolResults,
          refusals,
          text: step.text,
        };
      });
      for (const record of stepRecords) {
        printStep(
          record.step - 1,
          record.toolCalls,
          record.toolResults,
          record.text,
        );
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${errorMessage}`);
    }

    const baseVerdict =
      errorMessage !== undefined
        ? { pass: false, reasons: [`run failed: ${errorMessage}`] }
        : verdictFor(evalCase, session, finalText);
    const verdict =
      screen.decision !== 'accept'
        ? {
            pass: false,
            reasons: [
              ...baseVerdict.reasons,
              `biosecurity screen was ${screen.decision} (${screen.category}), expected accept`,
            ],
          }
        : baseVerdict;
    if (verdict.pass) passed += 1;
    else anyFailed = true;

    const factsPerItem: Record<string, number> = {};
    for (const fact of session.facts) {
      factsPerItem[fact.itemId] = (factsPerItem[fact.itemId] ?? 0) + 1;
    }
    const costUsd = estimateCostUsd(usage, WONDER_PRICES);

    printCaseSummary({
      evalCase,
      session,
      steps: stepRecords.length,
      finalText,
      usage,
      costUsd,
      verdict,
    });

    records.push({
      caseId: evalCase.id,
      prompt: evalCase.prompt,
      expect: evalCase.expect,
      status: session.status,
      checklist: session.checklist,
      facts: session.facts,
      factsPerItem,
      report: session.report,
      openInputRequest: session.openInputRequest,
      refusals: session.refusals,
      steps: stepRecords,
      stepCount: stepRecords.length,
      finalText,
      usage,
      estimatedCostUsd: costUsd,
      verdict,
      biosecurity: screen,
      ...(errorMessage !== undefined ? { error: errorMessage } : {}),
    });
  }
  console.log(`${evalCase.id} ${passed}/${options.repeat}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(here, 'results');
await mkdir(resultsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const resultsPath = join(resultsDir, `${timestamp}.json`);
await writeFile(
  resultsPath,
  `${JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      maxSteps: options.maxSteps,
      connectors: EVAL_CONNECTORS,
      prices: {
        'muse-wonder-1.0': WONDER_PRICES,
        'muse-spark-1.3': SPARK_PRICES,
        note: 'Reasoning is billed as output. Sub-agent and claims-check Spark calls are not in the agent usage, so the estimate undercounts the full run.',
      },
      cases: records,
    },
    null,
    2,
  )}\n`,
);
console.log(`\nresults written to ${resultsPath}`);

if (anyFailed) process.exitCode = 1;
