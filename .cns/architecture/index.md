---
title: "Architecture"
type: module
parent: ../index.md
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# Architecture

## The data structure

The data structure is a flat DAG of typed nodes plus an edge list. It is JSON-serializable and is the *only* state. There is no separate runtime memory.

### `WorkflowState`

```ts
type WorkflowState = {
  id: WorkflowId
  version: number              // for schema migrations
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'

  nodes: ReadonlyArray<Node>   // flat list, not a tree
  edges: ReadonlyArray<Edge>   // { from, to, toField }

  inputs: ReadonlyArray<NodeId>      // entry points — no parents
  outputs: ReadonlyArray<NodeId>     // nodes whose values are the workflow's "return"

  createdAt: string
  updatedAt: string
  error?: SerializedError
}
```

### `Node`

```ts
type Node = {
  id: NodeId
  kind: string                 // consumer-defined node type identifier
  label?: string

  inputSchema: ZodTypeAny      // runtime authority for I/O
  input: ResolvedInput         // current state of each input field

  outputSchema: ZodTypeAny
  output?: unknown             // ACCUMULATOR (current partial value)
  outputPartial: boolean       // is `output` validated as a partial?
  finalOutput?: unknown        // ACCUMULATOR validated against full schema
  status: 'pending' | 'ready' | 'running' | 'streaming' | 'resolved' | 'failed' | 'paused'

  actor: 'system' | 'human' | string
  createdAt: string
  updatedAt: string
}
```

### `ResolvedInput`

```ts
type ResolvedInput = {
  fields: Readonly<Record<FieldKey, InputSource>>
}

type InputSource =
  | { kind: 'literal', value: unknown }
  | { kind: 'from_node', nodeId: NodeId }      // multi-parent is implicit
  | { kind: 'human', fieldSchema: ZodTypeAny, value?: unknown, status: 'pending' | 'set' }
```

### `Edge`

```ts
type Edge = {
  from: NodeId                  // node id
  to: NodeId                    // node id
  toField: FieldKey             // which field in `to.input` this edge feeds
}
```

## The runtime

Three operations on the state (the mutation primitives):

- **`init(definition): WorkflowState`** — build the initial state from a consumer-supplied workflow *definition* (a separate object that names the nodes, their schemas, and the edges).
- **`get(state, nodeId): Node`** — read a node.
- **`serialize(state) → string` / `deserialize(json) → state`** — persistence.
- **`findReadyNodes(state): ReadonlyArray<NodeId>`** — walk the DAG, return nodes whose inputs are all resolved and status is `pending`.
- **`findSubtree(state, nodeId): ReadonlyArray<NodeId>`** — all nodes transitively downstream of `nodeId`, used to mark a subtree for re-derivation when a human updates a field.

The mutation primitives (used by the runner as it executes a workflow):

- **`publish(state, id, partial): state'`** — accumulator update. The consumer's Effect program calls this to push a partial output. Validated as a partial of `outputSchema`.
- **`write(state, id, finalOutput): state'`** — final write. The consumer's Effect program returns this as its success value. Validated against the full `outputSchema`.
- **`writeHumanInput(state, nodeId, field, value): state'`** — set a human-updatable field. Marks the node and its subtree as needing re-execution.

The **runner** is a loop:

```
findReadyNodes(state) -> for each, instantiate the consumer's Effect program with the resolved input ->
  run -> write -> findReadyNodes -> repeat until done or paused
```

## Transport-agnostic event stream

The runner emits a `WorkflowEvent` stream. SSR, wall displays, chat-embedded, and tests are all consumers of the same stream.

```ts
type WorkflowEvent =
  | { type: 'node:ready'; nodeId: NodeId }
  | { type: 'node:running'; nodeId: NodeId }
  | { type: 'node:partial'; nodeId: NodeId; output: unknown }
  | { type: 'node:resolved'; nodeId: NodeId; output: unknown }
  | { type: 'node:failed'; nodeId: NodeId; error: SerializedError }
  | { type: 'node:paused'; nodeId: NodeId; field: FieldKey }
  | { type: 'workflow:completed'; output: unknown }
  | { type: 'workflow:failed'; error: SerializedError }
```

The in-process `WorkflowEventBus` (`bus.on(handler) => unsubscribe`) is the reference in-process transport. SSE/WS are v1.1.

## The renderer protocol

Two modes:

1. **Auto-render the whole graph.** Subscribe to `"root"`, get every event.
2. **Subscribe to a specific node.** Subscribe to `nodeId`, get events for that node and its subtree.

In both cases, the consumer supplies a renderer registry mapping `kind` → `(node, children) => UIElement`. The lib ships zero UI. The reference React adapter and a no-op renderer ship in the lib.

## Streaming

A node's lifecycle when streaming is in play:

```
pending -> ready -> running -> streaming (with partial `output`) -> ... -> resolved (with `finalOutput`)
```

The consumer's Effect program calls `publish(value)` to update the accumulator. The lib validates `value` as a partial of `outputSchema`. When the Effect program returns, the runner calls `write(value)`, which validates against the full schema.

A consumer that doesn't want streaming simply doesn't call `publish` — the node goes `running → resolved` with no `streaming` event. Streaming is opt-in.

## Decisions (2026-06-06 arena)

These decisions are now settled. See `docs/design.md` for the full rationale and synthesis record.

- **Reduce semantics:** IMPLICIT. The lib's input resolver IS the reduce. Multi-parent is a property of the topology. Rejected: explicit `ReduceNode` (Candidate 1).
- **Transport:** TRANSPORT-AGNOSTIC. The runner emits a `WorkflowEvent` stream. Rejected: in-process only (Candidate 2).
- **Type system mechanics:** SCHEMA-DRIVEN. Zod is the runtime authority; `Effect<Output, ...>` is the static authority. Rejected: effect-only (Candidate 2). Deferred to v1.1: dual with `defineNode` (Candidate 4).
- **Streaming:** ACCUMULATOR + FINAL. `publish()` for partials, `write()` for final. Rejected: field-level (Candidate 1), final-only (Candidate 2).

## Open architectural questions (deferred to v1.1+)

- **`defineNode` helper for dual type guard.** The schema and Effect program are both required but not type-checked against each other in v1. C4's `defineNode` is the v1.1 hardening. (See `docs/design.md` synthesis decision.)
- **Long-running workflow durability.** Resume is `init(definition) + deserialize(state) + findReadyNodes`. Are Effect programs required to be idempotent? "use workflow" has opinions about this; we should too.
- **SSE / WebSocket transports.** v1.1 adapters on top of the transport-agnostic event stream.
- **Partial validation edge cases.** Zod's `.partial()` works cleanly for `z.object()`. For `z.string()`, `z.number()`, etc., the lib stores untyped partials with `outputPartial: false`. Acceptable for v1.
