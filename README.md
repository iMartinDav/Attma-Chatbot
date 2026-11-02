# Attma

<p align="center">
    <em>The AI bioinformatician that runs the analysis.</em>
</p>

Describe an analysis or attach your data, and Attma's agent plans the workflow, runs each step against real sources and a Python sandbox, and cites every result: rare disease case review (HPO ranking, Ensembl VEP with gnomAD, ClinVar, AlphaMissense and CADD), single-cell and RNA-seq analysis (scanpy, PyDESeq2), protein context (UniProt, AlphaFold), enrichment (g:Profiler) and graded literature (PubMed). Dictation works in 25 languages.

**Start here:** [docs/HANDOFF.md](docs/HANDOFF.md) explains what was built, why, how to set up a new machine, and what is still open. [CLAUDE.md](CLAUDE.md) is the short version for Claude Code.

## Stack

- **App:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **AI:** AI SDK 7 with Meta's Muse models (Wonder, Spark, Image, Voice Transcribe); tools in `nextjs-frontend/lib/ai/tools`
- **Compute:** Vercel Sandbox (one Python microVM per chat, scanpy stack preinstalled)
- **Data:** Neon Postgres via Drizzle ORM, Vercel Blob for files
- **Auth:** Auth.js (NextAuth v5) with Google and email/password
- **Tooling:** bun, ESLint, Prettier, Jest
- **Hosting:** Vercel (project `attma-chatbot`)

## Architecture

The plan for the analysis backend (TypeScript agent, sandboxed Python compute, natural-language SQL over results, Nextflow/nf-core for raw sequencing data) is in the [Attma Platform Architecture](https://claude.ai/artifact/MLG5XsxTWduLuqA7oe2jKz) document.

## Local setup

Requirements: Node.js 22+ and [Bun](https://bun.sh).

```bash
cd nextjs-frontend
bun install
vercel link --project attma-chatbot   # once per machine
vercel env pull .env.local --environment development
env -u OPENAI_BASE_URL bun dev
```

The app runs at http://localhost:3000. For local sign-in, create `.env.development.local` (gitignored) with `NEXTAUTH_URL`, `AUTH_URL` set to `http://localhost:3000` and `AUTH_TRUST_HOST=true`. Full setup, including the environment variables, is in [docs/HANDOFF.md](docs/HANDOFF.md#3-setting-up-another-mac).

To run against a local Postgres instead of Neon:

```bash
docker compose up db
```

## Scripts

Run from `nextjs-frontend/`:

| Command | What it does |
|---|---|
| `bun dev` | Dev server |
| `bun run build` | Apply migrations, then production build |
| `bun run build:skip-migrate` | Production build without touching the database |
| `bun run lint` / `lint:fix` | ESLint |
| `bun run format` / `format:check` | Prettier |
| `bun run test` | Jest |
| `bun run db:generate` / `db:migrate` | Drizzle migrations |
| `bun run email:dev` | Preview email templates |

## Deployment

Pushes to `main` deploy to Vercel production (www.attma.bio). Vercel installs with `bun install --frozen-lockfile` and builds with `bun run build`, which applies pending Drizzle migrations first.

## License

Apache-2.0
