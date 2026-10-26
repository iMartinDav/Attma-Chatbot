# Attma

<p align="center">
    <em>An AI bioinformatician: chat with your data, literature and pathways.</em>
</p>

Attma is a Next.js app where an AI agent answers biology questions with real tools: literature search (PubMed, Semantic Scholar), gene and pathway databases (KEGG, Reactome, STRING, GO), and documents it writes for you. Single-cell analysis on your own data is being rebuilt on sandboxed scanpy compute; see the architecture plan.

## Stack

- **App:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **AI:** AI SDK 7 with OpenAI models; tools live in `nextjs-frontend/lib/ai/tools`
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
bun dev
```

The app runs at http://localhost:3000. `.env.development.local` can override pulled values for local work (for example `NEXTAUTH_URL=http://localhost:3000`); it is gitignored.

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
