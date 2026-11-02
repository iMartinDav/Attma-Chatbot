# Task T12b: two T12 leftovers, then the harness (Nov 2, branch feat/trust-gate)

Small follow-up to T12. Do not edit other files in `docs/muse/`. Stay on `feat/trust-gate`, no commits.

## 1. The budget stop must be cost-based, not tokens (HIGH)

`lib/ai/budget.ts` stops at 150,000 total tokens. Real dravet runs used 103,970 and 174,763 tokens (`scripts/analysis-eval/results/2026-11-02T13-11-32-844Z.json`, `2026-11-02T15-00-07-436Z.json`), so the cap can cut the headline demo case before it submits. Most of those tokens are cached input, which Muse bills at $0.20/M instead of $4/M, so tokens are the wrong measure. Change the condition to estimated cost: sum each step's `usage` (input, cached via `inputTokenDetails.cacheReadTokens`, output) through `estimateCostUsd` with `WONDER_PRICES`, and stop at `RUN_COST_BUDGET_USD = 1.5`. Update the unit test: a step set like the 174,763-token run (168,306 input, 150,500 cached, 6,457 output) must NOT stop; a set costing over $1.50 must stop.

## 2. Show cached tokens in the run summary (small)

Add `cachedTokens` to the `data-run` part in `app/api/chat/route.ts` and its type, and show it in the run summary line in `components/chat/message.tsx` as "N cached" (only when N > 0). Update any test that builds a `data-run` part.

## Checks

- `timeout 1500 bun --env-file=.env.local run release-gate` must pass.
- Then, once (about $1.50): `env -u OPENAI_BASE_URL timeout 1500 bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts --repeat 3 dravet phenotypes-only variants-only-question`. Report the pass count per case and the total cost. If any case fails, report its refusal texts; do not weaken any check.
