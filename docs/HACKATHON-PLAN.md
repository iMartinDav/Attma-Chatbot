# Attma: the plan to the Nov 4 submission

Written 2026-11-02, 09:00 Paris time. Deadline: **Nov 4, 9:00 PM ET = Nov 5, 03:00 Paris**, about 66 hours from now. This replaces `HACKATHON-WIN-PLAN.md` and the day-by-day plans from the other two LLMs, whose calendars started on Oct 26 and Oct 31 and have already passed.

## 1. The decision in one paragraph

Don't add a new bioinformatics domain. Make the rare-disease workflow that already works **trustworthy and visible**, using the exact pattern Meta teaches in its own workshop (`meta-models/legal-agent-workshop`, session 2). The agent writes a checklist that includes a counterevidence item, records every fact from a tool result, and submits a report. Code then checks every number in that report against the recorded facts and refuses it if anything doesn't match. A report that passes waits for a person to approve it. That's one feature, built inside the chat that already exists, demonstrated on three prepared cases. Everything else (somatic, infectious, FASTQ, fine-tuning, ACMG) goes on the roadmap slide, not in the build.

Why this and not something bigger:
- It is what the judges were taught to look for. The workshop's whole second session is checklist, verification in code, escalation and sign-off, so a judge will recognize it right away.
- It fixes the real weakness. Today the agent prompt says "carry it out without waiting for approval" (`lib/ai/agents/attma-agent.ts:124`), and nothing in the code checks that a number in the answer matches the tool that produced it.
- It fits in about 1.5 days of building, on top of tools that already work: HPO ranking, VEP, PubMed, the sandbox, Muse routing, the step UI and the three demo cases.

## 2. What the three analyses got right and wrong

| | Keep | Throw away |
|---|---|---|
| **LLM A** (long plan + diagram) | One vertical; checklist + code verification + sign-off; honest held-out numbers; a pre-computed demo; a freeze day; observability as a loop. Its summary of the workshop matches the code I read. | Its schedule (Day 0 = Oct 31). Too much scope for 66 h: trace endpoint, QC tool, native Responses persistence, cost sweep. **VAF/depth checks**: the tool takes `chr-pos-ref-alt` strings with no genotype, so there is no VAF to check. **"Shortlist from 20k+ variants"**: the tool caps input at 200 variants, and the benchmark is 1 causal variant among 20. |
| **LLM B** (Hermes, `HACKATHON-WIN-PLAN.md`) | Escalation when evidence is missing; showing the trace. | **"Signed diagnosis", "differential diagnosis", "clinician"**: that's medical-advice framing, the thing to avoid. A separate Agent Console page duplicates the chat UI. Checking the checklist against ground truth only works on benchmark cases, never on a real user's case. The list of "15 papers" is unverified, and some may not exist. The "multi-agent" relabel. The invented demo patient. |
| **Diagram explanation** | Instrument → observe → evaluate → gate, as a loop that blocks release. | Building it as its own system. Here it reduces to: per-step model/effort/tokens in the run card, offline tests, and a gate checklist before the push. |

## 3. Facts checked today (and what is NOT verified)

**Checked:**
- The GitHub repo `iMartinDav/Attma-Chatbot` is **private**, so a judge clicking the link gets a 404. History still holds the Neon password and Blob token from `docker-compose.yml` (since May 2025), so making it public without rotating them leaks live credentials.
- Benchmark (`scripts/rare-disease-eval/README.md`), held-out: causal variant among 20 candidates, top-1 **50.5%**, top-5 **63%**, MRR 0.580 with phenotypes, against 0% top-1 from variant evidence alone. Causal *gene* from phenotypes alone, top-1 20%; 44 of the 200 genes have no annotation left to rank.
- The Meta Model API docs (dev.meta.ai):
  - `none` effort returns 400. `max` exists only on Wonder 1.0 and Spark 1.3.
  - `tool_choice` accepts only `auto`. `parallel_tool_calls` is supported.
  - Structured output uses `text.format`.
  - Standard mode does not train on your data. **Contributor** mode (`-contributor` model ids) does, so it must never see genomic data.
  - Prices per 1M tokens: Spark 1.3 $1.25 in / $4.25 out; Wonder 1.0 $4.00 / $20.00. Web search costs $2.50 per 1k queries.
- Replaying tool calls with `store: false` **does** work: the workshop's loop does it on every turn. The 400s Attma hit come from rules in the docs: an intermediate assistant text before a `function_call` needs `phase: "commentary"`, every `call_id` must be paired, and a reasoning item must be followed by a call or a message. That's a fix for after the hackathon; the text log stays for now.

**Not verified:**
- The judging weights "Impact 30 / Meta tooling 25 / demo 25 / technical 20" and the "skip list" come from a third-party summary (reconscribe.com), not from the official page. The public page gives only the tracks: **Indie** = "creativity, technical ambition, and whether it works", **Startup** = "technical execution and whether it holds up in production". The Official Rules (video length, required fields, whether the repo must be public, rules on health data) are not public. Read them in the participant portal or on Discord before anything else (step 0.1).

## 4. Schedule (Paris time)

### Block 0, Mon Nov 2 morning (about 3 h, mostly you)

0.1 **Read the Official Rules** in the participant portal or Discord: submission fields, video length, repo requirements, whether a live URL is required, health-data rules. Paste them to Claude. If they contradict this plan, the rules win.
0.2 **Pick the track and theme.** Recommended: **Indie** (you're solo). For the theme, **Build for Your World** ("a problem you know firsthand") fits a bioinformatician better than Push the Frontier.
0.3 **Make the repo safe to share.** Rotate the Neon password and the Blob token, then update them on Vercel (only you can). Run a secret scanner over the full history (`gitleaks detect`) to catch anything else. Then make the repo public, or publish a fresh public repo with clean history. Check the link from a logged-out browser.
0.4 **Run the app on this Mac:** create `nextjs-frontend/.env.development.local` (three lines, see the handoff), run `bun dev`, and run all three demo cards plus the single-cell card once. This Mac has no `OPENAI_BASE_URL` problem.

### Block 1, Mon Nov 2 afternoon to night: the trust gate, core (Claude builds, test first)

Three new agent tools in an always-on "analysis" connector, plus a verifier. They follow the workshop's rules, adapted to genomics:

1. **`setChecklist`**: 4 to 8 items, each one answerable question. Code rejects a checklist without a **counterevidence** item (for example: does any variant have conflicting ClinVar, high gnomAD frequency or a benign AlphaMissense call?) and without a **phenotype match** item.
2. **`recordFact`**: a fact names a checklist item, the tool step that produced it, the field and the value. Code accepts it only if the value equals that field in that step's saved output (normalized string or number compare). At most 3 facts per item. A refusal says what to fix.
3. **`submitReport`**: the only way to finish an analysis. Checks run in a fixed order:
   1. Zod schema.
   2. Deterministic rules: every item is proven or named as a gap; every proven finding cites 1 to 3 recorded facts; every number in the text matches a recorded fact; the counterevidence finding is present; the research-use line is present.
   3. One Muse Spark (low) claims check: does each finding's facts support it?
   - Refused → the agent fixes it. After 3 refusals the run escalates to you.
   - Passed → status `awaiting_review`, and the loop stops.
4. **`requestInput`**: allowed only when an item can't be settled from the data given. It names exactly one missing thing (for example, "no phenotypes provided") and the run pauses.
5. Prompt change: replace "carry it out without waiting for approval" with "checklist first, record facts from tool results, finish only with submitReport".

Done when offline Jest tests pass:
- A fake report with one altered CADD or gnomAD number is refused, naming the field.
- A report without a counterevidence finding is refused.
- A run without phenotypes ends in `requestInput`.
- A correct report reaches `awaiting_review`.

### Block 2, Tue Nov 3: make it visible, then deploy

1. **Rendering in the chat** (`components/chat/agent-activity.tsx`): checklist card with items turning proven or gap; refusal step shown in amber with its reason; final **"Awaiting your review"** card with Approve / Request changes. Approve marks the report as reviewed with no model call. Request changes sends your notes as the next message.
2. **Run card** (extend `data-run`): per step, which model and effort ran, tokens, and an estimated cost from the prices above. This is the visible "use of Meta tooling": Spark for titles, sub-agents and the claims check; Wonder for orchestration.
3. **Three demo cases** (existing `demo-cases.ts` and VEP snapshot, so the demo never waits on live Ensembl):
   - A, solved: Dravet / SCN1A ranks first and passes review.
   - B, counterevidence: a decoy with conflicting ClinVar or high gnomAD frequency must show up as counterevidence, not as the answer.
   - C, incomplete: variants without phenotypes stop at `requestInput`.
4. **Gate before pushing:** lint, `format:check`, `tsc`, tests, `build:skip-migrate`. Push (that deploys production), then run A, B and C on www.attma.bio.
5. **Cut line, Tue 20:00:** if the review card isn't solid, ship the verifier and refusals without it. If the verifier isn't solid either, record the current product as it is. It already works.

### Block 3, Wed Nov 4: freeze, record, submit

- 09:00 to 14:00: fixes only, nothing new. **14:00 feature freeze.**
- 14:00 to 18:00: record the video (script in §5), with a fallback take of each segment.
- 18:00 to 21:00: write the submission (§6), check every link logged out, and confirm the Vercel prod deploy is green.
- **Submit by 22:00 Paris** (5 h before the deadline). Save a copy of the text and the video link.

## 5. Demo video (aim for about 2:30; trim to the rules' limit)

1. **0:00 to 0:20, the problem.** A rare-disease case comes with many candidate variants and a few clinical findings. Ranking them by hand means checking HPO, ClinVar, gnomAD and the literature for each one.
2. **0:20 to 1:10, case A, dictated in Spanish.** The checklist appears, then HPO ranking, VEP, the literature sub-agent, and each fact recorded against an item.
3. **1:10 to 1:40, the trust gate.** Show a refusal: either a real one from the run, or case B, where the counterevidence item catches the decoy. Then "Awaiting your review", and Approve.
4. **1:40 to 2:00, case C.** The agent asks for exactly one missing thing instead of guessing.
5. **2:00 to 2:30, why it's credible.**
   - The run card: Muse Wonder and Spark per step, with tokens and cost.
   - The held-out benchmark, said precisely.
   - Roadmap: the same contract for somatic and infectious. Then a 10-second flash of the single-cell atlas for breadth.

## 6. Submission text: rules for wording

- Say it ranks hypotheses and evidence for qualified researchers, with every claim checked against a recorded fact. Never "diagnosis", "clinical decision" or "for patients".
- Benchmark sentence: *"On 200 published solved cases, each with 19 decoy variants, Attma ranked the causal variant first in 50.5% and in the top 5 in 63%. That's after removing every HPO annotation that came from those same papers, to avoid leakage. With variant evidence alone, top-1 is 0%."* Don't quote the 82% full-release number without the leakage note.
- Limitations, stated plainly: up to 200 candidate variants (no full-exome VCF yet), no FASTQ pipeline, no ACMG classification, human review required.
- Meta tooling used: Muse Wonder (orchestration), Muse Spark (sub-agents, claims check, titles, tool-call repair), Muse Voice Transcribe (25 languages), Muse Image (landing art), web search grounding, Responses API with `store: false`.

## 7. Explicitly not before Nov 4

Somatic and infectious pipelines; FASTQ or Nextflow; an ACMG engine; any fine-tuning; a native Responses replay rewrite; a separate console page; new database tables; renaming this "multi-agent".

## 8. After the hackathon: the SeqOne-style roadmap

Same contract for every product: job spec → QC JSON → annotation JSON → checklist → verified report → sign-off.

| Pillar | First product | What it needs that Attma lacks |
|---|---|---|
| **Germline** (now) | Tertiary analysis, like GermVar Tertiary | Full-exome VCF upload, prefiltered in the sandbox (cyvcf2: quality, frequency, consequence) down to the 200 the ranker takes; trio/PED for de novo and compound het; CNVs. |
| **Somatic** | Tumor VCF annotation, like SomaVar Tertiary | CIViC/OncoKB evidence, tumor-only filtering, TMB and MSI from the VCF. |
| **Infectious** | Viral or bacterial ID + AMR from reads | Kraken2/Bracken, AMRFinderPlus and assembly. These need minutes and GBs of databases, so a real job runner (Modal, which is a hackathon partner, or nf-core on batch compute), not the 150 s sandbox. |
| **Primary analysis** | FASTQ → VCF | nf-core/sarek or DeepVariant on GPU/batch compute; Attma orchestrates and reads the QC JSON. |

The ACMG engine already exists in the separate `Attma` repo. Expose it as an API and add it as one more connector, rather than rebuilding it here.

## 9. The fine-tuning question ("our own ClinVar model")

- **Don't train a pathogenicity classifier on ClinVar labels.**
  - Strong open predictors already exist: AlphaMissense, already in Attma via VEP; CADD and REVEL; ESM-based scores; popEVE; Evo 2; SpliceAI; AlphaGenome for non-coding variants.
  - Training on ClinVar and testing on ClinVar is circular, so the benchmark would flatter it.
  - ClinVar is biased toward well-studied genes and populations.
  - Attma's value is combining and explaining evidence, not adding one more score.
- **OpenMed** (Hugging Face, Maziyar Panahi) publishes 2,200+ Apache-2.0 models for clinical NER and PII de-identification, and no variant classifiers. It's useful in two places: scrubbing identifiers from uploaded reports before they reach the model, and extracting genes and diseases from clinical notes.
- **A fine-tune that would help, and is free this month:**
  - Offer: Fireworks trains **Muse Glimmer 30B** (Meta open weights, Apache 2.0) with LoRA SFT for free for jobs started before **2026-12-01**. Serving the tuned model is billed per GPU-hour.
  - Good targets are narrow and checkable:
    - (a) clinical text → HPO term IDs, trained from phenopacket-store and HPO synonyms. This directly improves the ranker's input.
    - (b) extracting ACMG evidence (functional data, segregation, case counts) from paper abstracts into a strict schema, trained on ClinGen expert curations.
  - Hold out by gene and by paper when evaluating. December work, not this week.

## 10. Who does what

- **Only you:** the Official Rules, the track and theme choice, rotating credentials and making the repo public, Vercel env changes, recording the video, pressing submit.
- **Claude:** Blocks 1 and 2 (code and tests), the deploy checks on www.attma.bio, the video script and submission draft, the description text in all its claims.
