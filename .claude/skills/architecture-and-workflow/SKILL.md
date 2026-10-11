---
name: architecture-and-workflow
description: How this service is layered and how work gets done here - where a rule belongs, and the implement, verify, review, ask-to-commit loop. Use at the start of any task, and whenever deciding which layer a change belongs in.
---

# Architecture and workflow

## Shape of the service

A NestJS API over Postgres, with a queue worker in the same process and Redis
behind both the queue and the session store.

```
request → middleware (correlation id) → guards (rate limit → auth → policy)
        → controller (validation only) → service (rules, transaction, audit)
        → database
                                        service → queue → worker → provider → database
```

## Where a rule belongs

One rule, one home. If the same condition appears in two layers, one of them is wrong.

| Concern                                | Layer                                  |
| -------------------------------------- | -------------------------------------- |
| Shape and type of input                | DTO with validation decorators         |
| Who may call this at all               | Declarative permission on the route    |
| Who may touch _this record_            | Service, after the row is loaded       |
| Which state changes are legal          | The state machine module, nowhere else |
| What gets written, and the audit of it | Service, inside one transaction        |
| Slow or external work                  | Queue job, never inside a transaction  |
| Shape of the response                  | Response DTO, never the entity         |

Controllers stay thin: validate, delegate, return a DTO. A controller that contains
a business condition is a finding.

## Principles that outrank convenience

- **Authorization is enforced where the data is**, not in the caller. A list query is
  scoped in SQL from the same rule that guards a single record, so the two cannot
  drift apart.
- **State change and its audit row commit together**, or neither does.
- **Re-read under a lock before writing.** The copy loaded for a permission check can
  be stale by the time the write happens.
- **Nothing slow inside a transaction or a lock.** External calls happen before it.
- **Queue work after the commit**, so a worker never sees a row that does not exist.
- **Schema changes are migrations.** Auto-sync is off; entities and migrations must
  stay in agreement, and that agreement is checked automatically.
- **Money is a decimal string end to end**, compared as integer minor units. It never
  becomes a float.
- **Secrets never leave.** Sensitive fields are encrypted at rest, returned masked,
  and scrubbed from logs and audit metadata.
- **Fail closed.** An unrecognised subject, an unsupported rule shape, an unreachable
  dependency: raise or report down, never silently allow or hang.

## Working loop

1. **Understand first.** Read the code that already does something similar; match it.
2. **Change the smallest surface** that solves the task.
3. **Run it.** Not just the tests — the actual stack, the actual endpoint. Every
   defect of consequence in this project was found by running it, not reading it.
4. **Cover it**, including the negative case, and show the test failing when the
   behaviour is broken.
5. **Review** for correctness and then for security.
6. **Ask before committing.** Always.

## Honesty rules

- Report what you verified and what you did not. "Tests pass" is not "it works".
- If a comment, a document or a commit message claims a guarantee, the code must
  provide it.
- Flag a gap once, clearly; then respect the decision.
