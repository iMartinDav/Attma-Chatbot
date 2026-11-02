# Task T8: release gate (prepare, do not commit)

You are in the Attma worktree on the main checkout (commit to a feature branch before pushing; pushing `main` deploys production). Read `docs/muse/README.md` and `CLAUDE.md`. Everything for the trust gate is in the working tree, staged but not committed.

1. From `nextjs-frontend/`, run with `timeout`: `bun run lint` (0 errors), `bun run format:check` (fix only files this branch touched; list any pre-existing failures elsewhere without fixing them), `bunx tsc --noEmit -p .`, `bun run test` (report the known pre-existing failures in `hero-input` and `useTypingEffect` separately from anything new).
2. Check no secret or `.env*` file is staged (`git diff --cached --name-only`), no file over 500 KB is staged, and `scripts/analysis-eval/results/` is ignored.
3. Write `docs/muse/COMMIT-PLAN.md`: a list of commits in conventional style with scope (`feat(analysis): …`, `feat(agent): …`, `feat(chat): …`, `test(analysis): …`, `docs: …`), each with the exact file list and a two-line body saying why. One concern per commit. Then a PR title and description (what the trust gate does, how it was tested: unit tests, live harness verdicts with cost, manual browser checklist results; a "Research use only, not a diagnosis" note).
4. Do NOT run `git commit`, `git push` or `gh`. A person reviews and commits.

Finish with the check results and the path of COMMIT-PLAN.md.
