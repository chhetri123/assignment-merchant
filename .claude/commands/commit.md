---
description: Stage, scan for secrets and propose a commit message - then wait for approval.
---

1. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` if
   behaviour changed. Stop and report if any fail.
2. `git add -A` and show `git status --short`.
3. Scan the staged diff for secrets, `.env`, `dist/`, `coverage/` and `.claude/`.
4. Propose one conventional-commit subject line (see the `commit-conventions` skill).

Then stop and ask. Do not run `git commit` until I say yes.
