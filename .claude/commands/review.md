---
description: Review the current change for correctness, then for security.
argument-hint: [commit range, or empty for uncommitted changes]
---

Review `$ARGUMENTS` (default: uncommitted changes).

Run the **code-reviewer** subagent, then the **security-reviewer** subagent. Give me
both verdicts and the findings most severe first, in one list.

Do not fix anything. For each finding, say what breaks because of it and what the fix
would be, then ask which ones I want done.
