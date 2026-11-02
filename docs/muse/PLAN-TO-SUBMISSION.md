# Plan to submission (written Nov 2, deadline Nov 4, 9 PM ET)

Muse writes the code from the briefs. Claude reviews each result in the code, runs the release gate and the live harness, and checks the browser. Nothing merges to `main` (which deploys) without Martin's go-ahead.

## What we build now, in order

| Order | Brief | What it adds | Muse time | Verify time | Why now |
|---|---|---|---|---|---|
| 1 | T12b | Budget cap by cost, cached tokens shown, `--repeat 3` harness | ~30 min plus ~$1.50 of runs | 15 min | The token cap can stop the Dravet demo; we need a measured pass rate |
| 2 | T14 | Sandbox network allow-list | under 1 h | 20 min | Closes the open-egress finding; one option on an existing call |
| 3 | T13 | Biosecurity reviewer agent: intake, code and report checkpoints, timeline step, `/console`, harness | 2.5 to 3.5 h | 45 min | New Muse Spark role, a visible safety step, no over-refusal on research cases |
| 4 | none | Browser QC: cases A, B, C, approve, Stop, 375 px, light mode, biosecurity step | none | 45 min | Every item must be seen working, not only tested |
| 5 | none | Commit, merge to `main` (deploys), rerun A, B and C on www.attma.bio | none | 30 min | Only on Martin's go-ahead |
| 6 | none | Video (about 3 min), README, submission text | none | Martin | 25% of the score |

T12b and T14 touch different files, so one Muse run can do both, one after the other.

## Timeline

- **Nov 2 evening:** T12b and T14, then review and commit.
- **Nov 3 morning:** T13, then review, harness and commit.
- **Nov 3 afternoon:** browser QC, then merge and deploy (go-ahead), then the production check.
- **Nov 3 evening to Nov 4:** video, README, submission. Rotate the Neon and Blob keys, make the repo public, and submit before 9 PM ET.

## How each piece scores on the rubric

- **Impact (30%):** reproducible rare-disease workflows with held-out numbers (top-1 50.5%, top-5 63%), plus a biosecurity check that keeps the agent from being misused. That is responsible bio AI, not just a faster search.
- **Meta AI tooling (25%):** each model has a clear job.
  - Muse Wonder runs the agent.
  - Muse Spark checks claims and runs the biosecurity reviewer.
  - Spark also writes titles.
  - Muse Voice handles dictation.
  - Muse Code wrote the branch from the briefs in `docs/muse/`.
  - We follow Meta's own practices: prompt cache key, hashed safety identifier, stateless Responses with encrypted reasoning.
- **Demo (25%):** one take through case A. It should show the biosecurity check passing, the checklist, the QC step, a real refusal, the report, then Approve and reload. Then case C (asks for phenotypes), the `/console` trace, and phone width.
- **Technical depth (20%):** two agents with separate duties, a deterministic number check, a Spark claims check, a QC hard stop, a sandbox allow-list, a cost budget, frozen approvals, a per-step trace, and a repeat-run harness with pass rates.

## Roadmap (said in the submission, not built now)

| Item | Real effort | Why later |
|---|---|---|
| Vercel Workflows / WorkflowAgent: durable runs that survive restarts and long human approvals | Days: replaces the agent loop, the chat route and tool context | Too large for the deadline; runs today finish in under 2 minutes |
| Vercel Connect: researchers connect their own data (Notion, Snowflake, Box and others) | Half a day for one shared connector; more for per-user linking | Good next feature; not needed for the demo cases |
| Resumable streams | Needs Redis and a stream id column | Same reason as Workflows |
| Sandbox credential injection (keys never enter the VM) | Small on the Pro plan | Plan dependent |
| BioSecBench-Refusal evaluation of the reviewer | Needs the full set from LatchBio (only 2 of 107 tasks are public) | Request access after the hackathon |
| eve, Passport | eve is a second agent runtime (rewrite); Passport is Enterprise-only and gates the whole site | Do not fit a public demo |

## Honest claims only

- Say "screens every request and every code run against a biosecurity policy, with zero blocks on our research cases".
- Do not claim a benchmark score.
- Do not claim the screen catches everything.
- Review is single-user.
- The run lock is per server instance.
