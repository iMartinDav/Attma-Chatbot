# Task T3: reopen rule + a live evaluation harness for the trust gate

You are in `nextjs-frontend/` of Attma. Read `../CLAUDE.md`. Tasks T1 and T2 built and wired `lib/analysis/` (read `session.ts`, `tools.ts`, `capture.ts`, `history.ts` and the agent changes in `lib/ai/agents/attma-agent.ts` first). A senior engineer reviewed T2: it is good; part A is the one gap found. Part B builds the harness the engineer will use to test the gate against the real model. Do NOT run the harness yourself against the real Model API: the engineer runs it.

## A. Reopen the session on a new user message

Today `app/api/chat/route.ts` only calls `resolveInput()` when the status is `needs_input`. After `awaiting_review` (the person asks for changes) or `escalated` (the person replies with guidance), the next user message must reopen the analysis, otherwise the agent can never submit again.
- Add `AnalysisSession.reopen()`: clears an open input request, sets status `collecting`, resets the refusal count to 0, keeps checklist, facts, captured results and the last report (the agent may revise it). Call it from the route for any non-`collecting` status instead of the current `resolveInput()` branch.
- Tests for `reopen()` from each status.

## B. Live evaluation harness `scripts/analysis-eval/run.ts`

Goal: run the real agent on prepared cases outside Next.js (no auth, no database, no HTTP) and print what happened, so we can see whether Muse follows checklist → recordFact → submitReport.

1. It runs with `bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts [caseId ...]` (the `react-server` condition is what lets `import 'server-only'` load outside Next; check this works by importing the agent module in a quick dry run that does NOT call the model, e.g. a `--dry` flag that builds the agent and prints its tool names, then exits).
2. Cases, defined in `scripts/analysis-eval/cases.ts` from `lib/rare-disease/demo-cases.ts` (reuse `demoPrompt`):
   - `dravet`, `genital-anomalies`, `low-platelets`: the three demo cases as the user would send them.
   - `dravet-no-phenotypes`: the dravet variants only, with a note that no clinical findings are available. Expected: `requestInput` naming the missing phenotypes, status `needs_input`.
3. For each case: a fresh `AnalysisSession`; `createAttmaAgent({ chatId: 'eval-<case>', connectors: <DEFAULT_CONNECTORS minus python, web, alphagenome>, analysis: session })`; run it with `agent.generate` (not stream) on the case prompt. Print, per step: tool calls (name + a one-line summary of the input, e.g. item ids, ref/path/value), refusals with their problems, and the final text if any. Then print: final session status, checklist (ids + kind), facts count per item, report findings (status + text), number of steps, tokens (input, cached, output, reasoning from the result usage) and an estimated cost using these USD per 1M token prices: muse-wonder-1.0 4.00 input / 0.20 cached / 20.00 output; muse-spark-1.3 1.25 / 0.15 / 4.25 (reasoning billed as output; note that sub-agent and claims-check Spark calls are not in the agent's usage, say so in the output).
4. Write the full per-case record to `scripts/analysis-eval/results/<timestamp>.json` (add `results/` to `.gitignore` next to the script, or to the repo's `.gitignore` if that is the convention) and print a one-line verdict per case: PASS when (a) a checklist with phenotype_match and counterevidence was set, (b) at least one fact was recorded, (c) the status is `awaiting_review`, and for `dravet-no-phenotypes` when the status is `needs_input`; otherwise FAIL with the reason.
5. A `--max-steps N` flag (default 24) and a case filter by id. Exit code 1 if any case fails.
6. Keep it readable: one file for cases, one for the runner, one small module for pretty-printing if needed. No new dependencies.

## Rules

- Comments explain *why*, in full sentences, sparingly. No `any`. No `.env*` edits. No git commits or pushes.
- Must pass: `bun run test -- lib/analysis`, `bunx tsc --noEmit -p .` (make sure the script is type-checked or excluded deliberately, and say which), `bunx eslint lib/analysis scripts/analysis-eval app/api/chat`, Prettier on touched files. `app/api/chat/schema.ts` already fails Prettier before your change; leave it.
- You may run `--dry` (no model call). Never run the harness against the model, never start the dev server.
- Finish with: files changed, the exact command to run the harness, and anything unsure.
