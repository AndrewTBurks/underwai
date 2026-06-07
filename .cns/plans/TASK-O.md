---
task: TASK-O
status: resolved
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

The prior design's 8-status state machine included `ready` as a brief state between "deps met" and "runner picked up." In practice, the runner picks up `pending` nodes as soon as deps are met, so `ready` was vestigial. After the 2026-06-06 design review, `ready` was cut. The state machine is now 7 statuses.

## Recommendation

**`findReadyNodes` returns nodes with `status === "pending"` OR `status === "stale"`. `paused` is NOT returned.**

- `pending`: input not yet complete, or ready to run on the next step.
- `stale`: input changed, output no longer current; needs to re-execute.
- `paused`: input has an open `verified` gate; the runner does not pick it up until the gate closes via `writeHumanInput`.

The runner picks up nodes whose status is `pending` or `stale` AND whose inputs are complete. The runner processes them in `topologicalOrder` and transitions them to `running`.

## What "done" looks like

### Patches

1. **`docs/design.md`** — state derivation section. State the rule: "findReadyNodes returns nodes with status === 'pending' or status === 'stale'. 'paused' is NOT returned."

2. **`.cns/architecture/index.md`** — same. Update the consistency.

### Verification

- `tsc --noEmit` exit 0.
- Both docs agree on the `findReadyNodes` semantics.

## Session state

**2026-06-06 — resolved (doc-only).** Both `docs/design.md` and `.cns/architecture/index.md` already agree on the rule: `findReadyNodes` returns nodes whose inputs are complete and status is `pending` or `stale`; `paused` is NOT returned (the input is not complete — a `verified` field is still `pending`). The rule is consistent. Patches: `docs/design.md` runtime section now explicitly notes "paused is *not* returned (a paused node's input is not complete — a `verified` field is still `pending`)" so the rule is on the page next to the function signature.
