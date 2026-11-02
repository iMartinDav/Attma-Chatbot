# Task T12: the review fixes before the video (Nov 2, branch feat/trust-gate)

This brief is not T10 or T11. Do not edit, rename or overwrite other files in `docs/muse/`. Read `docs/muse/REVIEW-2026-11-02.md` first: it explains each finding. You are in `nextjs-frontend/` on `feat/trust-gate` (never `main`). T11 is done but not committed; build on top of it and do not revert it.

Work in this order. Each logic fix starts with a failing test (run it, see it fail), then the fix.

## 1. Phenotype-only analyses are always refused (HIGH)

In `lib/analysis/session.ts` `submitReport`, the "QC enforcement" block treats every `rankDiagnoses` output as a variant ranking. A `rankDiagnoses` call with phenotypes and no variants returns `variantRanking: undefined`, so QC is demanded and the coverage check fails with "Annotation returned no variants at all". Fix: a captured result counts as a ranked-variants output only if it is `prioritizeVariants`, or `rankDiagnoses` whose `variantRanking` is a non-null object. Tests: (a) phenotype-only `rankDiagnoses` output + valid checklist and facts submits OK without QC; (b) `rankDiagnoses` with a real `variantRanking` and no QC is still refused; (c) the existing QC enforcement tests stay green. Add a harness case `phenotypes-only` in `scripts/analysis-eval/cases.ts` built from the dravet demo case's phenotype note with no variants, expected `awaiting_review`.

## 2. Make case A reliable without loosening the gate (HIGH for the demo)

Live run `scripts/analysis-eval/results/2026-11-02T13-09-55-909Z.json` escalated dravet after three correct refusals: an unbacked "80%", "p.Arg1648His variant is not in any fact", and "no fact states variants[0] gene is SCN1A". In the analysis section of `lib/ai/agents/attma-agent.ts`, add one rule: before writing findings, record an identity fact for every variant and gene the findings will name (for example `variantRanking.variants[0].id` or its HGVS field, and `.gene`), and write no percentage or count that is not a recorded fact. Use the real field names from `lib/rare-disease/` output types. Do not change verify.ts, claims checking, or the refusal limit.

Then add `--repeat N` to `scripts/analysis-eval/run.ts` (runs each selected case N times, prints a pass count per case, e.g. `dravet 3/3`). Keep the existing output file format; one file per invocation with all runs.

## 3. Stop must not lose the analysis (MEDIUM)

In `app/api/chat/route.ts`, `data-analysis` is only written after the agent loop. When Stop aborts the run, the saved assistant message has tool parts but no snapshot, so the next turn starts from zero. Fix in `handleEnd`: if the response parts contain no `data-analysis` part and `analysisSession.checklist` is set, append `{ type: 'data-analysis', data: analysisData() }` to the parts before saving. Test it if the route has a testable seam; otherwise extract the "ensure analysis part" step into a small pure helper and test that.

## 4. Meta Model API best practices (small, visible in the submission)

From dev.meta.ai prompt caching and best-practices pages:
- `promptCacheKey: 'attma-agent'` on the agent's OpenAI Responses provider options (only when Meta is the provider), so related runs hit Muse's prefix cache. `lib/ai/providers.ts` already builds these options near line 261.
- `safetyIdentifier`: sha256 hex of the user id (never the email) for the agent run. If it has to come per request, pass it through `createAttmaAgent` options.
- Confirm both option names in `node_modules/@ai-sdk/openai/dist/index.d.ts` before using them.
- The run summary already prices cached tokens; add the cached-token count to the `data-run` part and show it in the run summary line as "N cached".

## 5. Cost budget stop (guardrail)

Add a stop condition next to `isStepCount(24)` in `attma-agent.ts` that sums `steps[].usage` and stops once the estimated cost passes $1.50 per run (reuse `estimateCostUsd` and the Wonder prices). Unit-test the condition with fake steps. A run stopped by budget must still save its analysis (item 3 covers it).

## 6. Optional, only if 1 to 5 pass the gate: sandbox egress

Check whether the installed `@vercel/sandbox` supports `networkPolicy`. If yes and it is a small change, deny-by-default with an allowlist for the public APIs the tools already call plus PyPI. If it is not small or not supported, skip it and say so.

## Rules and checks

- No new dependencies. No `any`. Comments explain why, sparingly. No `.env*`. No git commits, no pushes.
- Wrap every command in `timeout`. Do not start the dev server.
- Must pass: `timeout 1500 bun --env-file=.env.local run release-gate`.
- Live harness, once at the end (about $1.50): `env -u OPENAI_BASE_URL timeout 1500 bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts --repeat 3 dravet phenotypes-only variants-only-question`. Target: dravet 3/3, the others 3/3. If dravet still escalates, report the refusal texts; do not weaken any check.
- Finish with: per item (1 to 6), files changed and how verified; the harness pass counts and cost; anything unsure.
