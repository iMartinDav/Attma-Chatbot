# AGENTS.md

## Commands

Run these from `nextjs-frontend/` with bun:

- `bun dev` - run the development task
- `bun run test` - run the full test suite
- `bun run lint` - run the lint task
- `bun run build:skip-migrate` - build the project

## Code Map

- `nextjs-frontend/` - application source
- `docs/` - project documentation
- `.github/` - project configuration

## Conventions

- Import application modules through the `@/lib/`, `@/components/`, and `@/app/` aliases.
- Place tests in `__tests__/` directories and name them `*.test.ts` or `*.test.tsx`.
- Use named exports in TypeScript modules.
