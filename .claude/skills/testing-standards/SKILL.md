---
name: testing-standards
description: What to test here and how - the unit and integration split, isolation from development data, and proving a test can fail. Use before adding or changing any test.
---

# Testing standards

Both suites together run in seconds. Keep it that way: add tests that would catch a
real regression, not tests that restate the implementation.

## Split

- **Unit** — pure rules: the state machine, the permission rules, redaction,
  encryption, money parsing, and the worker logic with its dependencies injected.
- **Integration** — HTTP through to a real database, a real Redis and the real
  worker. Authorization, lifecycle, concurrency and retries are proven here, because
  that is where they actually live.

## Isolation, learned the hard way

- Integration tests must point at their **own** database, set unconditionally. Reading
  the value from the local environment once pointed the suite at the development
  database and truncated it. Never make that assignment conditional.
- Use a separate Redis database so a locally running API cannot consume the tests'
  jobs, or the tests its own.
- Reset between tests: truncate, reseed, clear session and rate-limit keys, and drain
  the queue. Leftover jobs from a previous test make the next one slow and flaky.

## Rules

- No sleeping to wait for async work. Poll for the state you expect, with a timeout
  and a clear failure message.
- Assert the behaviour, not the call: the status code and the resulting row, not that
  a spy ran.
- Mock through the framework's injection, not by casting a partial object into a
  class. If a mock needs a cast, the seam is in the wrong place.
- Narrow untyped response bodies in one shared helper, not in every test.
- Name the test after the rule in plain words: _a sales user cannot read another
  user's application by id_.

## Prove the test can fail

For anything security- or concurrency-related: break the protection, watch the test
go red, restore it, and report both results. A test you never saw fail is not
evidence. This has been done for ownership rules, the assigned-reviewer check, the
row locks, rate limiting and the retry configuration — keep that up for new guards.
