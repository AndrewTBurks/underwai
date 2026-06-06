---
task: TASK-O
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [B7]
decision_required: false
---

# TASK-O: findReadyNodes consistency

## Source finding

> **B7. [warning] `findReadyNodes` doesn't say what happens with `paused` or `stale` nodes**
>
> *Location*: `docs/design.md` line ~227
>
> *Finding*: `findReadyNodes(state): Set<NodeKey>` returns nodes "whose inputs are complete and status is `pending` or `stale`" (per the architecture doc) or just "status is `pending`" (per the design doc). What about `paused` nodes? They have incomplete inputs (a `verified` field is `pending`). They are NOT ready. What about `stale` nodes? They have complete inputs but need to re-execute. They ARE ready.
>
> *Evidence*: the design doc's "state derivation" section says `findReadyNodes` "walks the DAG, return nodes whose inputs are complete and status is `pending` or `stale`." The architecture doc says "return nodes whose inputs are all resolved and status is `pending`." Inconsistency.
>
> *Suggestion*: clarify in the design doc: `findReadyNodes` returns nodes with `status === "pending"` *or* `status === "stale"` (the latter being nodes whose input was re-set by `writeHumanInput` and need to re-run). `paused` nodes are *not* ready — they're waiting for human input. Pick one and be consistent.

## Problem statement

`findReadyNodes` has inconsistent definitions across the design doc and the architecture doc. The design doc says "pending OR stale"; the architecture doc says just "pending". Both docs need to agree.

## Recommendation

**`findReadyNodes` returns nodes with `status === "pending"` OR `status === "stale"`. `paused` is NOT ready.**

- `pending`: deps not met, waiting for upstream.
- `ready` (the function's name is `findReadyNodes`, but the *status* is `pending` or `stale` — the "ready" is a property of the state, not the status). Actually, the function name is a bit confusing here.

Wait, looking at the state machine: the runner processes nodes whose status is `pending` or `stale`, and transitions them to `ready` → `running`. So `findReadyNodes` is a misnomer; the function should be `findProcessableNodes` or `findRunnableNodes`. The runner picks up nodes that are `pending` or `stale`.

But renaming the function is a big change. Let me reconsider.

Actually, looking at the state machine more carefully:

```
pending → ready → running → resolved
```

The "ready" status is a brief state between "deps met, about to run" and "currently running." In the original v1.1 design, the `ready` status was meant to indicate "deps met, but the runner hasn't picked it up yet." In practice, the runner picks up `pending` nodes as soon as their deps are met, so the `ready` state is fleeting.

For TASK-O, the fix is:
- The design doc says `findReadyNodes` returns nodes whose inputs are complete. That's `pending` or `stale` (both have all inputs satisfied; `stale` because the input was just re-set by `writeHumanInput`).
- `paused` is NOT returned because the input is not complete (a `verified` field is still `pending`).
- Update both docs to agree.

## What "done" looks like

### Patches

1. **`docs/design.md`** — state derivation section. State the rule: "findReadyNodes returns nodes with status === 'pending' or status === 'stale'. 'paused' is NOT returned."

2. **`.cns/architecture/index.md`** — same. Update the consistency.

### Verification

- `tsc --noEmit` exit 0.
- Both docs agree on the `findReadyNodes` semantics.

## Session state

*(to be filled in during the design session)*
