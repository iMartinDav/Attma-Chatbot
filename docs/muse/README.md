# Muse build queue: Attma trust gate (Meta hackathon)

Read this first, then `../HACKATHON-PLAN.md` (the product plan) and `../../CLAUDE.md` (repo guide). Muse Wonder writes the code; a senior engineer (Claude or Martin) reviews each task before the next.

## Where things are

- Worktree: `/Users/martindavila/Developer/Attma-Chatbot`, the main checkout (commit to a feature branch before pushing; pushing `main` deploys production). Nothing is committed yet; finished work is **staged** (`git add`) as the review baseline, so `git diff` shows only the current task's changes.
- Main checkout `/Users/martindavila/Developer/Attma-Chatbot` holds `nextjs-frontend/.env.local` (secrets). Never copy it into the worktree; load it with `--env-file`.
- Done briefs: `T1`–`T5b` in this folder (history of what was built and why).
- Next briefs: `T6`, `T8` in this folder; T7 is the manual checklist below.

## What exists (done and reviewed)

- `lib/analysis/`: the trust gate. The agent sets a checklist (must include `phenotype_match` and `counterevidence`), records facts that cite a tool result `ref` + JSON path (checked against the captured output), and finishes with `submitReport`: deterministic number check, then a Muse Spark claims check, then `awaiting_review` for a person. `requestInput` gives `needs_input`; 3 refusals give `escalated`; a person can `approve` or request changes (reopen).
- `lib/ai/agents/attma-agent.ts`: evidence tools wrapped with `withCapture`, analysis tools added, stop condition after submit/requestInput.
- `app/api/chat/route.ts`: rebuilds the session from saved messages, writes a `data-analysis` part, approve shortcut without a model call, `costUsd` on `data-run` (`lib/ai/pricing.ts`).
- UI: `components/chat/analysis-card.tsx`, step labels in `components/chat/step-labels.ts` + `agent-activity.tsx`, review buttons only on the newest analysis.
- Live harness: `scripts/analysis-eval/` (4 cases: dravet, genital-anomalies, low-platelets, dravet-no-phenotypes). After T4 it passed 4/4 against real Muse.
- Status at handoff: 94 unit tests pass, `tsc` clean, ESLint 0 errors, `build:skip-migrate` passes (with the main env loaded). The UI has NOT been tested in a browser yet (T7).

## How to run Muse on a brief (from the worktree root)

```bash
cd /Users/martindavila/Developer/Attma-Chatbot
git add -A nextjs-frontend/lib nextjs-frontend/app nextjs-frontend/components nextjs-frontend/scripts docs/muse   # stage the reviewed baseline
grep -E '^META_MODEL_API_KEY=' nextjs-frontend/.env.local | cut -d= -f2- | tr -d '"' | \
  timeout 1500 muse exec --api-key-stdin --json --model muse-wonder-1.0 --reasoning-effort high \
  --max-model-steps 80 --workspace "$PWD" --prompt-file docs/muse/T6-brief.md > /tmp/muse-T6.jsonl 2> /tmp/muse-T6.err
python3 docs/muse/ledger.py /tmp    # sums run_usage from /tmp/*.jsonl at Wonder/Spark prices
```

Keep the default approvals (judge on) and the sandbox. Always wrap in `timeout` (T5 once hung 54 minutes on a command). A run killed early writes no `run_usage`, so check the Meta dashboard for its cost.

## Budget

Cap: **$110** of Muse for the build (Martin's rule). Spent at handoff: about **$16** ($11.21 measured + T5 estimated $5). Each live harness case costs about $0.30 to $0.60 of Wonder plus a little Spark.

## Review checklist (after every task)

From `nextjs-frontend/`:

```bash
timeout 300 bun run test -- lib/analysis lib/ai components/chat app/api/chat
timeout 300 bunx tsc --noEmit -p .
bunx eslint <touched files>            # zero errors; old warnings in message.tsx are pre-existing
bunx prettier --check <touched files>
timeout 900 bun --env-file=/Users/martindavila/Developnextjs-frontend/.env.local run build:skip-migrate
```

Then read `git diff` against the brief. Product rules that reviews enforce: no diagnosis or patient-facing language, "Research use only" stays on the card, no em dashes in UI copy, `text-primary-ink` for mint text, no `any`, comments explain why.

## Dev server and live harness

- Browser preview: `.claude/launch.json` starts this checkout on localhost:3000 (`attma-dev`): `env -u OPENAI_BASE_URL NEXTAUTH_URL=http://localhost:3000 AUTH_URL=http://localhost:3000 AUTH_TRUST_HOST=true bun run dev` from `nextjs-frontend/`.
- Live harness: `cd nextjs-frontend && env -u OPENAI_BASE_URL bun --conditions react-server --env-file=<main .env.local> scripts/analysis-eval/run.ts [case ...]` (`--dry` makes no model call). Results go to `scripts/analysis-eval/results/` (gitignored).

## Queue

| Task | What | Who |
|------|------|-----|
| T6 | Live harness re-run after T5, fix any regression; make the "Undiagnosed patient" starter card go through the gate | Muse |
| T7 | Manual browser test (checklist below), then fix what it finds | Human runs, Muse fixes |
| T8 | Release gate: full checks, format, commit plan, PR text | Muse prepares, human commits and merges |
| Block 0 | Official Rules, track and theme, rotate Neon/Blob keys, make repo public | Martin only |
| Block 3 | Freeze Nov 4 14:00 Paris, record video, submit by 22:00 Paris | Martin |

### T7 manual browser checklist (a person runs this; give the findings to Muse as a brief)

1. On localhost:3000/chat, click "Undiagnosed patient" (or paste the dravet demo case). Expect timeline steps "Set a checklist of N questions", "Recorded N facts", "Report checked: passed" (or "Report refused (k of 3)" with amber problems), runner badges "Attma checks" / "Code + Muse Spark".
2. The analysis card shows status "Awaiting your review", the checklist with kinds (counterevidence in amber), Proven/Gap per item, cited facts `path = value (ref)`, answer, gaps and the research-use line. The run summary shows "~$0.xx" with a tooltip.
3. Click Approve: user message "Approved the report.", reply "Approved.", card status "Approved", no model run (fast). Reload: still Approved, no buttons.
4. New chat, same case, Request changes, type notes, send: the agent runs again and submits a revised report. Only the newest card has buttons.
5. Send variants with no phenotypes: the card shows "Needs input" and the missing item.
6. Resize to 375 px wide and switch to light mode: nothing overflows, amber text readable.
