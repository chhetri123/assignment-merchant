---
name: code-comments
description: Comment style here - one or two plain lines, why not what. Use whenever writing or reviewing comments, and before adding any docblock.
---

# Comments

The user has pushed back on this twice. Comments are **one line, two at most**, and
only where the code cannot speak for itself. Over-commented code reads as generated
and buries the few comments that matter.

## Write one when it says something the code cannot

- Why a non-obvious choice was made, especially where the obvious choice is wrong.
- An ordering constraint or invariant that is not visible locally.
- A trap for the next person: what must not be added inside this block, and why.
- A library quirk that explains otherwise strange code.

## Never write

- Restatements of the next line.
- Section banners and decorative separators.
- Docblocks repeating parameter names and types already in the signature.
- A comment on every method of a controller or DTO; the API decorators document it.
- Commented-out code. Delete it; git has the history.
- A bare `TODO` with no reason.
- Filler: "Note that…", "Simply…", "This robust, scalable…".
- Any mention of AI tooling.

## A comment must be true

A comment asserting a guarantee the code does not provide is worse than no comment:
it stops the next person from checking. This repo once shipped a comment claiming a
column protected against concurrent decisions when nothing enforced it. If you
describe a guarantee, make sure the code provides it.
