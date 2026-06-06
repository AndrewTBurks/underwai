---
task: TASK-G
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [C8]
decision_required: false
---

# TASK-G: Per-node error field

## Source finding

> **C8. [warning] `state.error?: SerializedError` is set on failure but not on `failed` node status**
>
> *Location*: `docs/design.md` `WorkflowState.error`, `Node` has no error field
>
> *Finding*: `WorkflowState.error?: SerializedError`. But individual nodes can be `failed`. The error is on the workflow, not on the node. So if node N is `failed`, the consumer has to look at `state.error?.nodeId === N.id` to find it.
>
> *Evidence*: `Node` has no `error` field. `SerializedError` has a `nodeId` field, so the workflow's error is the *latest* node failure, but the consumer can't tell *which* node failed without checking `error.nodeId`.
>
> *Suggestion*: add `error?: SerializedError` to `Node` itself. The workflow's `error` is a derived field (the error of the most-recently-failed node, or a top-level error like a serialization failure). This makes per-node error inspection trivial.

## Problem statement

`Node` has no `error` field. `WorkflowState.error` is the only place errors live. The workflow's `error` is the *latest* node failure, but the consumer has to check `error.nodeId` to figure out which node failed. This is brittle: a node can be `failed` without `state.error` being its error (if a more recent failure happened elsewhere).

## Recommendation

Add `error?: SerializedError` to `Node`. Keep `WorkflowState.error` for top-level, non-node-scoped errors (serialization failure, schema migration failure, etc.).

```ts
type Node = {
  // ... existing fields ...
  status: NodeStatus
  error?: SerializedError  // populated when status === "failed"
  // ...
}

type WorkflowState = {
  // ... existing fields ...
  error?: SerializedError  // top-level (non-node) errors
  // ...
}
```

The two error fields are for different things:
- `Node.error` — the error that caused this specific node to fail.
- `WorkflowState.error` — a top-level error (e.g., "the workflow was killed because a schema migration failed"). Not node-scoped.

A node's failure does *not* populate `WorkflowState.error`. The two are independent.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `Node` and `WorkflowState` types. Add the `error` field to `Node`. Document the distinction between `Node.error` and `WorkflowState.error`.

2. **`src/stub.ts`** — add `error?: SerializedError` to `Node`. Leave `WorkflowState.error` as-is.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): a node that fails has `node.error` populated and `state.error` is *not* set (unless a top-level error also happened).

## Session state

*(to be filled in during the design session)*
