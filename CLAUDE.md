# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Attma (attma.bio) is a Next.js app where one AI agent on Meta's Muse models turns a researcher's biology question into a reproducible workflow: it plans the work and runs each step with real tools (HPO, Ensembl VEP, UniProt/AlphaFold, PubMed, g:Profiler, STRING, a Python sandbox, AlphaGenome). Then it reports what the data show and cites a source for each claim. All the code lives in `nextjs-frontend/`. The repo root only holds `docker-compose.yml`, a `Makefile` wrapper, `vercel.json` and docs. `PRODUCT.md` sets the product voice and design principles: show the work, no diagnosis or patient-facing language, and a neutral interface where results carry the color.

Production is https://www.attma.bio (Vercel project `attma-chatbot`, team `martin-davila-s-projects`). Read `docs/HANDOFF.md` for the full history: what was built, why each decision was made, the benchmark, and open work. `plan.md` and most of `docs/` (Railway, FastAPI, BioFlow) describe the removed backend and are out of date.

## Hackathon context

Built for the Meta Global AI Developer Hackathon (build window ends Nov 4, 2026, 9 PM ET). Judging: Impact 30%, use of Meta AI tooling 25%, demo 25%, technical depth 20%. Meta's skip list includes "AI-generated medical advice", "basic RAG", "simple image analyzers" and "dashboards as the main feature", so Attma is framed as reproducible research workflows, never as diagnosis. Keep it that way in copy and prompts.

## Commands

Run these from `nextjs-frontend/`, using bun (pinned to `bun@1.3.13`; never npm or pnpm) and Node 22+.

```bash
bun install
vercel link --project attma-chatbot && vercel env pull .env.local --environment development   # once per machine
bun dev                          # http://localhost:3000 (see OPENAI_BASE_URL below)
bun run lint                     # ESLint, zero errors required (lint:fix to fix)
bun run format:check             # Prettier (format to write)
bunx tsc --noEmit -p .           # type check (run by pre-commit, not by a package script)
bun run test                     # Jest (jsdom + ts-jest)
bun run test -- lib/utils/__tests__/text.test.ts    # single file
bun run test -- -t "name of the test"               # single test by name
bun run build:skip-migrate       # production build without touching the DB (what CI runs)
```

- `bun run build` runs `tsx lib/db/migrate` first. That applies pending migrations to the `POSTGRES_URL` in `.env.local`, so locally prefer `build:skip-migrate`. Vercel runs the full `build` on every push to `main`, which deploys production.
- Schema changes: edit `lib/db/schema.ts`, run `bun run db:generate` to write SQL into `lib/db/migrations/`, then run `bun run db:migrate`. Commit the generated SQL and the `meta/` files.
- Pre-commit (`.pre-commit-config.yaml`) runs ESLint, `prettier --check` and `tsc --noEmit`. It also blocks files over 500 KB, except `bun.lock`.
- Tests sit in `__tests__/` and `lib/**/__tests__/`. Jest maps `@/components`, `@/app` and `@/lib`.
- Local Postgres instead of Neon: `docker compose up db` from the repo root.

## Things that will bite you

- If the shell exports `OPENAI_BASE_URL` (one of the Macs has `OPENAI_BASE_URL=localhost:20128` in `~/.zshrc`), it hijacks the OpenAI SDK that Muse goes through. Start the dev server with `env -u OPENAI_BASE_URL bun dev`.
- Local login: `.env.development.local` (gitignored) must set `NEXTAUTH_URL` and `AUTH_URL` to `http://localhost:3000` and `AUTH_TRUST_HOST=true`. `NEXTAUTH_URL` exists on Vercel for Production only.
- Python steps need `ATTMA_SANDBOX_SNAPSHOT` (set on Vercel for all environments) and a fresh `VERCEL_OIDC_TOKEN`, which expires after hours; pull env again if sandbox calls fail with 401.
- Chrome may pick a silent virtual mic (Boom 3D's "BoomAudioDevice"); dictation asks for the system default by exact id for that reason. Don't switch it back to `deviceId: { ideal }`, which Chrome ignores.
- Theme: mint as text uses `text-primary-ink` (passes AA on light); `text-primary` is for fills. Don't fade `text-muted-foreground` below 100%. Surfaces step sidebar < page < card < popover.
- Never commit secrets. `.env*` files are gitignored. Never print key values in logs or chat.

## Architecture

Stack: Next.js 16.4 (Turbopack), React 19, AI SDK 7 (`ai` 7.0.x, `@ai-sdk/openai` 4.x). TypeScript 6, ESLint 9 and `@tanstack/react-table` v8 are pinned on purpose, because newer majors break typescript-eslint or the tables.

### Chat request → agent → stream

`app/api/chat/route.ts` is the only chat entry point. Every message goes to a single agent:

1. The route authenticates the user with Auth.js (`app/(auth)/auth.ts`). For a new chat it saves the chat with a generated title in parallel with the run, so title generation stays off the critical path. Chats are saved under the client's chat UUID, so a reload finds them.
2. It replays earlier messages to the model as **plain text**. Each saved tool part becomes an `[Earlier step: <tool>] Input/Result` log, clipped to a size limit. The Muse Responses API runs with `store: false` and rejects replayed `function_call` items, so don't switch this back to structured tool messages.
3. `createAttmaAgent` (`lib/ai/agents/attma-agent.ts`) builds an AI SDK `ToolLoopAgent` (24-step cap). Its tools come from the **connectors** the user enabled in the Sources picker. It also builds the system prompt from each enabled connector's playbook line; the prompt says it is Attma, not Muse. A `repairToolCall` hook rebuilds tool calls that Muse streams with empty arguments.
4. The route forwards parts to the client as UI message parts (`tool-<name>`, reasoning, sources). It then appends a `data-run` summary part: model, duration, tool-call count and tokens.
5. `onEnd` saves the user message and the full assistant `parts`, so a reloaded chat shows the same workflow. If the run produced no text or tool parts, only the user message is saved.

### Models (`lib/ai/providers.ts`)

Code always refers to model **aliases** through `myProvider.languageModel(...)`: `agent-model`, `subagent-model`, `title-model`, `chat-model*`, `artifact-model` and `image-model`. When `META_MODEL_API_KEY` is set, the aliases resolve to Meta's Muse models (`muse-wonder-1.0`, `muse-spark-1.3`, `muse-image-1.0`) through the OpenAI provider pointed at `https://api.meta.ai/v1`, on the Responses API with `forceReasoning: true`, `store: false` and encrypted reasoning. `chat-model` is Spark (low), `chat-model-standard` and `agent-model` are Wonder (medium), `chat-model-reasoning` is Wonder (high), `title-model` is Spark (minimal) and `subagent-model` is Spark. Meta rejects `reasoning_effort: "none"`. Without the key the aliases fall back to OpenAI. OpenAI built-in tools only work without Meta (`supportsOpenAIBuiltInTools`). The model picker lives in `lib/ai/models.ts`, and the route only accepts the ids listed in its `MODEL_LABELS`.

### Adding or changing an agent tool

A tool reaches the model and the UI through four places:

- Tool definition: `lib/ai/tools/*.ts` (AI SDK `tool()` with a zod `inputSchema`).
- Wiring: the `CONNECTOR_TOOLS` entry in `lib/ai/agents/attma-agent.ts`, plus the **playbook line** that tells the agent when to use the tool.
- Connector metadata: `lib/ai/connectors/catalog.ts`. The client imports this file too, so it holds metadata only. Set `requires: 'ENV_VAR'` to hide a connector when the env var is unset, and `optIn` to keep it off by default.
- Step rendering: `describeStep` and related code in `components/chat/agent-activity.tsx`, which match on the tool name from `tool-<name>` parts. `components/chat/message.tsx` renders the parts.

The current tools: HPO disease ranking and VEP variant prioritization (`rare-disease.ts`), UniProt/AlphaFold (`proteins.ts`), g:Profiler enrichment (`enrichment.ts`), PubMed and sub-agents (`subagents.ts`), Muse web search, and Python plus AlphaGenome (`compute.ts`). Sub-agents (literature review, clinical/paper document reading) are tools that call `subagent-model` themselves.

Not used by the agent path: `lib/ai/model-router.ts`, `lib/ai/multimodal-processor.ts`, `lib/ai/tools/openai-tools.ts` and the `lib/ai/tools/index.ts` barrel. Nothing imports them, so check before you build on them.

### Python sandbox (`lib/sandbox/python.ts`)

`runPython` and AlphaGenome's `predictVariantEffect` (`lib/ai/tools/compute.ts`) run in a **Vercel Sandbox microVM, one per chat**. The workspace persists across steps and messages like a notebook. Variables don't persist, but files do. Each sandbox starts from a snapshot (`ATTMA_SANDBOX_SNAPSHOT`) built by `bun --env-file=.env.local scripts/sandbox/build-snapshot.ts <old ids to delete>`. If you change the package list there, update the list in the `runPython` tool description to match. Attached files are downloaded to `data/`. Files the code writes to `outputs/` are published to Vercel Blob, except files over 15 MB, which stay in the workspace. Each run has a 150 s limit, and the route's `maxDuration` is 300 s.

### Voice

`app/api/transcribe` and `hooks/use-dictation.ts` send 16 kHz mono WAV to Muse Voice Transcribe with automatic language detection. Language and microphone are settings in the user menu, not in the composer.

### Artifacts (documents the agent writes)

`createDocument`, `updateDocument` and `requestSuggestions` need the request's stream writer, so the route passes them in as `extraTools`. Each kind (text, code, sheet, image, pdf, graph) has `artifacts/<kind>/server.ts`, registered in `documentHandlersByArtifactKind` (`lib/artifacts/server.ts`), and `artifacts/<kind>/client.tsx`, registered in `artifactDefinitions` (`components/chat/artifact.tsx`). Adding a kind means touching both registries.

### Routing and i18n

`proxy.ts` is Next 16's middleware. Marketing pages live under `app/[locale]/` in 7 locales (`en es fr de zh pt it`, `lib/internationalization/config.ts`), with strings in `lib/internationalization/dictionaries/`. User-visible copy changes go into all seven files, and every claim on the landing page must be true and measured. The app routes (`/chat`, `/settings`) and the auth pages (`/login`, `/register`, …) are **not** localized; the proxy redirects `/<locale>/chat` to `/chat`. Paths with a file extension skip the proxy, so static files like `/demo/*.pdf` don't get a locale redirect.

### Data

Drizzle + Postgres (Neon in production). The tables are `User`, `Project`, `Chat`, `Message` (with `parts` JSON), `Vote`, `Document`, `Suggestion` and `PasswordReset`. Every query goes through `lib/db/queries.ts`. Uploads go straight from the browser to Vercel Blob (`app/api/files/upload`).

### Rare-disease engine

`lib/rare-disease/` ranks about 12,900 diseases by HPO semantic similarity and prioritizes variants with VEP. `data/hpo-index.json` is generated by `scripts/rare-disease-engine/build_hpo_index.py`. The benchmark lives in `scripts/rare-disease-eval/` (`bun scripts/rare-disease-eval/run.ts`, or set `HPO_INDEX_PATH` for the held-out index). Its README explains the leakage control. Make method choices on the tuning set only, and quote the held-out numbers.

## Conventions

- Comments explain *why* in full sentences (see the chat route and the agent). Match that style.
- Commits use conventional types with a scope: `feat(agent): …`, `fix(sandbox): …`, `style(theme): …`. One concern per commit, with a body explaining why. Pushing to `main` deploys production.
- Verify changes in the running app (Chrome) before calling them done, and re-check www.attma.bio after deploys.
- No em dashes in UI copy.
- `.cursorrules` is partly out of date: it describes Next 15, React Query and planned compute. Where it disagrees with the code or this file, follow the code.
