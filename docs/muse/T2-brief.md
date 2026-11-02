# Task T2: wire the trust core into the agent (tools, stop rules, persistence)

You are in `nextjs-frontend/` of Attma. Read `../CLAUDE.md` (project guide) and `../docs/HACKATHON-PLAN.md` §4 Block 1. Task T1 already built `lib/analysis/` (types, paths, verify, session, tests: read them first). A senior engineer reviewed T1; part A below is that review. Then part B wires it in. Stay inside this scope; the UI is task T3.

## A. Fix these review findings in `lib/analysis/` first (with tests)

1. **The report's `answer` and `gaps` text are not checked.** A wrong number in the answer passes today. Apply the same written-number rule to `answer` and every `gaps` entry, matched against all facts cited anywhere in the report. Test: a report whose answer says CADD 28.1 when the fact is 27.4 is refused.
2. **Snapshots lose the tool name** (`fromHistory` sets `toolName: 'unknown'`). Store `{ toolName, output }` per ref in the snapshot and restore it. Update the round-trip test to check toolName.
3. **Replacing the checklist orphans facts.** When `setChecklist` succeeds after facts exist, drop facts whose item id is no longer on the checklist, and say so in the result (`droppedFacts: string[]`). Test it.
4. **After escalation**, `submitReport` must refuse with "This analysis is escalated to a person; wait for their reply." and not count further.
5. **Claims check.** Make `submitReport` async and accept an optional injected `claimsCheck(input) => Promise<{ itemId: string; supported: boolean; reason: string }[]>`. Order: deterministic `verifyReport` first; only if it passes, run `claimsCheck` on the proven findings (each with its item question and its cited facts: path + value). Any unsupported claim → refused with `Finding <id>: <reason>`, counts as a refusal. If `claimsCheck` throws (network), refuse with "Claims check unavailable, submit again." and do NOT count it. Pass → `awaiting_review`.

## B. Wire it in

1. **Claims check implementation** `lib/analysis/claims-check.ts`: one call to `myProvider.languageModel('subagent-model')` (Muse Spark) with structured output (see how `lib/ai/tools/subagents.ts` does structured output with the AI SDK and copy that pattern), reasoning effort low if the provider options allow it. Prompt: for each finding, judge only whether the cited facts support the finding text; do not use outside knowledge. Keep it under ~80 lines.

2. **Result capture** `lib/analysis/capture.ts`: `withCapture(tools: ToolSet, session, names: string[]): ToolSet` wraps the `execute` of the named evidence tools so each successful result is stored with `session.captureResult(toolName, output)`, and the returned output gets a `ref` field added (only when the output is a plain object; otherwise leave the output unchanged and don't capture). Evidence tools to capture: `rankDiagnoses`, `prioritizeVariants`, `proteinStructure`, `reviewLiterature`, `lookupGene`, `predictVariantEffect`. Do not capture `runPython` or document tools (too large). The added `ref` must not break the existing UI rendering of those tools: check `components/chat/agent-activity.tsx` and `components/chat/message.tsx`.

3. **Agent tools** `lib/analysis/tools.ts`: `analysisTools(session, { claimsCheck })` returns AI SDK `tool()`s with zod `inputSchema` and clear descriptions:
   - `setChecklist({ items })`
   - `recordFact({ itemId, ref, path, value })`: description must explain that `ref` is the `ref` field of an earlier tool result and `path` is the JSON path inside it, e.g. `variants[0].cadd`.
   - `submitReport({ answer, findings, gaps })`
   - `requestInput({ itemId?, missing })`
   Each returns a small JSON object: `{ ok: true, status, ... }` or `{ ok: false, problems }` (plus `refusalsLeft` for submitReport). Never throw for model mistakes.

4. **Agent** (`lib/ai/agents/attma-agent.ts`): `createAttmaAgent` takes an optional `analysis?: AnalysisSession`. When given, the analysis tools are always added (not a Sources connector, no catalog change) and the evidence tools are wrapped with `withCapture`. Add a stop condition next to `isStepCount(24)`: stop after a step in which `submitReport` returned `status: 'awaiting_review'` or `'escalated'`, or `requestInput` returned ok. Check the AI SDK 7 stop-condition API in `node_modules/ai` rather than guessing. Instructions:
   - Replace the line "say the plan … then carry it out without waiting for approval" so it still applies to general requests, and add a section for **variant or rare-disease interpretation** (a case with variants and/or phenotypes): call setChecklist first (4 to 8 items, including one phenotype_match and one counterevidence item, for example conflicting ClinVar, high gnomAD frequency or a benign AlphaMissense class); run the tools; recordFact for each piece of evidence (copy the value exactly from the result, cite its `ref` and path); then finish only with submitReport, never with a plain-text conclusion; fix exactly what a refusal says. If an input the checklist needs is missing (for example no phenotypes), call requestInput naming exactly one missing thing and stop. Never call submitReport in parallel with other tools.
   - Keep the existing research-use scope sentence. No diagnosis language.

5. **Route** (`app/api/chat/route.ts`), minimal changes only:
   - Before the run, rebuild the session from the latest `data-analysis` part in the chat's saved messages (`AnalysisSession.fromHistory`). If its status is `needs_input`, call `resolveInput()` (the new user message is the reply).
   - Pass it to `createAttmaAgent`.
   - After the stream finishes, if the session has a checklist, write a `data-analysis` part `{ status, checklist, facts, report, openInputRequest, refusals, snapshot }` before the existing `data-run` part, so it is saved with the assistant message and the UI (T3) can render it. Add the part type to the `ChatMessage` data types wherever `data-run` is declared.
   - Put the "find latest snapshot in messages" logic in a small exported helper in `lib/analysis/` and unit-test it.

6. **Tests** (offline, no network, no real model): the tool `execute` functions with a fake `claimsCheck` (supported, unsupported, throwing); `withCapture` (ref added, result captured, non-object untouched, non-listed tools untouched); the stop condition; the snapshot helper. Existing tests must stay as they are (6 known failures in `hero-input` and `useTypingEffect`, ignore those).

## Rules

- Match the codebase style: comments explain *why*, in full sentences, sparingly. No `any`. Small files.
- No new dependencies. Don't touch `.env*`. No git commits, pushes or history changes.
- From `nextjs-frontend/`, all must pass before you finish: `bun run test -- lib/analysis`, `bunx tsc --noEmit -p .`, `bunx eslint lib/analysis lib/ai/agents app/api/chat`, `bunx prettier --write` on the files you touched.
- Do not start the dev server and do not call the real Model API.
- Finish with a short summary: files changed, how the stop condition works, anything you could not do or are unsure about.
