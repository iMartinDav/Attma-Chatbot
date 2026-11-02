import {
  factSchema,
  type AnalysisSnapshot,
  type AnalysisStatus,
  type CapturedResult,
  type ChecklistItem,
  type Fact,
  type FactValue,
  type InputRequest,
  type Report,
} from './types';
import { toolMeaningFor } from './claims-prompt';
import { checkVariantInput, type QcResult } from './qc';
import {
  verifyChecklist,
  verifyFact,
  verifyReport,
  type SessionView,
} from './verify';

export interface RecordFactInput {
  id?: string;
  itemId: string;
  ref: string;
  path: string;
  value: FactValue;
  recordedAt?: string;
}

export interface ClaimsCheckFact {
  path: string;
  value: FactValue;
  toolName: string;
  toolMeaning: string;
}

export interface ClaimsCheckFindingInput {
  itemId: string;
  question: string;
  text: string;
  facts: ClaimsCheckFact[];
}

export interface ClaimsCheckVerdict {
  itemId: string;
  supported: boolean;
  reason: string;
}

export type ClaimsCheck = (
  input: ClaimsCheckFindingInput[],
) => Promise<ClaimsCheckVerdict[]>;

export type SetChecklistResult =
  | { ok: true; checklist: ChecklistItem[]; droppedFacts: string[] }
  | { ok: false; problems: string[] };
export type RecordFactResult =
  { ok: true; fact: Fact } | { ok: false; problems: string[] };
export type SubmitReportResult =
  { ok: true; report: Report } | { ok: false; problems: string[] };
export type RequestInputResult =
  { ok: true; request: InputRequest } | { ok: false; problems: string[] };

export type RequestInputInput =
  | string
  | { question?: string; missing?: string; reason?: string; itemId?: string };

function clone<T>(value: T): T {
  // Tool outputs are JSON values, so a JSON round-trip is a safe fallback where structuredClone is absent.
  if (typeof structuredClone === 'function') return structuredClone(value);
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function nextNumber(ids: string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

// One session holds the trust state for one chat, and it never throws for model mistakes so the agent can fix them.
export class AnalysisSession implements SessionView {
  private results = new Map<string, CapturedResult>();
  private checklistItems: ChecklistItem[] | null = null;
  private factList: Fact[] = [];
  private currentReport: Report | null = null;
  private inputRequest: InputRequest | null = null;
  private refusalCount = 0;
  private currentStatus: AnalysisStatus = 'collecting';
  private qcResult: QcResult | null = null;
  private restoredDropped: string[] = [];

  get checklist(): ChecklistItem[] | null {
    return this.checklistItems ? clone(this.checklistItems) : null;
  }

  get facts(): Fact[] {
    return clone(this.factList);
  }

  get status(): AnalysisStatus {
    return this.currentStatus;
  }

  get refusals(): number {
    return this.refusalCount;
  }

  get report(): Report | null {
    return this.currentReport ? clone(this.currentReport) : null;
  }

  get openInputRequest(): InputRequest | null {
    return this.inputRequest ? clone(this.inputRequest) : null;
  }

  get qc(): QcResult | null {
    return this.qcResult ? clone(this.qcResult) : null;
  }

  /** Facts dropped while restoring, because they no longer verify against the captured results. */
  get droppedOnRestore(): string[] {
    return [...this.restoredDropped];
  }

  // QC is a hard stop: a failed check stays failed until the agent checks a corrected variant list.
  runQc(variants: string[]): QcResult {
    this.qcResult = checkVariantInput(variants);
    return clone(this.qcResult);
  }

  captureResult(toolName: string, output: unknown): string {
    const ref = `r${nextNumber([...this.results.keys()], 'r')}`;
    this.results.set(ref, { toolName, output: clone(output) });
    return ref;
  }

  getResult(ref: string): unknown {
    const captured = this.results.get(ref);
    return captured ? clone(captured.output) : undefined;
  }

  getCapturedResult(ref: string): CapturedResult | undefined {
    const captured = this.results.get(ref);
    return captured ? clone(captured) : undefined;
  }

  hasResult(ref: string): boolean {
    return this.results.has(ref);
  }

  setChecklist(items: ChecklistItem[]): SetChecklistResult {
    const problems = verifyChecklist(items);
    if (problems.length > 0) return { ok: false, problems };
    this.checklistItems = clone(items);
    // Facts for items that left the checklist would point at nothing, so they are dropped with the old list.
    const keptIds = new Set(items.map((item) => item.id));
    const droppedFacts = this.factList
      .filter((fact) => !keptIds.has(fact.itemId))
      .map((fact) => fact.id);
    if (droppedFacts.length > 0) {
      this.factList = this.factList.filter((fact) => keptIds.has(fact.itemId));
    }
    return {
      ok: true,
      checklist: clone(this.checklistItems),
      droppedFacts,
    };
  }

  recordFact(input: RecordFactInput): RecordFactResult {
    const candidate: Fact = {
      id:
        input.id ??
        `f${nextNumber(
          this.factList.map((f) => f.id),
          'f',
        )}`,
      itemId: input.itemId,
      ref: input.ref,
      path: input.path,
      value: input.value,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
    };
    const parsed = factSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        problems: parsed.error.issues.map(
          (issue) =>
            `Fact is invalid at ${issue.path.join('.') || 'fact'}: ${issue.message}`,
        ),
      };
    }
    const problems = verifyFact(candidate, this);
    if (problems.length > 0) return { ok: false, problems };
    this.factList.push(clone(candidate));
    return { ok: true, fact: clone(candidate) };
  }

  async submitReport(
    report: Report,
    claimsCheck?: ClaimsCheck,
  ): Promise<SubmitReportResult> {
    // An escalated analysis waits for a person, so further submits change nothing and do not count.
    if (this.currentStatus === 'escalated') {
      return {
        ok: false,
        problems: [
          'This analysis is escalated to a person; wait for their reply.',
        ],
      };
    }
    // A report from a failed QC run must never reach review, however good its checklist and facts look.
    if (this.qcResult?.status === 'fail') {
      this.refusalCount += 1;
      if (this.refusalCount >= 3) this.currentStatus = 'escalated';
      return {
        ok: false,
        problems: [
          `Input QC failed, so no report can be submitted: ${this.qcResult.problems.join(' ')}`,
        ],
      };
    }
    const problems = verifyReport(report, this);
    if (problems.length > 0) {
      this.refusalCount += 1;
      // Three refusals mean the agent is stuck, so a person should look instead of looping forever.
      if (this.refusalCount >= 3) this.currentStatus = 'escalated';
      return { ok: false, problems };
    }
    if (claimsCheck) {
      const questions = new Map(
        (this.checklistItems ?? []).map((item) => [item.id, item.question]),
      );
      const factsById = new Map(this.factList.map((fact) => [fact.id, fact]));
      const proven = report.findings
        .filter((finding) => finding.status === 'proven')
        .map((finding) => ({
          itemId: finding.itemId,
          question: questions.get(finding.itemId) ?? '',
          text: finding.text,
          facts: finding.factIds
            .map((id) => factsById.get(id))
            .filter((fact): fact is Fact => fact !== undefined)
            .map((fact) => {
              // The judge needs to know which tool produced a fact, because that tool's meaning is part of what the fact establishes.
              const toolName =
                this.getCapturedResult(fact.ref)?.toolName ?? 'unknown';
              return {
                path: fact.path,
                value: fact.value,
                toolName,
                toolMeaning: toolMeaningFor(toolName),
              };
            }),
        }));
      let verdicts: ClaimsCheckVerdict[];
      try {
        verdicts = await claimsCheck(proven);
      } catch {
        // A network failure is not the model's fault, so this refusal does not count toward escalation.
        return {
          ok: false,
          problems: ['Claims check unavailable, submit again.'],
        };
      }
      // Every proven finding needs exactly one verdict, or an unjudged finding would pass by silence.
      const provenIds = proven.map((finding) => finding.itemId);
      const verdictCounts = new Map<string, number>();
      for (const verdict of verdicts) {
        verdictCounts.set(
          verdict.itemId,
          (verdictCounts.get(verdict.itemId) ?? 0) + 1,
        );
      }
      const coverage: string[] = [];
      for (const itemId of provenIds) {
        const count = verdictCounts.get(itemId) ?? 0;
        if (count === 0) {
          coverage.push(
            `Finding ${itemId}: claims check returned no verdict, submit again.`,
          );
        } else if (count > 1) {
          coverage.push(
            `Finding ${itemId}: claims check returned ${count} verdicts, submit again.`,
          );
        }
      }
      for (const itemId of verdictCounts.keys()) {
        if (!provenIds.includes(itemId)) {
          coverage.push(
            `Finding ${itemId}: claims check judged an item with no proven finding, submit again.`,
          );
        }
      }
      if (coverage.length > 0) {
        this.refusalCount += 1;
        if (this.refusalCount >= 3) this.currentStatus = 'escalated';
        return { ok: false, problems: coverage };
      }
      const unsupported = verdicts.filter((verdict) => !verdict.supported);
      if (unsupported.length > 0) {
        this.refusalCount += 1;
        if (this.refusalCount >= 3) this.currentStatus = 'escalated';
        return {
          ok: false,
          problems: unsupported.map(
            (verdict) => `Finding ${verdict.itemId}: ${verdict.reason}`,
          ),
        };
      }
    }
    this.currentReport = clone(report);
    this.currentStatus = 'awaiting_review';
    return { ok: true, report: clone(report) };
  }

  requestInput(input: RequestInputInput): RequestInputResult {
    const question =
      typeof input === 'string'
        ? input.trim()
        : (input.question ?? input.missing ?? input.reason ?? '').trim();
    const itemId = typeof input === 'string' ? undefined : input.itemId;
    if (!question) {
      return {
        ok: false,
        problems: [
          'Input request must name exactly one missing thing, for example "no phenotypes provided".',
        ],
      };
    }
    if (
      itemId &&
      this.checklistItems &&
      !this.checklistItems.some((i) => i.id === itemId)
    ) {
      return {
        ok: false,
        problems: [
          `Input request for ${itemId}: that item is not on the checklist.`,
        ],
      };
    }
    this.inputRequest = {
      question,
      ...(itemId ? { itemId } : {}),
      requestedAt: new Date().toISOString(),
    };
    this.currentStatus = 'needs_input';
    return { ok: true, request: clone(this.inputRequest) };
  }

  resolveInput(): { ok: true } {
    this.inputRequest = null;
    if (this.currentStatus === 'needs_input') this.currentStatus = 'collecting';
    return { ok: true };
  }

  approve(): { ok: true } | { ok: false; problems: string[] } {
    // Only a report waiting for a person can be approved; anything else is a no-op so a stray click cannot approve unfinished work.
    if (this.currentStatus !== 'awaiting_review') {
      return {
        ok: false,
        problems: ['Only a report awaiting review can be approved.'],
      };
    }
    this.currentStatus = 'approved';
    return { ok: true };
  }

  reopen(): { ok: true } | { ok: false; problems: string[] } {
    // An approved report is frozen: reopening it would silently un-approve signed-off work, so only an explicit fresh start may follow it.
    if (this.currentStatus === 'approved') {
      return {
        ok: false,
        problems: [
          'This report is approved and frozen. Start a new analysis instead of reopening it.',
        ],
      };
    }
    // A new message means the person answered or wants changes, so the gate opens again without losing the work already gathered.
    this.inputRequest = null;
    this.currentStatus = 'collecting';
    this.refusalCount = 0;
    return { ok: true };
  }

  clearInputRequest(): { ok: true } {
    return this.resolveInput();
  }

  toSnapshot(): AnalysisSnapshot {
    return clone({
      results: Object.fromEntries(
        [...this.results.entries()].map(([ref, captured]) => [
          ref,
          { toolName: captured.toolName, output: captured.output },
        ]),
      ),
      checklist: this.checklistItems,
      facts: this.factList,
      report: this.currentReport,
      openInputRequest: this.inputRequest,
      refusals: this.refusalCount,
      status: this.currentStatus,
      qc: this.qcResult
        ? { status: this.qcResult.status, problems: this.qcResult.problems }
        : null,
    });
  }

  static fromHistory(
    snapshot: AnalysisSnapshot | null | undefined,
  ): AnalysisSession {
    const session = new AnalysisSession();
    if (!snapshot) return session;
    const data = clone(snapshot);
    for (const [ref, entry] of Object.entries(data.results ?? {})) {
      // Snapshots written before tool names were kept hold the bare output, so those still restore.
      const stored = entry as Partial<CapturedResult> | null;
      if (
        stored !== null &&
        typeof stored === 'object' &&
        typeof stored.toolName === 'string' &&
        'output' in stored
      ) {
        session.results.set(ref, {
          toolName: stored.toolName,
          output: stored.output,
        });
      } else {
        session.results.set(ref, { toolName: 'unknown', output: entry });
      }
    }
    session.checklistItems = data.checklist ?? null;
    // A restored snapshot is untrusted, so every fact must verify again against the captured results or it is dropped.
    const kept: Fact[] = [];
    session.factList = kept;
    for (const fact of data.facts ?? []) {
      if (verifyFact(fact, session).length === 0) {
        kept.push(fact);
      } else {
        session.restoredDropped.push(fact.id);
      }
    }
    session.factList = kept;
    session.currentReport = data.report ?? null;
    session.inputRequest = data.openInputRequest ?? null;
    session.refusalCount = data.refusals ?? 0;
    session.currentStatus = data.status ?? 'collecting';
    if (data.qc) {
      session.qcResult = {
        status: data.qc.status,
        total: 0,
        genomic: 0,
        problems: data.qc.problems ?? [],
        warnings: [],
      };
    }
    return session;
  }
}
