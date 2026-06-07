---
title: "Node"
type: data-shape
parent: ./index.md
status: clean
last_reconciled: 2026-06-06
---

# Node

The canonical `Node` shape, owned here. `docs/design.md` and the
architecture `index.md` link to this file rather than duplicating
the type definition. The shape is the source of truth for every
other doc that references it; if you change the type here, link
back from the design doc with a note.

## Type

```ts
type Node = {
  id: NodeKey; // e.g. "root.refine[1]"
  kind: string; // consumer-defined node kind
  label?: string;

  inputSchema: ZodTypeAny;
  input: ResolvedInput;

  outputSchema: ZodTypeAny;
  status: NodeStatus; // discriminated union; see below

  actor: "system" | "human" | string;
  createdAt: string;
  updatedAt: string;
};

type NodeStatus =
  | { kind: "pending" }
  | { kind: "running"; startedAt: string }
  | { kind: "streaming"; output: unknown; outputPartial: boolean }
  | { kind: "resolved"; finalOutput: unknown; resolvedAt: string }
  | { kind: "failed"; error: SerializedError; failedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "stale"; previousOutput?: unknown };
```

## Why nested discriminated union

`Node["status"]` is a discriminated union, not a top-level union on `Node` itself. The shared fields (id, kind, label, inputSchema, input, outputSchema, actor, createdAt, updatedAt) live on `Node` once. Per-status data (output, error, timestamps) lives on the status variants. The `kind` field is the discriminator.

A consumer's renderer narrows on `switch (node.status.kind)`. The type system enforces "illegal states unrepresentable" at the node level: a `pending` node has no `output`, a `running` node has no `error`, a `resolved` node has no `error` field. The old flat-record shape with optional `output`, `outputPartial`, `finalOutput`, `error` allowed combinations that didn't make sense (e.g., a `pending` node with a `finalOutput`).

The `status` name is chosen over `state` to avoid the namespace collision with `WorkflowState` (the workflow-level type). The discriminator field on each variant is `kind` (the canonical TypeScript discriminated-union pattern).

## Resolves

- **TASK-G** (per-node error field): `error: SerializedError` lives on the `failed` variant only. No `error?` ambiguity on non-failed nodes.
- **TASK-J** (output vs finalOutput duality): `output` and `finalOutput` are no longer top-level. `output` is on `streaming` (current partial); `finalOutput` is on `resolved` (validated final). `outputPartial: boolean` is on `streaming` only.
- **TASK-K** (drop humanFields cache): `humanFields` no longer lives on `Node`. The lib reads the human-fields view on demand via `getHumanFields(node)`, which walks `node.inputSchema` via `getHumanMode`.
- **TASK-S** (getHumanInputDisplay): the return type is a discriminated union on `source` kind, not a `proposed: boolean` flag. The lib exposes the source; the renderer decides the UX.

## Variants

Each variant of `NodeStatus`:

### `pending`

The node's input is not yet complete, or it is ready to run on the next step. No per-status data.

### `running`

The consumer's Effect program is executing. `startedAt` is the ISO timestamp when the runner picked the node up.

### `streaming`

The consumer's Effect program has called `publish()` at least once. `output` is the current partial; `outputPartial: boolean` is always `true` on this variant.

### `resolved`

The program has returned. `finalOutput` is validated against `outputSchema`. `resolvedAt` is the ISO timestamp.

### `failed`

The program threw an error or returned `Effect.fail`. `error: SerializedError` carries the typed error. `failedAt` is the ISO timestamp.

### `paused`

The node has a `verified` field in its input schema that the human has not yet confirmed. The node cannot run until the human engages. `pausedAt` is the ISO timestamp when the node entered this state.

### `stale`

The node's input has changed. The cached resolved value is no longer current. `previousOutput` is the previous `finalOutput` (or `output` if the node was streaming) so the renderer can show the old value while re-deriving.

## Serialization

`serialize` projects the source fields of `WorkflowState`. Each `Node`'s `status` is serialized as the full discriminated union object: `{ kind: "running", startedAt: "..." }`, not as just `"running"`. The discriminator is preserved on the wire so `deserialize` can rebuild the type-narrowed view.

## Cross-references

- `docs/design.md` data structure section — link to this file.
- `.cns/architecture/index.md` data shapes — link to this file.
- `src/stub.ts` types — definition; this file is the doc.
