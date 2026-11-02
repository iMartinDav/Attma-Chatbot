# Task T11: fix what the browser QC found (Nov 2, branch feat/trust-gate)

This is NOT the T10 list. T10 (production pass) is done and committed as `5c86e7b`. This brief comes from a separate QC run in a real browser against real Muse; none of its items are fixed yet. Do not edit or rename other briefs in `docs/muse/`.

You are in `nextjs-frontend/` of Attma, on branch `feat/trust-gate` (never `main`). Read `../CLAUDE.md`, `../PRODUCT.md`, `../docs/muse/README.md` and `../docs/HACKATHON-PLAN.md` §4 Block 2 and §5 first.

**What already works (do not change it):** the "Undiagnosed patient" card runs the dravet case; checklist, variant QC, HPO ranking, literature sub-agent and 14 recorded facts; one real refusal ("number 80% has no cited fact") then a passed report; the analysis card with cited facts, gaps and the research-use line; Request changes produces a revised report and removes the buttons from the older card; Approve marks it Approved with no model call and survives a reload; run summary shows "~$0.25". Desktop dark mode looks right.

Fix these, in this order. Each fix gets a test where it is logic, and a short note of how you verified it where it is UI.

## 0. The per-chat run lock must always release (T10 regression risk)

`app/api/chat/route.ts` adds `chatId` to `inFlightChats` and deletes it only in `handleEnd`. Verify in the AI SDK source (`node_modules/ai`) whether `onEnd` runs when the client aborts (the user presses Stop or closes the tab) and when `execute` throws. If any path can skip it, the chat stays locked and every later message gets `bad_request` until the server restarts, which would break a live demo. Make release unconditional: store a start time per chat and treat a lock older than the route's `maxDuration` as free, and also release on the request's abort signal. Unit-test the lock helper (acquire, release, stale lock is free). Return a clear message for a real concurrent run ("This chat is still running. Wait for it to finish."), not a generic bad request.

## 1. `/console` is a 404 (bug)

`proxy.ts:27` lists only `['/chat', '/settings']` as non-localized app routes, so `/console` is redirected to `/en/console`, which does not exist. Add `'/console'`. Add a test if the proxy has tests; otherwise state how you checked the redirect logic.

## 2. Phone layout overflows (bug)

At 375 px the page lays out at 672 px: the user's message bubble (`components/chat/message.tsx`, the user text part) does not wrap long unbroken tokens such as `ENSP00000501589.1:p.Arg1648His` or `NM_000546.6:c.215C>G`, which widens everything. Make user and assistant text wrap long tokens (`[overflow-wrap:anywhere]` or `break-words` on the message text container; keep normal word wrapping for prose). Also check the step timeline rows and the analysis card's fact lines at 375 px. Result must be: `document.documentElement.scrollWidth === innerWidth` at 375 px.

## 3. "Differential diagnosis" heading violates the product rule

`components/chat/rare-disease-results.tsx:100` and `:156` label the HPO ranking "Differential diagnosis". Rename to "Disease ranking by phenotype". Grep the whole app (components, lib, app, dictionaries, prompts) for other user-visible "diagnos" wording and replace it unless it is the negation ("not a diagnosis"). Do not touch the tool name `rankDiagnoses` (it is an API name).

## 4. Raw tool rows repeat the timeline

The message body shows `setChecklist Completed`, `checkVariantInput Completed`, `recordFact Completed` (13 rows) and `submitReport Completed`, which duplicates the timeline ("Recorded 14 facts") and looks like debug output. In `components/chat/message.tsx`, do not render tool parts for the analysis tools (`setChecklist`, `recordFact`, `submitReport`, `requestInput` and the variant QC tool) as generic tool rows; the timeline and the analysis card already show them. Keep them in the saved parts (the gate restores from them).

## 5. Older cards still say "Awaiting your review"

After a later card is approved or a revised report replaces it, older cards keep the "Awaiting your review" pill. Show older cards with a neutral "Superseded" pill (still readable, no buttons). Only the newest analysis card shows its real status. Reuse `lastAnalysisMessageId` from `step-labels.ts`; unit-test the pill choice as a pure helper.

## 6. Case C must stop and ask (plan §4 Block 1, demo §5 step 4)

In the browser, "Exome candidate variants for a patient, no clinical findings are available yet: ENSP00000501589.1:p.Arg1648His, rs1801133, NM_000546.6:c.215C>G. Which variant explains the case?" did NOT call `requestInput`; it produced a variants-only report with phenotype match as a Gap. The harness case `dravet-no-phenotypes` passes only because its wording differs. Change the agent instructions (analysis section of `lib/ai/agents/attma-agent.ts`) so that when the question asks which variant explains a case and no phenotypes or clinical findings are given, the agent sets the checklist and then calls `requestInput` for the phenotypes before running any ranking. Add this exact wording as a harness case `variants-only-question` in `scripts/analysis-eval/cases.ts` (expected `needs_input`). Also add an instruction: never write internal fact ids (f1, f13) or refs (r1) in findings, answer or gaps.

## 7. Demo resilience: UniProt failed once

The protein lookup (UniProt REST, `lib/ai/tools/proteins.ts`) failed twice in one run ("Looking up SCN1A in UniProt and AlphaFold DB failed: <long URL>") and worked minutes later. It already has a 15 s timeout; add one retry with a short backoff on network errors, timeouts and 5xx, and a short error text without the full URL ("UniProt did not respond; try again"). Keep it small. Unit-test the retry with a mocked fetch.

## 8. Optional, only if 0 to 7 are done and the gate passes: a starter card for case C

Add a second rare-disease starter card in `components/chat/empty-state.tsx` that sends the variants-only question from item 6, so the demo can show "Needs input" with one click. English copy, no em dashes; if the empty state reads strings from dictionaries, add the string to all 7.

## Rules and checks

- No new dependencies. No `any`. Comments explain why, sparingly. No `.env*`. No git commits, no pushes, stay on `feat/trust-gate`.
- Wrap every command in `timeout`. Do not start the dev server.
- You may run the live harness once at the end for `dravet` and `variants-only-question` only (about $0.40): `env -u OPENAI_BASE_URL timeout 900 bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts dravet variants-only-question`.
- Must pass: `timeout 1500 bun --env-file=.env.local run release-gate` (the 6 known failures in hero-input and useTypingEffect are reported separately by the gate).
- Finish with: per item (0 to 8), files changed and how it was verified; the harness verdicts and cost; anything unsure.
