# Contributing

Thanks for helping. Attma is research software, so changes are judged first on whether results stay correct and traceable.

## Setup

Follow "Run it locally" in the [README](README.md). Work from `nextjs-frontend/` with bun; npm and pnpm are not supported.

## Before you open a pull request

Run the release gate from `nextjs-frontend/` and make sure it passes:

```bash
bun run release-gate
```

It runs ESLint, Prettier, the type check, the unit tests and a production build. The pre-commit hooks in `.pre-commit-config.yaml` run the fast part of it on each commit.

## Conventions

- Commits use conventional types with a scope, for example `feat(agent): …` or `fix(sandbox): …`. One concern per commit, with a body that says why.
- Comments explain why, in full sentences.
- Tests live in `__tests__/` next to the code.
- Schema changes: edit `lib/db/schema.ts`, run `bun run db:generate`, and commit the generated SQL with its `meta/` files.
- User-facing copy is written for researchers. It never states or implies a diagnosis, and every number on the landing page must be measured.
- Never commit secrets. `.env*` files are gitignored; `.env.example` lists the names.

## Benchmark changes

Method choices for the rare-disease engine are made on the tuning set only. Report the held-out numbers. See `nextjs-frontend/scripts/rare-disease-eval/README.md`.
