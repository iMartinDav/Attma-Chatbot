# Task T1: the analysis trust core (pure logic + tests, no wiring yet)

You are working in `nextjs-frontend/` of Attma, a Next.js 16 + AI SDK 7 app (TypeScript 6, strict). Read `../CLAUDE.md` first: it is the project guide (commands, architecture, conventions). Read `../docs/HACKATHON-PLAN.md` §4 Block 1 for why this exists. A senior engineer reviews your diff after this task, so work carefully and stay inside the scope below.

## Goal

Attma's agent ranks rare-disease variants with real tools (`lib/ai/tools/rare-disease.ts`, engine in `lib/rare-disease/rank.ts`). Today nothing checks that numbers in its final answer match the tool outputs. Build the pure-logic core of a verification layer, modelled on Meta's legal-agent workshop: a checklist, facts recorded from tool results, and a report that code verifies before it can be shown for human review. This task is ONLY the logic and its tests. Do not touch the agent, the route, tools or UI (that is task T2).

## Create `lib/analysis/` with these modules

1. `types.ts`: zod schemas + inferred types.
   - `ChecklistItem`: `{ id: string (e.g. "c1"), question: string, kind: 'phenotype_match' | 'variant_evidence' | 'counterevidence' | 'literature' | 'other', evidenceNeeded: string }`.
   - `Checklist`: 4 to 8 items, unique ids.
   - `Fact`: `{ id: string ("f1"...), itemId: string, ref: string, path: string, value: string | number | boolean | null, recordedAt: string }`.
   - `ReportFinding`: `{ itemId: string, status: 'proven' | 'gap', text: string (one or two sentences), factIds: string[] }`.
   - `Report`: `{ answer: string (2-3 sentences), findings: ReportFinding[], gaps: string[] }`.
   - Analysis status: `'collecting' | 'needs_input' | 'awaiting_review' | 'escalated'`.

2. `session.ts`: an `AnalysisSession` class holding the state of one chat's analysis.
   - Captured tool results: `captureResult(toolName, output) => ref` stores an output under a short stable ref (`"r1"`, `"r2"`, ... continuing from the highest ref already present), and `getResult(ref)`.
   - `setChecklist(items)`, `recordFact(...)`, `submitReport(...)`, `requestInput(...)` methods that call the validators below and return either `{ ok: true, ... }` or `{ ok: false, problems: string[] }`. Never throw for model mistakes; problems are short, specific, fixable sentences addressed to the agent (e.g. `"Fact for c2: path variants[0].cadd is 27.4 in r3, not 28.1."`).
   - Refusal counter for reports: after 3 refused `submitReport` calls, status becomes `escalated`.
   - `static fromHistory(snapshot)` / `toSnapshot()`: a plain JSON snapshot (results by ref, checklist, facts, refusals, status) so T2 can rebuild the session from saved chat messages. Round-trip must be lossless.

3. `paths.ts`: resolve a path like `variants[0].alphaMissense.score` or `diseases[2].name` inside a JSON value. Return `{ found: false }` for anything missing; never throw.

4. `verify.ts`: deterministic checks, each a pure function returning `string[]` problems (empty = pass).
   - `verifyChecklist(items)`: 4 to 8 items; unique ids; at least one `counterevidence` item; at least one `phenotype_match` item; no empty question.
   - `verifyFact(fact, session)`: the checklist exists; itemId is on it; the ref exists; the path resolves; the recorded value equals the resolved value (normalise: trim strings, compare case-insensitively; numbers equal within 1e-9 relative, and also accept a string that parses to that number); at most 3 facts per item.
   - `verifyReport(report, session)`, in this order:
     1. zod-parse the report.
     2. every checklist item has exactly one finding; no finding for an unknown item.
     3. a `proven` finding cites 1 to 3 factIds, all recorded facts for that same item; a `gap` finding may cite 0 to 3.
     4. **numbers in finding text**: every number written with a decimal point, an exponent (`1e-5`; forms like `3.2×10⁻⁵` may be ignored, keep it simple) or a `%` sign must equal one of its cited facts' numeric values at the precision written (fact 27.43 matches text "27.4"; fact 0.000012 matches "1.2e-5"; a percent in text matches a fact either as the same number or the fact × 100). Integers without a decimal point are not checked. Report each mismatch naming the item and the number.
     5. the counterevidence item(s) have a finding (proven or gap).
     6. no open input request.
   - Problems must point to what is wrong without inventing evidence.

5. `index.ts`: re-export the public API.

## Tests (write them FIRST, see them fail, then implement)

`lib/analysis/__tests__/` with Jest (offline, no network, no model calls). Use small fixtures shaped like the real tool outputs: read `VariantCandidate` / `VariantPrioritization` / `DiagnosisRanking` in `lib/rare-disease/rank.ts` and build a `prioritizeVariants`-like fixture output with 3 variants (fields such as `gnomadAf`, `clinvar`, `alphaMissense`, `cadd`). Required cases:
- checklist without a counterevidence item is refused; a valid one passes; 9 items refused.
- a fact whose value differs from the tool output is refused with the path and both values named; a correct one is accepted; a 4th fact on one item is refused; a fact for an unknown ref is refused.
- a correct report passes.
- **tampered report**: same report with one CADD value changed in the text (e.g. 27.4 → 28.1) is refused, naming the item and the number.
- report missing the counterevidence finding is refused.
- proven finding citing a fact from another item is refused.
- 3 refused reports → status `escalated`.
- snapshot round-trip preserves everything and new refs continue numbering.
- path resolution: nested, arrays, missing keys.

## Rules

- Match the codebase style: comments explain *why* in full sentences, sparingly. Named exports. No `any`. Keep each file under ~250 lines.
- Do not add dependencies (zod is already installed: `import { z } from 'zod'`).
- Do not modify files outside `lib/analysis/`. Do not touch `.env*` files. Do not run git commands that change history; do not commit or push.
- Run from `nextjs-frontend/`: `bun run test -- lib/analysis` until green, `bunx tsc --noEmit -p .` clean, `bunx prettier --write lib/analysis` and `bunx eslint lib/analysis` with zero errors. Note: 6 tests in `hero-input` and `useTypingEffect` already fail before your change; ignore them, do not fix them.
- Finish with a short summary: files created, test count, anything you were unsure about.
