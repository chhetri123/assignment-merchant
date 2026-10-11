---
name: merchant-domain
description: Roles, the merchant application lifecycle and the invariants this service must never break. Use before changing application, risk or audit behaviour, or when answering what a role is allowed to do.
---

# Merchant domain

Sales staff submit merchant applications, a worker scores them against a risk/KYB
provider, and an assigned reviewer decides. These rules are enforced in code and
covered by tests; breaking one is a correctness bug, not a preference.

## Roles

| Role       | Allowed                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `SALES`    | Create, update and submit — **only** applications they created             |
| `REVIEWER` | Read every application; decide **only** on ones assigned to them           |
| `ADMIN`    | Everything operational, including assignment. **Never** records a decision |

ADMIN is excluded from decisions deliberately, so a decision is always attributable
to the reviewer who made it.

## Lifecycle

```
DRAFT ──submit──▶ SUBMITTED ──worker──▶ UNDER_REVIEW ──decision──▶ APPROVED | REJECTED
  ▲                                           │
  └──────────── INFO_REQUESTED ◀──────────────┘   (resubmit → SUBMITTED)
```

- Editable only in `DRAFT` and `INFO_REQUESTED`.
- Any other move is a conflict, decided in one place. Never re-implement a transition
  check in a controller or a second service.
- Rejecting or requesting more information requires a reason; approving does not.
- A reviewer can be assigned only while the application is submitted or under review,
  and only an active user holding the reviewer role.

## Two states, deliberately

Workflow status and risk status are separate columns: one is the human process, the
other the machine's opinion. An application can be under review with a failed risk
check — the reviewer still decides. Do not collapse them into one field.

## Invariants

- Every state change writes an audit entry in the same transaction as the change.
- Writes re-read the record under a lock, then check permission and state on that
  copy before writing.
- Risk work is queued only after the change has committed.
- A sales user asking for someone else's application is answered as if it does not
  exist, so ids cannot be probed.
