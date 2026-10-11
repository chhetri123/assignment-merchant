---
name: authorization-rules
description: How role and object-level authorization work here - one rule set, three enforcement points, and the not-found versus forbidden distinction. Use before adding an endpoint or changing who may do what.
---

# Authorization

Every rule lives in a single ability definition. If you are writing a role
comparison anywhere else, stop — it belongs there.

## Three enforcement points

1. **Route gate** — a declarative permission check on the endpoint. Coarse: it asks
   only whether the role has any rule for that action, so a conditional rule passes.
2. **Record check** — after the row is loaded, and on the same locked copy that is
   about to be written. This is where ownership conditions actually bite.
3. **Query scope** — list endpoints derive their filter from the caller's own read
   rule, so a list can never expose what a single fetch would refuse.

Skipping any one of the three is a bypass. The route gate alone is not enough.

## Rules that must hold

- Sales users may read and modify only what they created.
- Reviewers may read everything, and decide only where they are the assigned reviewer.
- Admins manage everything except recording a decision, which is explicitly denied.
- An unrecognised subject raises rather than silently matching no rule.

## Not found versus forbidden

- **Not found** when the caller should not know the record exists — a sales user
  reaching for another user's application, on read, update or submit alike.
- **Forbidden** when the record is legitimately visible but the action is not
  theirs — a reviewer who is not the assigned one, an admin attempting a decision.

Keep that distinction; it is deliberate and it is tested.

## Adding an endpoint

1. Grant the action per role in the ability definition, with conditions where
   ownership matters.
2. Put the declarative check on the route.
3. Assert at the record level inside the locked write.
4. Add tests for the negatives: the wrong role, and the right role on someone else's
   record.

## Proving it

An authorization test must fail when the rule is removed. Delete the condition, run
the suite, confirm red, restore. A test that passes either way proves nothing.
