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
  id: string
  version: number              // for schema migrations
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'

  nodes: Node[]                // flat list, not a tree
  edges: Edge[]                // { from, to, toField }

  inputs: NodeRef[]            // entry points — no parents
  outputs: NodeRef[]           // nodes whose values are the workflow's "return"

  createdAt: string
  updatedAt: string
  error?: SerializedError
}
```

### `Node`

```ts
type Node = {
  id: string
  kind: string                 // consumer-defined node type identifier

  inputSchema: ZodSchema       // shape of the input this node expects
  input: ResolvedInput         // current state of each input field

  outputSchema: ZodSchema
  output?: unknown             // current output value (typed via outputSchema)
  status: 'pending' | 'ready' | 'running' | 'streaming' | 'resolved' | 'failed' | 'paused'
  stream?: StreamChunk[]       // for streaming nodes, accumulated partials

  actor: 'system' | 'human' | string
  createdAt: string
  updatedAt: string
}
```

### `ResolvedInput`

```ts
type ResolvedInput = {
  fields: Record<string, InputSource>
}

type InputSource =
  | { kind: 'literal', value: unknown }
  | { kind: 'from_node', nodeId: string }      // value comes from that node's output
  | { kind: 'human', value?: unknown, status: 'pending' | 'set' }
```

### `Edge`

```ts
type Edge = {
  from: string                 // node id
  to: string                   // node id
  toField: string              // which field in `to.input` this edge feeds
}
```

## The runtime

Three operations on the state:

- **`init(definition): WorkflowState`** — build the initial state from a consumer-supplied workflow *definition* (a separate object that names the nodes, their schemas, and the edges).
- **`get(state, nodeId): Node`** — read a node.
- **`write(state, nodeId, value): state'`** — set a node's output. Used by the runner after executing a node's Effect program.
- **`writeHumanInput(state, nodeId, field, value): state'`** — set a human-updatable field. Marks the node and its subtree as needing re-execution.

The **runner** is a loop:

```
findReadyNodes(state) -> for each, instantiate the consumer's Effect program with the resolved input ->
  run -> write -> findReadyNodes -> repeat until done or paused
```

`findReadyNodes` walks the DAG, returns nodes whose inputs are all resolved and whose status is `pending`. `findSubtree(state, nodeId)` returns all nodes transitively downstream of `nodeId`, used to mark a subtree for re-derivation when a human updates a field.

## The runner is a runtime, not a language

Consumers write Effect programs. A node's behavior is `Effect<Output, Error, Requirements>`. The lib does **not** ship a builder API, a DSL, or a wrapper around Effect. Effect's combinators (`Effect.all`, `Effect.race`, `Effect.retry`, `Effect.withSpan`) are the consumer's API surface.

Structured outputs are not a special primitive — the lib validates a node's output against its `outputSchema` (Zod) after the Effect program returns. The validation is part of the runner, not a separate step the consumer writes.

Human-updatable inputs are a property of the node's *input schema*, not a separate node kind. The schema field is marked (via a Zod wrapper like `z.humanUpdatable(z.string())`). The lib exposes a `writeHumanInput` API to set it. A renderer consumer can use the schema to generate a form.

## The renderer protocol

Two modes:

1. **Auto-render the whole graph.** For SSR, full-page renderers, the wall-display use case. The consumer subscribes to the root, gets the whole graph.
2. **Subscribe to a specific node.** For embedding workflow pieces in chat, modal popups, etc. The consumer subscribes to `nodeId` and gets the subtree under it.

In both cases, the consumer supplies a renderer registry mapping `kind` → `(node, children) => ReactNode` (or TSX, or whatever the consumer's UI library is). The lib ships zero UI. The renderer receives a node plus the resolved subtree; it does not need to traverse the DAG itself.

## Streaming

Streaming is handled at the node level via an `output` (the current accumulated value) plus a `finalOutput` (the validated value when complete). The consumer's Effect program can publish partial updates to `output`. Subscribers see:

```
pending -> running -> streaming (with partial value) -> resolved
```

The schema for the partial value is the *partial* of the final output schema. The lib validates partials and the final output against the appropriate Zod shape. The consumer does not write delta-emitting programs; it just calls a `publish(value)` effect that writes to the accumulator.

## Open architectural questions

See `intent.md` for the full list. The unresolved ones that shape the API:

- **DAG reduce for multi-parent nodes** — implicit (a node with parents [A, B] is ready when both resolve; the lib gathers their outputs as the input) vs explicit (a `reduce` node kind). Recommendation: implicit. Multi-parent readiness is a property of the topology, not a separate primitive.
- **Reduce semantics for "both inputs must succeed" vs "either is fine"** — implicit semantics may not cover all cases. May need an `effect: all | any` on the edge or node.
- **Streaming shape: (a) accumulator + final, (b) field-level resolution, (c) final-only.** Recommendation: accumulator + final. Field-level resolution is interesting for form-fill UIs but adds complexity; defer to v1.x.
- **Transport layer** — what is the wire protocol between the runner and the renderers? SSE? WebSocket? A custom change-stream? In-process pub/sub? Affects the SSR story.
- **Persistence shape** — flat DAG is JSON-serializable in principle, but the workflow *definition* is a TypeScript program. Resume = `init(definition) + deserialize(state) + findReadyNodes`. The lib is portable across machines; the *definition* is the consumer's code and ships with the consumer's app.
