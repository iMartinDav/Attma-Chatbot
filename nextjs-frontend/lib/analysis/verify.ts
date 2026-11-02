import { resolvePath } from './paths';
import {
  checklistSchema,
  factSchema,
  reportSchema,
  type AnalysisStatus,
  type ChecklistItem,
  type Fact,
  type InputRequest,
  type Report,
} from './types';

// Verify functions read the session through this shape so they stay pure and avoid a cycle with session.ts.
export interface SessionView {
  checklist: ChecklistItem[] | null;
  facts: Fact[];
  status?: AnalysisStatus;
  openInputRequest?: InputRequest | null;
  getResult(ref: string): unknown;
  hasResult?(ref: string): boolean;
}

export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  // Arrays and objects are printed as JSON so a refusal shows the real shape instead of a misleading comma join.
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

// Absent values are spelled many ways in tool output and model copy, so they are all treated as the same missing value.
function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    return text === '' || text === 'null' || text === 'none';
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function scalarEqual(recorded: unknown, resolved: unknown): boolean {
  if (isAbsent(recorded) && isAbsent(resolved)) return true;
  const a = parseNumeric(recorded);
  const b = parseNumeric(resolved);
  if (a !== null && b !== null) {
    return (
      a === b ||
      Math.abs(a - b) <= 1e-9 * (Math.max(Math.abs(a), Math.abs(b)) || 1)
    );
  }
  if (typeof recorded === 'string' && typeof resolved === 'string') {
    return recorded.trim().toLowerCase() === resolved.trim().toLowerCase();
  }
  return recorded === resolved;
}

function toElementList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // A comma-separated string is the model's plain-text copy of an array, so it is split the same way the array is listed.
  if (typeof value === 'string' && value.includes(',')) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }
  return [value];
}

// Recorded values are normalised because the model may copy a number as text or change string case.
export function valuesEqual(recorded: unknown, resolved: unknown): boolean {
  if (isAbsent(recorded) && isAbsent(resolved)) return true;
  if (isAbsent(recorded) !== isAbsent(resolved)) return false;
  const involvesList =
    Array.isArray(recorded) ||
    Array.isArray(resolved) ||
    (typeof recorded === 'string' && recorded.includes(',')) ||
    (typeof resolved === 'string' && resolved.includes(','));
  if (involvesList) {
    const recordedList = toElementList(recorded);
    const resolvedList = toElementList(resolved);
    if (recordedList.length !== resolvedList.length) return false;
    // Order does not carry meaning in these lists, so each recorded element must match one unmatched resolved element.
    const unmatched = [...resolvedList];
    for (const element of recordedList) {
      const index = unmatched.findIndex((candidate) =>
        scalarEqual(element, candidate),
      );
      if (index === -1) return false;
      unmatched.splice(index, 1);
    }
    return true;
  }
  return scalarEqual(recorded, resolved);
}

export function verifyChecklist(items: unknown): string[] {
  if (!Array.isArray(items)) return ['Checklist must list 4 to 8 items.'];
  const problems: string[] = [];
  if (items.length < 4 || items.length > 8) {
    problems.push(`Checklist must have 4 to 8 items, not ${items.length}.`);
  }
  const parsed = checklistSchema.safeParse(items);
  if (!parsed.success && items.length >= 4 && items.length <= 8) {
    // Length is reported above, so here we surface the remaining schema issues.
    for (const issue of parsed.error.issues) {
      const at = issue.path.join('.');
      problems.push(`Checklist item ${at}: ${issue.message}`);
    }
  }
  const ids = new Set<string>();
  for (const raw of items) {
    const item = raw as Partial<ChecklistItem>;
    if (typeof item.id === 'string') {
      if (ids.has(item.id))
        problems.push(`Duplicate checklist id "${item.id}".`);
      ids.add(item.id);
    }
    if (typeof item.question !== 'string' || !item.question.trim()) {
      problems.push(`Item ${item.id ?? '?'}: question must not be empty.`);
    }
  }
  const kinds = items.map((i) => (i as Partial<ChecklistItem>).kind);
  if (!kinds.includes('counterevidence')) {
    problems.push('Add a counterevidence item to the checklist.');
  }
  if (!kinds.includes('phenotype_match')) {
    problems.push('Add a phenotype_match item to the checklist.');
  }
  return [...new Set(problems)];
}

export function verifyFact(fact: Fact, session: SessionView): string[] {
  const parsed = factSchema.safeParse(fact);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (i) => `Fact ${i.path.join('.')}: ${i.message}`,
    );
  }
  if (!session.checklist) {
    return ['No checklist is set: call setChecklist first.'];
  }
  if (!session.checklist.some((i) => i.id === fact.itemId)) {
    const ids = session.checklist.map((i) => i.id).join(', ');
    return [`Fact for ${fact.itemId}: not on the checklist. Use: ${ids}.`];
  }
  const problems: string[] = [];
  const same = session.facts.filter(
    (f) => f.itemId === fact.itemId && f.id !== fact.id,
  );
  if (same.length >= 4) {
    problems.push(`Item ${fact.itemId} already has 4 facts: keep at most 4.`);
  }
  const exists = session.hasResult
    ? session.hasResult(fact.ref)
    : session.getResult(fact.ref) !== undefined;
  if (!exists) {
    problems.push(`Fact for ${fact.itemId}: ref ${fact.ref} was not captured.`);
    return problems;
  }
  const resolved = resolvePath(session.getResult(fact.ref), fact.path);
  if (!resolved.found) {
    problems.push(
      `Fact for ${fact.itemId}: path ${fact.path} not found in ${fact.ref}.`,
    );
    return problems;
  }
  if (!valuesEqual(fact.value, resolved.value)) {
    const got = formatValue(resolved.value);
    const said = formatValue(fact.value);
    problems.push(
      `Fact ${fact.itemId}: ${fact.path} is ${got} in ${fact.ref}, not ${said}.`,
    );
  }
  return problems;
}

type WrittenNumber = {
  raw: string;
  value: number;
  percent: boolean;
  step: number;
};

// Only decimals, exponents and percents are checked, because bare integers are often ranks or counts.
function writtenNumbers(text: string): WrittenNumber[] {
  const results: WrittenNumber[] = [];
  for (const match of text.matchAll(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?%?/g)) {
    const raw = match[0];
    const start = match.index;
    const before = start > 0 ? text[start - 1] : '';
    const after = text[start + raw.length] ?? '';
    // A number inside an identifier is part of that name, not a measurement, so only standalone numbers are checked.
    if (/[A-Za-z0-9_:.]/.test(before)) continue;
    if (before === '-') {
      const beforeHyphen = start > 1 ? text[start - 2] : '';
      if (/[A-Za-z0-9_]/.test(beforeHyphen)) continue;
    }
    if (/[A-Za-z_]/.test(after)) continue;
    const percent = raw.endsWith('%');
    const body = percent ? raw.slice(0, -1) : raw;
    const hasExponent = /[eE]/.test(body);
    if (!body.includes('.') && !hasExponent && !percent) continue;
    const value = Number(body);
    if (!Number.isFinite(value)) continue;
    let step = 1;
    if (hasExponent) {
      const [mantissa, exp] = body.split(/[eE]/);
      const decimals = mantissa.split('.')[1]?.length ?? 0;
      step = 10 ** (Number(exp) - decimals);
    } else if (body.includes('.')) {
      step = 10 ** -body.split('.')[1].length;
    }
    results.push({ raw, value, percent, step });
  }
  return results;
}

function matchesAtPrecision(w: WrittenNumber, c: number): boolean {
  return Math.round(c / w.step) === Math.round(w.value / w.step);
}

// Bare integers are checked too, except small structural counts and years, which prose uses without citing a measurement.
function writtenIntegers(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(/-?\d+/g)) {
    const raw = match[0];
    const start = match.index;
    const before = start > 0 ? text[start - 1] : '';
    const after = text[start + raw.length] ?? '';
    if (/[A-Za-z0-9_:.]/.test(before)) continue;
    if (before === '-') {
      const beforeHyphen = start > 1 ? text[start - 2] : '';
      if (/[A-Za-z0-9_]/.test(beforeHyphen)) continue;
    }
    if (/[A-Za-z_.]/.test(after)) continue;
    // A hyphen joined to the next token makes this part of a coordinate or identifier, not a count.
    if (
      after === '-' &&
      /[A-Za-z0-9]/.test(text[start + raw.length + 1] ?? '')
    ) {
      continue;
    }
    const value = Number(raw);
    if (!Number.isInteger(value)) continue;
    if (Math.abs(value) <= 3) continue;
    if (value >= 1900 && value <= 2099) continue;
    values.push(value);
  }
  return values;
}

function integerMatchesFacts(value: number, facts: Fact[]): boolean {
  return facts.some((fact) => parseNumeric(fact.value) === value);
}

function numberMatchesFacts(written: WrittenNumber, facts: Fact[]): boolean {
  for (const fact of facts) {
    const numeric = parseNumeric(fact.value);
    if (numeric === null) continue;
    if (matchesAtPrecision(written, numeric)) return true;
    // A percent may be written from a fraction, so the value times 100 is also accepted.
    if (written.percent && matchesAtPrecision(written, numeric * 100))
      return true;
  }
  return false;
}

export function verifyReport(report: unknown, session: SessionView): string[] {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (i) => `Report ${i.path.join('.')}: ${i.message}`,
    );
  }
  const valid: Report = parsed.data;
  if (!session.checklist)
    return ['No checklist is set: call setChecklist first.'];
  const problems: string[] = [];
  const ids = session.checklist.map((i) => i.id);
  const counts = new Map<string, number>();
  for (const finding of valid.findings) {
    counts.set(finding.itemId, (counts.get(finding.itemId) ?? 0) + 1);
    if (!ids.includes(finding.itemId)) {
      problems.push(`Finding for ${finding.itemId}: not on the checklist.`);
    }
  }
  for (const id of ids) {
    const count = counts.get(id) ?? 0;
    if (count === 0) problems.push(`Missing a finding for item ${id}.`);
    if (count > 1) problems.push(`Item ${id} has ${count} findings: keep one.`);
  }
  const factsById = new Map(session.facts.map((f) => [f.id, f]));
  for (const finding of valid.findings) {
    const id = finding.itemId;
    const n = finding.factIds.length;
    if (finding.status === 'proven' && (n < 1 || n > 4)) {
      problems.push(`Finding ${id}: proven needs 1 to 4 facts, not ${n}.`);
    }
    if (finding.status === 'gap' && n > 4) {
      problems.push(`Finding ${id}: gap may cite at most 4 facts, not ${n}.`);
    }
    for (const factId of finding.factIds) {
      const fact = factsById.get(factId);
      if (!fact) {
        problems.push(`Finding ${id}: fact ${factId} was not recorded.`);
      } else if (fact.itemId !== id) {
        problems.push(
          `Finding ${id}: fact ${factId} belongs to ${fact.itemId}.`,
        );
      }
    }
  }
  for (const finding of valid.findings) {
    const cited = finding.factIds
      .map((id) => factsById.get(id))
      .filter((f): f is Fact => f !== undefined);
    for (const written of writtenNumbers(finding.text)) {
      if (!numberMatchesFacts(written, cited)) {
        problems.push(
          `Finding ${finding.itemId}: number ${written.raw} has no cited fact.`,
        );
      }
    }
    for (const value of writtenIntegers(finding.text)) {
      if (!integerMatchesFacts(value, cited)) {
        problems.push(
          `Finding ${finding.itemId}: number ${value} has no cited fact.`,
        );
      }
    }
  }
  // The answer and gaps carry numbers too, so they are held to the same rule against every fact the report cites.
  const allCited = [
    ...new Map(
      valid.findings
        .flatMap((finding) => finding.factIds)
        .map((id) => factsById.get(id))
        .filter((f): f is Fact => f !== undefined)
        .map((fact) => [fact.id, fact] as const),
    ).values(),
  ];
  for (const written of writtenNumbers(valid.answer)) {
    if (!numberMatchesFacts(written, allCited)) {
      problems.push(`Answer: number ${written.raw} has no cited fact.`);
    }
  }
  for (const value of writtenIntegers(valid.answer)) {
    if (!integerMatchesFacts(value, allCited)) {
      problems.push(`Answer: number ${value} has no cited fact.`);
    }
  }
  for (const gap of valid.gaps) {
    for (const written of writtenNumbers(gap)) {
      if (!numberMatchesFacts(written, allCited)) {
        problems.push(`Gap: number ${written.raw} has no cited fact.`);
      }
    }
    for (const value of writtenIntegers(gap)) {
      if (!integerMatchesFacts(value, allCited)) {
        problems.push(`Gap: number ${value} has no cited fact.`);
      }
    }
  }
  for (const item of session.checklist) {
    if (item.kind !== 'counterevidence') continue;
    const finding = valid.findings.find((f) => f.itemId === item.id);
    const reported = problems.some(
      (p) => p === `Missing a finding for item ${item.id}.`,
    );
    if (!finding && !reported) {
      problems.push(`Missing a finding for counterevidence item ${item.id}.`);
    }
    // Counterevidence cannot pass on an empty gap: it must show the conflicting fact, or cite the search that found none.
    if (finding && finding.status === 'gap' && finding.factIds.length === 0) {
      problems.push(
        `Finding ${item.id}: counterevidence needs a cited fact. Cite the conflicting evidence, or cite the result you searched and state that none was found.`,
      );
    }
  }
  if (session.openInputRequest) {
    const q = session.openInputRequest.question;
    problems.push(`Cannot submit while input is requested: "${q}".`);
  } else if (session.status === 'needs_input') {
    problems.push('Cannot submit while waiting for input.');
  }
  return problems;
}
