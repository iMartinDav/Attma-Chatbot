# Attma Chatbot

Attma is a conversational bioinformatics workbench: a user describes an analysis or attaches data, and one agent on Meta's Muse models plans the workflow, runs each step against real sources and a Python sandbox, and reports what the data show with a source for every claim. Production: https://www.attma.bio (Vercel project `attma-chatbot`, team `martin-davila-s-projects`). The app lives in `nextjs-frontend/`.

Read `docs/HANDOFF.md` for the full history: what was built, why each decision was made, the benchmark, and open work. `nextjs-frontend/PRODUCT.md` holds the product brief used for design work.

## Hackathon context

Built for the Meta Global AI Developer Hackathon (build window ends Nov 4, 2026, 9 PM ET). Judging: Impact 30%, use of Meta AI tooling 25%, demo 25%, technical depth 20%. Meta's skip list includes "AI-generated medical advice", "basic RAG", "simple image analyzers" and "dashboards as the main feature", so Attma is framed as reproducible research workflows, never as diagnosis. Keep it that way in copy and prompts.

## Commands (run in `nextjs-frontend/`)

| Command | Purpose |
|---|---|
| `bun install` | Install (bun 1.3.13 is the package manager; never npm or pnpm) |
| `env -u OPENAI_BASE_URL bun dev` | Dev server on http://localhost:3000 (see the OPENAI_BASE_URL note below) |
| `bunx tsc --noEmit -p .` | Type-check; must be clean before committing |
| `bun run lint` | ESLint; zero errors required (existing warnings are known) |
| `bunx prettier --write <files>` | Format what you touched |
| `bun run build:skip-migrate` | Production build without touching the database |
| `vercel env pull .env.local --environment development` | Refresh env vars from Vercel |

## Architecture in one screen

- **Next.js 16.4 (Turbopack), React 19, AI SDK 7** (`ai` 7.0.x, `@ai-sdk/openai` 4.x). TypeScript 6, ESLint 9 and `@tanstack/react-table` v8 are pinned on purpose (newer majors break typescript-eslint or the tables).
- **Models** (`lib/ai/providers.ts`): Muse through the OpenAI provider pointed at `https://api.meta.ai/v1`, Responses API, with `forceReasoning: true`, `store: false` and encrypted reasoning. Aliases: `chat-model` = Muse Spark (low), `chat-model-standard` and `agent-model` = Muse Wonder (medium), `chat-model-reasoning` = Wonder (high), `title-model` = Spark (minimal), `subagent-model` = Spark. `reasoning_effort: "none"` is rejected by Meta.
- **One agent** (`lib/ai/agents/attma-agent.ts`): a `ToolLoopAgent` whose tools come from the connectors the user enables in the Sources menu (`lib/ai/connectors/catalog.ts`). Its instructions say it is Attma, not Muse.
- **Tools** (`lib/ai/tools/`): HPO disease ranking and VEP variant prioritization (`rare-disease.ts`, engine in `lib/rare-disease/`), UniProt/AlphaFold (`proteins.ts`), g:Profiler enrichment (`enrichment.ts`), PubMed and Muse Spark sub-agents for documents and literature (`subagents.ts`), Muse web search, Python in a Vercel Sandbox and AlphaGenome (`compute.ts`, runtime in `lib/sandbox/python.ts`).
- **Chat route** (`app/api/chat/route.ts`): saves the whole UI message (tool parts included) under the client's chat UUID; earlier steps go back to the model as a text log (Muse rejects replayed function calls under `store: false`); a `data-run` part carries model, steps and time.
- **Voice** (`app/api/transcribe`, `hooks/use-dictation.ts`): Muse Voice Transcribe, 16 kHz mono WAV, auto language detection; language and microphone are settings in the user menu.
- **Landing** (`app/[locale]/`): 7 languages from `lib/internationalization/dictionaries/*.json`; every claim on it must be true and measured.

## Things that will bite you

- `~/.zshrc` exports `OPENAI_BASE_URL=localhost:20128`, which hijacks the OpenAI SDK. Start the dev server with `env -u OPENAI_BASE_URL`.
- Local login: `.env.development.local` (gitignored) must set `NEXTAUTH_URL` and `AUTH_URL` to `http://localhost:3000` and `AUTH_TRUST_HOST=true`. `NEXTAUTH_URL` exists on Vercel for Production only.
- Python steps need `ATTMA_SANDBOX_SNAPSHOT` (set on Vercel for all environments). Rebuild with `bun --env-file=.env.local scripts/sandbox/build-snapshot.ts <old ids to delete>` if the stack changes.
- Chrome may pick a silent virtual mic (Boom 3D's "BoomAudioDevice"); dictation asks for the system default exactly for that reason. Don't switch it back to `deviceId: { ideal }`, which Chrome ignores.
- Theme: mint as text uses `text-primary-ink` (passes AA on light); `text-primary` is for fills. Don't fade `text-muted-foreground` below 100%. Surfaces step sidebar < page < card < popover.
- Never commit secrets. `.env*` files are gitignored. Never print key values in logs or chat.

## Conventions

- Conventional commits (`feat(scope):`, `fix(scope):`, `style(scope):`), one concern per commit, body explaining why. Pushing to `main` deploys production.
- Verify changes in the running app (Chrome) before calling them done, and re-check www.attma.bio after deploys.
- Match the surrounding code's comment density and naming. No em dashes in UI copy.
