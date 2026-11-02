# Task T5: make the trust gate visible, and let a person approve or ask for changes

You are in `nextjs-frontend/` of Attma. Read `../CLAUDE.md` (especially the theme rules: `text-primary-ink` for mint text, don't fade `text-muted-foreground`, surfaces sidebar < page < card < popover, no em dashes in UI copy) and `nextjs-frontend/PRODUCT.md` (show the work, neutral interface where results carry the color, no diagnosis language). Then read `lib/analysis/` and `scripts/analysis-eval/` (the gate now passes 4 of 4 live cases), `components/chat/agent-activity.tsx`, `components/chat/message.tsx`, `components/chat/chat.tsx`, `app/api/chat/schema.ts`, `app/api/chat/route.ts`, `lib/types.ts`. Use the existing components (shadcn/ui and AI Elements already in the repo) and match the current look; do not invent a new visual style.

## 1. Steps in the timeline (`agent-activity.tsx`)

`describeStep` and `runnerOf` must handle the four analysis tools with short labels:
- `setChecklist`: "Set a checklist of N questions" (refused: "Checklist refused").
- `recordFact`: "Recorded <path> = <value> for <item>" (refused: "Fact refused"). Consecutive recordFact steps may be grouped like consecutive web searches already are ("Recorded 6 facts").
- `submitReport`: "Report checked: passed" / "Report refused (k of 3)". Show refusal problems under the step in an amber, readable style (use an existing warning color token; check AA contrast in light and dark).
- `requestInput`: "Asked for: <missing>".
Runner badge: these run in code, so label them "Attma checks" (the claims check inside submitReport runs Muse Spark; say "Code + Muse Spark" for submitReport).

## 2. The analysis card (new `components/chat/analysis-card.tsx`)

Rendered from the message's `data-analysis` part (latest one in the message), placed where the final answer goes. Contents:
- Status pill: Collecting / Needs input / Awaiting your review / Approved / Escalated to you.
- The checklist: each item with its question, its kind (counterevidence highlighted), and the finding (proven / gap) with its cited facts shown compactly as `path = value (ref)`.
- The report's answer (2-3 sentences) and gaps.
- A fixed line: "Research use only. Ranks evidence for a qualified reviewer; not a diagnosis."
- If `needs_input`: the requested item and a hint to reply in the composer.
- If `awaiting_review`: two buttons, **Approve** and **Request changes** (the second opens a small textarea for notes, then sends).
- If `escalated`: say the agent was refused 3 times and needs guidance; show the last problems; the reply goes through the composer.
- Accessible: buttons are real buttons with labels, keyboard focus visible, works at 375 px width.

## 3. Review decisions, end to end

- `app/api/chat/schema.ts`: optional `review: { decision: 'approve' | 'changes', notes?: string }` in the request body.
- Client: Approve calls `sendMessage` with a user text "Approved the report." and `body: { review: { decision: 'approve' } }`; Request changes sends "Requested changes: <notes>" with `review: { decision: 'changes', notes }`. Find how `chat.tsx` passes body fields through `prepareSendMessagesRequest` and follow that.
- `lib/analysis`: add status `approved`; `session.approve()` allowed only from `awaiting_review` (otherwise a no-op refusal); tests.
- Route: when `review.decision === 'approve'` and the session is `awaiting_review`, do **not** call the model: save the user message and an assistant message containing only the updated `data-analysis` part (status `approved`) and a short reply text "Approved." Follow the existing save path (`onEnd`), don't duplicate it. When `decision === 'changes'`, reopen (already implemented) and run the agent normally; the notes are the user message.
- Approve must work after a reload (the status comes from saved messages).

## 4. Run card cost

In the route's existing `data-run` part add `costUsd` (estimate) computed from the agent usage with the same prices as `scripts/analysis-eval` (move the price table and the cost function into `lib/ai/pricing.ts` and use it from both places). Show it in the run summary in `agent-activity.tsx` as "~$0.21" next to tokens, with a title attribute saying it is an estimate at Meta Model API Standard prices and excludes sub-agent calls.

## Rules

- No `any` in new code; comments explain *why*, sparingly; no new dependencies; no `.env*`; no git commits.
- Unit tests: `session.approve()`, schema accepts/rejects `review`, `describeStep` labels for the four tools (export a pure helper if needed), the pricing function.
- Must pass: `bun run test -- lib/analysis lib/ai components/chat`, `bunx tsc --noEmit -p .`, `bunx eslint` on touched files (zero errors), Prettier on touched files (leave `app/api/chat/schema.ts`'s pre-existing formatting issue only if you don't touch it; if you touch it, format it). `bun run build:skip-migrate` must succeed (it needs no secrets; if it fails only for a missing env var, say which).
- Do not start the dev server and do not call the Model API. The senior engineer will test the UI in the browser.
- Finish with: files changed, a short description of the card, and anything unsure.
