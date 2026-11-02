# Task T6: live re-check after T5, and the starter card goes through the gate

You are in `nextjs-frontend/` of Attma. Read `../docs/muse/README.md`, `../CLAUDE.md`, then `lib/analysis/`, `scripts/analysis-eval/`, `lib/rare-disease/demo-cases.ts` and the starter cards on the empty chat screen (find "Undiagnosed patient" in `components/`).

## 1. Live harness (you may call the Model API for this, budget about $3)

Run: `env -u OPENAI_BASE_URL timeout 900 bun --conditions react-server --env-file=/Users/martindavila/Developnextjs-frontend/.env.local scripts/analysis-eval/run.ts`
Expected: 4/4 PASS (dravet, genital-anomalies, low-platelets reach `awaiting_review`; dravet-no-phenotypes reaches `needs_input`). If a case fails, read its record in `scripts/analysis-eval/results/`, decide whether the check or the agent instructions are wrong (fix checks for false refusals, never weaken the counterevidence or number rules), add a regression test from the real values, and run only the failing case again. Stop after 2 re-runs and report.

## 2. Starter card

Check that the "Undiagnosed patient" starter card sends a prompt that triggers the analysis flow (variants and/or phenotypes, so the agent calls `setChecklist` first). If it sends something vaguer, make it send `demoPrompt` for the dravet case from `lib/rare-disease/demo-cases.ts`. Do not change other cards. No em dashes in UI copy; if you change visible copy on the landing pages, update all 7 dictionaries.

## Rules

No `any`; comments explain why; no new deps; no `.env*`; no git commits. Wrap every command in `timeout`. Do not run `bun run build` (the reviewer runs it) and do not start the dev server. Must pass: `bun run test -- lib/analysis lib/ai components/chat app/api/chat`, `bunx tsc --noEmit -p .`, ESLint and Prettier on touched files. Finish with: harness verdicts per case, total tokens and estimated cost printed by the harness, files changed, anything unsure.
