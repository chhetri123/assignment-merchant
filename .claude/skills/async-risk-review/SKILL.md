---
name: async-risk-review
description: How background risk review works here - ordering, idempotency, retries and the failure path. Use before changing queue behaviour, the worker, or anything that enqueues or consumes jobs.
---

# Async risk review

Submitting an application queues a job; a worker calls the risk/KYB provider and
writes the assessment. Everything below exists because the provider is slow and
jobs get retried and redelivered.

## Ordering

- **Queue after commit.** Enqueuing inside the transaction lets a worker pick the job
  up and find no row.
- **Call the provider outside the transaction.** It is the slowest step; holding a row
  lock across a network call exhausts the connection pool under load. A losing racer
  wastes one provider call — that is the right trade against a held lock.

## Idempotency, two layers

1. **A deterministic job id** derived from the submission, so a duplicate enqueue for
   the same submission is dropped by the queue rather than running twice. A new
   submission must produce a new id.
2. **A re-check under a lock** inside the transaction: if the application is no longer
   awaiting review, write nothing. With concurrency above one, two jobs for the same
   application can both pass a pre-check; only the lock settles it.

A status guard read outside a transaction is a hint, not a guarantee.

## Retries and the failure path

- Attempt count and backoff come from configuration, never hardcoded, so tests can
  run them fast and operators can tune them.
- The failure handler fires on every attempt. Act only on the final one, and park the
  application in a state a human can pick up, so nothing is stranded as pending
  forever. That park is itself locked and state-guarded, so a late failure event
  cannot overwrite an application that has since been decided.

## Shape

Keep the queue callbacks as thin adapters over plain methods that take ordinary
arguments. Tests then call the logic directly instead of fabricating a job object,
and the adapter has nothing in it worth testing.

## Testing

Proving retries with a hand-built job object only tests your assumption about the
library. Drive the real worker with a provider stubbed to fail, and assert the
observable outcome and the number of attempts. Between tests, drain the queue;
deleting a queue from under a running worker makes the suite stall.
