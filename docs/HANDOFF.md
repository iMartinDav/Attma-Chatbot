# Attma: handoff

Everything decided and built from October 26 to November 2, 2026, so work can continue on any computer, by a person or by Claude. `CLAUDE.md` at the repo root is the short version that Claude Code loads automatically.

## 1. What Attma is now

A conversational bioinformatics workbench at https://www.attma.bio. A researcher types, dictates (25 languages) or attaches data (VCF, counts table, .h5ad, PDF report, up to 500 MB). One agent plans the analysis, runs each step against real databases and a Python sandbox, shows every step with the model or source that ran it, and answers with citations. Chats keep their files and history, so follow-ups build on earlier results.

What it can do today, end to end in one conversation:

| Workflow | What runs | Typical time |
|---|---|---|
| Single-cell atlas (PBMC 3k or your .h5ad) | Python sandbox (scanpy): QC, Leiden, UMAP, markers, cell types; g:Profiler enrichment | about 2 min |
| Rare disease case review | HPO ranking of 12,900 diseases, Ensembl VEP (gnomAD, ClinVar, AlphaMissense, CADD), Muse Spark literature grading | about 1 min |
| Variant to structure | VEP, UniProt domains, AlphaFold confidence (per-residue via the sandbox), PubMed | about 45 s |
| Gene list enrichment | g:Profiler (GO, Reactome, KEGG, WikiPathways), STRING | seconds |
| Reading a report or figure | Muse Spark vision sub-agent | seconds |

It is research software: it ranks hypotheses for qualified people and never states a diagnosis.

## 2. Why it looks like this (decisions in order)

1. **Dependencies (Oct 26).** The code had not been touched since January. Everything was updated to latest (Next 16.4, React 19.3, AI SDK 7), pnpm replaced by bun, Biome and the FastAPI backend removed (Phase 0). TypeScript stays on 6 and ESLint on 9 because typescript-eslint does not support TS 7 yet; `@tanstack/react-table` stays on v8.
2. **Backend language.** A Rust rewrite was considered and rejected: the work is orchestration and I/O, where TypeScript plus sandboxed Python is faster to build and run. Rust only for a measured hot path. The original plan is the artifact https://claude.ai/artifact/MLG5XsxTWduLuqA7oe2jKz.
3. **Focus for the hackathon.** The full product (clinical genomics with an ACMG engine) lives in the separate `Attma` repo at app.attma.bio. This repo is the chatbot, and for the hackathon it does one thing very well: rare disease first, then general bioinformatics workflows.
4. **Rare disease engine instead of an LLM guess.** External phenotype APIs (Monarch, JAX) rate-limited the first evaluation, so the HPO knowledge is a local index (`lib/rare-disease/data/hpo-index.json`, HPO release 2026-09-01) ranked by Resnik similarity, chosen on a tuning set. Variants go through Ensembl VEP with a retrying, rate-limited client and a 417-variant snapshot for demos.
5. **Honest benchmark.** 169 of the 200 test cases were cited inside HPO itself, so a held-out index removes those annotations. The leakage-free result is what we quote: causal variant ranked first in 50.5% of 200 published cases (63% top-5), against 0% with variant evidence alone. Details: `nextjs-frontend/scripts/rare-disease-eval/README.md`.
6. **Muse everywhere.** Muse Wonder orchestrates, Muse Spark runs sub-agents (documents, literature, title, tool-call repair), Muse Image draws illustrations and the landing photos, Muse Voice Transcribe dictates, Muse search grounding cites the web. That covers the "use of Meta AI tooling" criterion. Muse is reached through the OpenAI provider on the Responses API, the only Meta surface that returns reasoning summaries.
7. **One agent with sources, not a picker of agents.** The old domain router and agent dropdown were replaced by one agent and a Sources menu (connectors). Keyed sources (AlphaGenome) appear locked until the server has the key.
8. **Real compute.** Python runs in a Vercel Sandbox microVM per chat, started from a snapshot with scanpy, pysam, cyvcf2, PyDESeq2, gseapy and AlphaGenome preinstalled, so a step starts in about 0.3 s. Files persist across steps and messages. Figures under 15 MB are published to Blob; larger intermediates stay in the workspace.
9. **Reliability fixes found by testing.**
   - Muse rejects replayed function calls with `store: false`, so history goes back as a text log of steps.
   - Muse sometimes sends empty arguments for parallel tool calls; `repairToolCall` rebuilds them with Muse Spark.
   - PANTHER took 26 to 125 s per request; replaced by g:Profiler (about 1 s).
   - New chats were saved under a server UUID while the URL had the client's, so reload gave a 404; the transport now reads the id from a ref.
   - scanpy saves plots to `figures/`, which was never collected; it now links to `outputs/`.
10. **UI (Oct 27 to Nov 2).**
    - AI Elements for reasoning, steps, tools and sources; ElevenLabs UI's LiveWaveform for dictation.
    - A workflow-first home with an animated helix.
    - A theme pass for WCAG AA with the same mint and navy: sidebar distinct from the page, `primary-ink` for mint text, and 400 lines of dead CSS removed.
    - "Powered by Attma" branding. Step badges still name the Muse model as the technical record.
11. **Voice.**
    - Dictation was silent because Chrome picked Boom 3D's virtual "BoomAudioDevice (Aggregate)", which outputs zeros.
    - It now requests the system default microphone by exact id. Language and microphone are settings in the user menu, and auto-detect is the default.
12. **Landing.**
    - It claimed things the product could not back: invented case studies, invented testimonials, "99.9% accuracy", "1,000+ scientists". All of it was replaced with real workflows and measured numbers, in 7 languages (translated by Muse Wonder).
    - The case photos carried a Grok watermark and were regenerated with Muse Image using the old photo as a style reference.

## 3. Setting up another Mac

```bash
# 1. Tools
curl -fsSL https://bun.sh/install | bash        # bun 1.3.13 or newer
npm i -g vercel                                 # Vercel CLI
# Node 22+ is also needed for some tooling

# 2. Code
git clone https://github.com/iMartinDav/Attma-Chatbot.git
cd Attma-Chatbot/nextjs-frontend
bun install

# 3. Environment (sign in to Vercel when asked)
vercel link --project attma-chatbot
vercel env pull .env.local --environment development
```

Then create `nextjs-frontend/.env.development.local` (gitignored) for local sign-in:

```bash
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

Start it:

```bash
env -u OPENAI_BASE_URL bun dev
```

Check that it works: open http://localhost:3000/chat, sign in, run the "Single-cell atlas" card (proves Muse, the sandbox and Blob), and press the mic (proves Muse Voice).

Environment variables (names only; values come from `vercel env pull`):

| Variable | Needed for |
|---|---|
| `META_MODEL_API_KEY` | All Muse models (chat, sub-agents, image, voice) |
| `ATTMA_SANDBOX_SNAPSHOT` | Python workspace (`snap_kxdx...`, on Vercel for all environments) |
| `DATABASE_URL` and `POSTGRES_*` | Neon Postgres (chats, users) |
| `BLOB_READ_WRITE_TOKEN` | Uploads and published figures |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign-in |
| `VERCEL_OIDC_TOKEN` | Creating sandboxes locally (pulled automatically, expires after hours; pull again if sandbox calls fail with 401) |
| `ALPHAGENOME_API_KEY` | Optional: unlocks AlphaGenome (free for non-commercial use from DeepMind) |
| `PUBMED_API_KEY` | Optional: faster PubMed (10 requests/s instead of 3) |
| `OPENAI_API_KEY` | Fallback only; the current key is invalid and Muse is used whenever `META_MODEL_API_KEY` is set |

To give Claude Code on the new Mac the same context, open the repo there and start a session: it reads `CLAUDE.md` automatically, and this file covers the rest. Claude's local memory folder on the old Mac (`~/.claude/projects/...`) was empty, so nothing else needs copying.

## 4. Where things live

```
nextjs-frontend/
  app/api/chat/route.ts            agent streaming, persistence, run summary
  app/api/transcribe/route.ts      Muse Voice Transcribe
  app/api/files/upload/route.ts    signed browser-to-Blob uploads
  app/api/connectors/route.ts      which sources this deployment can run
  app/[locale]/                    landing page (7 languages)
  lib/ai/providers.ts              Muse models and aliases
  lib/ai/agents/attma-agent.ts     the agent, its playbooks and tool repair
  lib/ai/connectors/catalog.ts     sources shown in the Sources menu
  lib/ai/tools/                    tools (compute, proteins, enrichment, subagents, rare-disease)
  lib/rare-disease/                HPO engine, VEP and PubMed clients, demo cases
  lib/sandbox/python.ts            per-chat Vercel Sandbox runner
  lib/voice/                       languages and clinical vocabulary for dictation
  components/chat/                 chat UI (workflow cards, step timeline, sources, voice)
  scripts/sandbox/build-snapshot.ts      rebuilds the Python snapshot
  scripts/rare-disease-eval/             benchmark data, runner and results
  PRODUCT.md                       product brief for design work
```

`plan.md` and most of `docs/` (Railway, FastAPI, BioFlow) describe the removed backend and are out of date.

## 5. Open work

Hackathon (deadline Nov 4, 2026, 9 PM ET):
- [ ] Record the demo video: single-cell atlas, then a follow-up in the same chat, then the rare disease card, with dictation in Spanish.
- [ ] Write and submit the project description. Frame it as reproducible research workflows; quote the held-out benchmark.
- [ ] Optional: get an AlphaGenome key and add `ALPHAGENOME_API_KEY` on Vercel to unlock the non-coding variant workflow.

Product:
- [ ] Domains: move the chatbot to chat.attma.bio and the main product to attma.bio (needs a CNAME at Namecheap).
- [ ] Decide whether step badges should say Attma instead of Muse model names.
- [ ] Older chats from before Oct 27 show raw tool JSON (old message format); fine to leave or migrate.
- [ ] Optional: migrate the composer to AI Elements Prompt Input; realtime streaming dictation (needs a WebSocket relay).

Account hygiene (only the owner can do these):
- [ ] Rotate the Neon database password and the Blob token: they were in `docker-compose.yml` in git history since May 2025 (private repo).
- [ ] Replace or remove the invalid `OPENAI_API_KEY`.
- [ ] Fix GitHub Actions billing (CI does not run) and shut down the old Railway backend.
- [ ] Remove `export OPENAI_BASE_URL=localhost:20128` from `~/.zshrc` if that local proxy is no longer used.
