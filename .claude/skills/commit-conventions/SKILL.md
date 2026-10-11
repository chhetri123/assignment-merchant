---
name: commit-conventions
description: How commits are made here - always ask first, conventional subject, secret scan, author identity. Use before staging or committing anything.
---

# Commits

## Always ask first

Never commit without explicit approval in this turn. The flow is:

1. Run the gates: lint, types, unit tests, and the integration suite when behaviour
   changed. Report failures instead of committing around them.
2. Stage, then show the short status so the file list is visible.
3. Scan the staged diff for anything that must not ship.
4. Propose the message and **wait for a yes**.

Approval is per commit. A yes on one is not a yes on the next.

## Message

Conventional commits: imperative, lower case, no trailing period, scope where it
helps. Say what changed and why it matters, not which files moved.

```
feat(applications): add merchant application lifecycle with object-level authorization
fix(risk): re-check application state under a lock before writing the assessment
test(risk): verify retry, backoff and dedupe against a real worker
chore: add ESLint with strict type-checked rules and fix every violation
```

One logical change per commit. If the subject needs an "and", it is probably two.

## Never

- Skip the git hooks. If one blocks the commit, fix what it reports.
- Hard-reset to tidy up. Use a soft reset to drop a commit; a hard one has already
  cost work here.
- Add co-author trailers, AI attribution, or touch the configured git identity. The
  author is the user and stays that way.
- Stage environment files, build output, coverage, or agent configuration.
