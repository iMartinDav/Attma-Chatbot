# Task T5b: finish T5 (one review fix + tests)

You are in `nextjs-frontend/` of Attma. Your T5 work (analysis card, step labels, review flow, pricing) is in the working tree and was reviewed: tsc, eslint, the production build and 89 tests pass. One bug and one test gap remain. Small task: keep it tight.

## 1. Bug: stale review buttons on older cards

Every assistant message whose saved `data-analysis` part has status `awaiting_review` shows live Approve / Request changes buttons forever, even after a later message approved the report or reopened the analysis. Only the newest analysis in the whole chat may offer review actions.

Fix: in `components/chat/messages.tsx`, find the id of the last message (in the `messages` array) that contains a `data-analysis` part, and pass `onReview` only to that message (others get `undefined`). Put the "find last message with a data-analysis part" logic in a small pure exported helper (for example in `components/chat/step-labels.ts` or a new tiny file next to it) and unit-test it: no analysis → null; two messages with analysis → the later id; a user message after it does not change the result.

Older cards still render (status pill, checklist, findings), just without buttons.

## 2. Test the card (React Testing Library, already set up for jsdom)

`components/chat/__tests__/analysis-card.test.tsx`:
- awaiting_review with `onReview`: Approve calls `onReview('approve')` once and the buttons are replaced by "Decision sent."
- Request changes opens the textarea; the send button is disabled while notes are empty; typing notes and sending calls `onReview('changes', '<notes>')`.
- awaiting_review without `onReview`: no buttons.
- needs_input shows the requested question; escalated shows the last problems.
- The research-use line is always present.

Use a small fixture built from the types in `lib/analysis/types.ts`.

## Rules

- No `any` in new code; comments explain why, sparingly; no new deps; no `.env*`; no git commits.
- Run ONLY these commands, each with a timeout: `timeout 300 bun run test -- components/chat lib/analysis app/api/chat lib/ai`, `timeout 300 bunx tsc --noEmit -p .`, `timeout 120 bunx eslint <touched files>`, `timeout 60 bunx prettier --write <touched files>`.
- Do NOT run `bun run build` or `build:skip-migrate` (the senior engineer runs it), do not start the dev server, do not call the Model API.
- Finish with: files changed and the test results.
