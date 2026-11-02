#!/usr/bin/env bash
# Release gate: every check that must pass before a push, in one command.
# The full Jest suite must be green; there are no tolerated failures.
set -u
cd "$(dirname "$0")/.."
fail=0
run() {
  echo ""
  echo "== $1"
  shift
  if timeout 900 "$@"; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

run "lint" bun run lint
run "format" bun run format:check
run "types" bunx tsc --noEmit -p .
run "gate tests" bun run test -- lib/analysis lib/ai components/chat app/api/chat
run "eval dry run (no model call)" env -u OPENAI_BASE_URL bun --conditions react-server --env-file=.env.local scripts/analysis-eval/run.ts --dry
run "build" bun run build:skip-migrate

echo ""
run "full test suite" bun run test

echo ""
if [ "$fail" -eq 0 ]; then
  echo "RELEASE GATE: PASS"
else
  echo "RELEASE GATE: FAIL"
  exit 1
fi
