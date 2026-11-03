import type { AnalysisSession } from '@/lib/analysis/session';
import {
  estimateCostUsd,
  formatUsd,
  SPARK_PRICES,
  WONDER_PRICES,
  type ModelPrices,
  type TokenUsage,
} from '@/lib/ai/pricing';
import type { EvalCase } from './cases';

// Re-exported so run.ts keeps one import site; the prices live in lib/ai/pricing.
export {
  estimateCostUsd,
  formatUsd,
  SPARK_PRICES,
  WONDER_PRICES,
  type ModelPrices,
  type TokenUsage,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function short(value: unknown, max = 120): string {
  const text =
    typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

// A one-line view of a tool input, with the fields a reviewer looks for first for each gate tool.
export function summarizeToolInput(toolName: string, input: unknown): string {
  if (!isRecord(input)) return short(input);
  if (toolName === 'setChecklist' && Array.isArray(input.items)) {
    const items = input.items
      .map((item) =>
        isRecord(item)
          ? `${String(item.id ?? '?')}:${String(item.kind ?? '?')}`
          : '?',
      )
      .join(', ');
    return `items=[${items}]`;
  }
  if (toolName === 'recordFact') {
    return `item=${String(input.itemId ?? '?')} ref=${String(input.ref ?? '?')} path=${String(input.path ?? '?')} value=${short(input.value, 40)}`;
  }
  if (toolName === 'submitReport' && Array.isArray(input.findings)) {
    const findings = input.findings
      .map((finding) =>
        isRecord(finding)
          ? `${String(finding.itemId ?? '?')}:${String(finding.status ?? '?')}`
          : '?',
      )
      .join(', ');
    return `findings=[${findings}]`;
  }
  if (toolName === 'requestInput') {
    const missing = input.missing ?? input.question ?? input.reason;
    return `missing=${short(missing, 80)}${input.itemId ? ` item=${String(input.itemId)}` : ''}`;
  }
  const parts = Object.entries(input).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}=[${value.length} items]`;
    return `${key}=${short(value, 40)}`;
  });
  return short(parts.join(' '));
}

export function problemsFrom(output: unknown): string[] {
  if (!isRecord(output) || output.ok !== false) return [];
  return stringList(output.problems);
}

export function printStep(
  stepNumber: number,
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>,
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>,
  text: string,
): void {
  console.log(`  step ${stepNumber + 1}`);
  if (toolCalls.length === 0 && !text) console.log('    (no tool calls)');
  for (const call of toolCalls) {
    console.log(
      `    → ${call.toolName} ${summarizeToolInput(call.toolName, call.input)}`,
    );
    const result = toolResults.find(
      (entry) => entry.toolCallId === call.toolCallId,
    );
    const problems = result ? problemsFrom(result.output) : [];
    for (const problem of problems) {
      console.log(`      REFUSED: ${problem}`);
    }
  }
  // Tool results without a matching call still matter, because a refusal there is what the model must fix.
  for (const result of toolResults) {
    if (toolCalls.some((call) => call.toolCallId === result.toolCallId)) {
      continue;
    }
    for (const problem of problemsFrom(result.output)) {
      console.log(`    → ${result.toolName} REFUSED: ${problem}`);
    }
  }
  if (text) console.log(`    text: ${short(text, 200)}`);
}

export function verdictFor(
  evalCase: EvalCase,
  session: AnalysisSession,
  finalText = '',
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (evalCase.expect === 'answered') {
    if (!finalText.trim()) reasons.push('no answer text was produced');
    return { pass: reasons.length === 0, reasons };
  }
  if (evalCase.expect === 'needs_input') {
    if (session.status !== 'needs_input') {
      reasons.push(`status is ${session.status}, expected needs_input`);
    }
    const question = session.openInputRequest?.question ?? '';
    if (!/phenotype|clinical finding/i.test(question)) {
      reasons.push(
        question
          ? `input request does not name phenotypes: "${question}"`
          : 'no open input request naming phenotypes',
      );
    }
    return { pass: reasons.length === 0, reasons };
  }
  const kinds = new Set((session.checklist ?? []).map((item) => item.kind));
  if (!kinds.has('phenotype_match')) {
    reasons.push('checklist has no phenotype_match item');
  }
  if (!kinds.has('counterevidence')) {
    reasons.push('checklist has no counterevidence item');
  }
  if (session.facts.length === 0) reasons.push('no facts recorded');
  if (session.status !== 'awaiting_review') {
    reasons.push(`status is ${session.status}, expected awaiting_review`);
  }
  return { pass: reasons.length === 0, reasons };
}

export function printCaseSummary(input: {
  evalCase: EvalCase;
  session: AnalysisSession;
  steps: number;
  finalText: string;
  usage: TokenUsage;
  costUsd: number;
  verdict: { pass: boolean; reasons: string[] };
}): void {
  const { evalCase, session, steps, finalText, usage, costUsd, verdict } =
    input;
  console.log(`  status: ${session.status}`);
  const checklist = session.checklist ?? [];
  console.log(
    `  checklist: ${checklist.length > 0 ? checklist.map((item) => `${item.id}:${item.kind}`).join(', ') : '(none)'}`,
  );
  const perItem = new Map<string, number>();
  for (const fact of session.facts) {
    perItem.set(fact.itemId, (perItem.get(fact.itemId) ?? 0) + 1);
  }
  console.log(
    `  facts: ${session.facts.length} total${perItem.size > 0 ? ` (${[...perItem.entries()].map(([id, count]) => `${id}=${count}`).join(', ')})` : ''}`,
  );
  const findings = session.report?.findings ?? [];
  if (findings.length === 0) {
    console.log('  report findings: (none)');
  } else {
    console.log('  report findings:');
    for (const finding of findings) {
      console.log(
        `    - ${finding.itemId} [${finding.status}] ${short(finding.text, 160)}`,
      );
    }
  }
  if (session.openInputRequest) {
    console.log(
      `  open input request: ${short(session.openInputRequest.question, 160)}`,
    );
  }
  if (finalText) console.log(`  final text: ${short(finalText, 300)}`);
  console.log(`  steps: ${steps}`);
  console.log(
    `  tokens: input=${usage.inputTokens} cached=${usage.cachedTokens} output=${usage.outputTokens} reasoning=${usage.reasoningTokens} total=${usage.totalTokens}`,
  );
  console.log(
    `  estimated cost (muse-wonder-1.0): ${formatUsd(costUsd)} — reasoning billed as output`,
  );
  console.log(
    '  note: sub-agent and claims-check Spark calls are not in the agent usage above, so this cost undercounts the full run (muse-spark-1.3: $1.25 input / $0.15 cached / $4.25 output per 1M).',
  );
  console.log(
    `VERDICT ${evalCase.id}: ${verdict.pass ? 'PASS' : `FAIL - ${verdict.reasons.join('; ')}`}`,
  );
}
