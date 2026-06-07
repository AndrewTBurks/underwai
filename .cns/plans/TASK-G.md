---
task: TASK-G
status: resolved
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

**2026-06-06 — resolved (folded with TASK-J, TASK-K, TASK-S).** Andrew's pivot: "I think it should be a union on a property within the Node. i.e. `Node["state"] = {} | {} | ...` rather than a top-level discriminated union. nest it in the node" — and then on the property name: "use `status` not `state` for the nested property."

The result is a *nested* discriminated union on `Node["status"]`. The shared fields (id, kind, inputSchema, input, outputSchema, actor, createdAt, updatedAt) stay on `Node` once. The per-status data (output, error, timestamps) lives on the status variants:

```ts
type NodeStatus =
  | { kind: "pending" }
  | { kind: "running"; startedAt: string }
  | { kind: "streaming"; output: unknown; outputPartial: boolean }
  | { kind: "resolved"; finalOutput: unknown; resolvedAt: string }
  | { kind: "failed"; error: SerializedError; failedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "stale"; previousOutput?: unknown }
```

This folds four plans into one refactor:
- **TASK-G:** `error: SerializedError` lives on the `failed` variant only. No `error?` ambiguity on non-failed nodes.
- **TASK-J:** `output` and `finalOutput` are no longer top-level. `output` is on `streaming` (current partial); `finalOutput` is on `resolved` (validated final). `outputPartial: boolean` is on `streaming` only.
- **TASK-K:** `humanFields` cache is gone. The lib reads the human-fields view on demand via `getHumanFields(node)`, which walks `node.inputSchema` via `getHumanMode`. Re-walking the schema is cheap for typical <10-field schemas; the cache was redundant.
- **TASK-S:** `getHumanInputDisplay(node, fieldKey)` returns a discriminated union on `source` kind (`literal` | `from_node` | `human` | `undefined`). The lib exposes the source; the renderer decides the UX.

`getHumanFields` and `getHumanInputDisplay` are added to the operations section. Both are stub bodies; Phase 2 implements the schema walk and the field-read logic.

Patches in this commit: `Node` and `NodeStatus` reshaped in `docs/design.md`, `.cns/architecture/index.md`, and `src/stub.ts`. The verbosity reductions and the load-bearing decisions in `docs/design.md` are updated to drop the `humanFields` mention. The schema `outputPartial` is no longer a top-level field.

`tsc --noEmit` green. CNS health gate green.
