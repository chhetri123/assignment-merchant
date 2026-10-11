---
description: Run the full gate set and prove the app works against the Dockerised stack.
argument-hint: [area to focus on, or empty for everything]
---

Run the quality gates first, stopping at the first failure:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run build
npm run test && npm run test:e2e
```

Then use the **runtime-verifier** subagent to exercise the running stack$ARGUMENTS.

Show me the gate results and its verification table. If anything fails, show the
command and the first relevant error lines, and ask before changing code.
