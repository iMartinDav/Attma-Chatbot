# Task T13: the biosecurity reviewer agent (branch feat/trust-gate)

Do not edit other files in `docs/muse/`. Stay on `feat/trust-gate`, no commits, no pushes. Run after T12b and T14 are verified.

## Goal

Attma gets a second agent, the **biosecurity reviewer**, that checks the work at fixed checkpoints of every run and can stop it. It is a defensive safety layer, shown in the timeline like any other step, so a judge sees "Biosecurity check: passed (Muse Spark)" before any tool runs. It must never get in the way of normal human-genetics research: every existing demo and harness case must pass it.

## Content rules (non-negotiable)

- No hazardous example text anywhere in the repo: not in the policy, prompts, tests, fixtures, comments or harness. The policy describes categories at a high level only, with no named agents, toxins, methods or sequences.
- Tests that cover the refuse and needs_context paths mock the model's verdict. Their input text is benign ("test request"); only the mocked verdict differs.
- The reviewer never explains how to do the refused thing. A refusal names the policy category and says the request is out of scope for Attma.

## Design

### 1. `lib/biosecurity/` (new)

- `policy.ts`: the reviewer's instructions, a short versioned text (`BIOSECURITY_POLICY_VERSION`).
  - **In scope, accept by default:**
    - human genetics, rare disease, variant interpretation and phenotypes;
    - protein structure and function of human disease genes;
    - literature review, statistics and plotting on the user's own data;
    - general molecular and cell biology education.
  - **Refuse:** requests whose evident aim is meaningful uplift toward causing harm with biological agents or toxins (acquiring, producing, enhancing, or deploying them), or toward evading biosecurity screening. Judge the intent of the whole context, not single words. Words like "pathogen", "virus" or "toxin" alone are never a reason to refuse.
  - **needs_context:** genuinely dual-use work with no stated research purpose. Ask one question about the purpose.
- `screen.ts`: `screenBiosecurity(input)`.
  - It runs `generateText` with `Output.object` on `myProvider.languageModel('subagent-model')`, following the pattern in `lib/ai/tools/subagents.ts`.
  - The schema is `{ decision: 'accept' | 'needs_context' | 'refuse', category: <fixed enum of 5 to 7 high-level category ids, including 'in_scope_research'>, rationale: string (max 300 chars) }`.
  - Input is `{ checkpoint: 'intake' | 'code' | 'report', text: string, context?: string }`, with text capped at 20,000 chars.
  - It returns the verdict plus `model`, `policyVersion` and `durationMs`.
  - On a model error, retry once. If it still fails, return `decision: 'needs_context'` with category `screen_unavailable` and the message "The biosecurity check is unavailable; try again." This fails closed without inventing a refusal.
- Unit tests use a mocked model: an accept, a refuse and a needs_context verdict each map to the right result; an error retries once then fails closed; the input cap holds.

### 2. Checkpoint 1: intake (every user message, before the agent)

- In `app/api/chat/route.ts`, after the approve shortcut and before `createAttmaAgent`, screen the user's message text plus attachment file names (`context`: the last assistant answer, capped at 2,000 chars).
- Write a `data-biosecurity` part `{ checkpoint, decision, category, rationale, model, policyVersion, durationMs }` as the first part of the assistant message, and include it in the trace.
- **accept:** run the agent as today.
- **refuse:** stream one short text ("This request is outside what Attma supports: <category label>. Attma is for human genetics and biomedical research workflows."), run no tools, save as usual.
- **needs_context:** stream the reviewer's one question and stop. The next user message is screened again with that answer as context.
- An approval shortcut (Approve on a report) skips the screen, because it carries no new request.

### 3. Checkpoint 2: code (every Python run)

- In `lib/ai/tools/compute.ts` `runPythonTool`, screen `title + code` with checkpoint `code` before `runPython`. On anything other than accept, the tool throws "Blocked by the biosecurity check: <category label>." and the code does not run. The agent sees the error like any tool error.
- The fixed AlphaGenome script is trusted code and skips this screen. Its spec input is screened at intake through the user's request.
- Record each code verdict so it shows in the trace for that step.

### 4. Checkpoint 3: report (optional, only if 1 to 3 pass the gate)

- In the `submitReport` path, after the claims check passes, screen the answer and findings with checkpoint `report`. A refuse refuses the submit with the category, and the gate's refusal counting applies.

### 5. UI and audit

- **Timeline:** in `components/chat/agent-activity.tsx` and `step-labels.ts`, a step "Biosecurity check" with the decision ("passed", "needs context", "blocked") and "Muse Spark". It is neutral when passed and amber when blocked. Use the existing pill styles, add no new colors, and no em dashes.
- **`/console`:** the trace view lists biosecurity verdicts with checkpoint, decision, category, policy version and time.
- **Persistence:** saved messages keep the `data-biosecurity` parts, so a reloaded chat shows the same check.

### 6. Harness

- In `scripts/analysis-eval/run.ts`, run the intake screen for every case and record the verdict. A case FAILS if its screen is not `accept`; this is the over-refusal check on real research questions.
- Add one benign education case (`biology-education`, e.g. "Explain how missense variants change protein function, with SCN1A as the example"), expected `accept` and answered.
- Do not add any hazardous case.

## Checks

- No new dependencies. No `any`. Comments explain why, sparingly. No `.env*`.
- Wrap every command in `timeout`. Do not start the dev server.
- Must pass: `timeout 1500 bun --env-file=.env.local run release-gate`.
- Live harness once at the end (about $1): `env -u OPENAI_BASE_URL timeout 1500 bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts dravet phenotypes-only variants-only-question biology-education`. Every case must have an `accept` screen and its usual expected status.
- Finish with: per section, the files changed and how each was verified; the harness results and cost, including the screen's added time and cost per run; anything unsure.
