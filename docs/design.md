# underwAI — Design (v1)

This is the synthesized design for underwAI v1. It is the result of an arena process that produced four candidate designs from a decomposed design space (one candidate per combination of the four most-load-bearing open pivots: reduce semantics, transport, type system mechanics, streaming shape). The cross-judge picked candidate 3 ("implicit reduce, transport-agnostic, schema-driven, accumulator streaming") as the base, with two grafts from the losing candidates. See the *Synthesis decision* section at the bottom for the full record.

## Problem

We want a library that lets a developer define a workflow as a flat, typed DAG. The library executes the workflow by walking the DAG, running consumer-supplied Effect programs at each node, validating the typed outputs against Zod schemas, and writing them back to the same data structure. The data structure is the source of truth; it can be serialized, persisted, resumed, and rendered.

Existing libraries don't have this shape:
- **AI SDK** gives a chat surface with tool calls. Generative UIs are a switch over message parts.
- **langgraph** gives a Python orchestrator with opaque checkpoints. The data structure exists but is not the interface.
- **instructor** gives structured outputs from LLMs, bolted onto a chat surface.
- **"use workflow"** gives resumable workflows, but the runtime is vercel-locked.
- **Effect** is a runtime, not a workflow library.

underwAI fuses these: typed outputs at every node, Effect composition, durable data structure as the single source of truth, human-in-the-loop as a compositional primitive, renderers as a thin subscription layer.

## Shape

### The data structure (flat, typed, single source of truth)

```ts
// Branded ids
type WorkflowId = string & { readonly __brand: "WorkflowId" }
type NodeId = string & { readonly __brand: "NodeId" }
type FieldKey = string

type NodeStatus =
  | "pending"      // deps not met
  | "ready"        // deps met, waiting to run
  | "running"      // Effect program executing
  | "streaming"    // partial output exists
  | "resolved"     // final output validated
  | "failed"
  | "paused"       // human input needed

type Actor = "system" | "human" | (string & {})  // brand allows string union

type WorkflowState = {
  id: WorkflowId
  version: number                                  // schema migration key
  status: "pending" | "running" | "paused" | "completed" | "failed"

  nodes: ReadonlyArray<Node>
  edges: ReadonlyArray<Edge>
  // No reduces. Multi-parent resolution is the lib's input resolver.

  inputs: ReadonlyArray<NodeId>                     // entry points
  outputs: ReadonlyArray<NodeId>                    // root-level return

  createdAt: string
  updatedAt: string
  error?: SerializedError
}

type Node = {
  id: NodeId
  kind: string                                     // consumer-defined type id
  label?: string

  inputSchema: ZodTypeAny                          // runtime authority for I/O
  input: ResolvedInput

  outputSchema: ZodTypeAny
  output?: unknown                                 // ACCUMULATOR (partial value)
  outputPartial: boolean                            // is `output` validated as a partial?
  finalOutput?: unknown                            // ACCUMULATOR validated against full schema
  status: NodeStatus

  actor: Actor
  createdAt: string
  updatedAt: string
}

type ResolvedInput = {
  fields: Readonly<Record<FieldKey, InputSource>>
}

type InputSource =
  | { kind: "literal"; value: unknown }
  | { kind: "from_node"; nodeId: NodeId }          // multi-parent is implicit
  | { kind: "human"; fieldSchema: ZodTypeAny; value?: unknown; status: "pending" | "set" }

type Edge = {
  from: NodeId
  to: NodeId
  toField: FieldKey
}

type SerializedError = {
  nodeId: NodeId
  message: string
  cause?: SerializedError
}
```

### The runner (boring, transport-agnostic, Effect-based)

```ts
// === Core operations on state ===

export function init(definition: WorkflowDefinition): WorkflowState
export function getNode(state: WorkflowState, id: NodeId): Node
export function serialize(state: WorkflowState): string             // JSON
export function deserialize(json: string): WorkflowState
export function findReadyNodes(state: WorkflowState): ReadonlyArray<NodeId>
export function findSubtree(state: WorkflowState, root: NodeId): ReadonlyArray<NodeId>

// === Mutation operations ===

// publish() — accumulator update. The consumer's Effect program calls this
// to push a partial output. The lib validates it as a partial of outputSchema.
export function publish(
  state: WorkflowState,
  id: NodeId,
  partial: unknown
): WorkflowState

// write() — final write. The consumer's Effect program returns this as its
// success value. The lib validates it against the full outputSchema.
export function write(
  state: WorkflowState,
  id: NodeId,
  finalOutput: unknown
): WorkflowState

export function writeHumanInput(
  state: WorkflowState,
  nodeId: NodeId,
  field: FieldKey,
  value: unknown
): WorkflowState

// === Transport-agnostic event stream ===

export type WorkflowEvent =
  | { type: "node:ready"; nodeId: NodeId }
  | { type: "node:running"; nodeId: NodeId }
  | { type: "node:partial"; nodeId: NodeId; output: unknown }
  | { type: "node:resolved"; nodeId: NodeId; output: unknown }
  | { type: "node:failed"; nodeId: NodeId; error: SerializedError }
  | { type: "node:paused"; nodeId: NodeId; field: FieldKey }
  | { type: "workflow:completed"; output: unknown }
  | { type: "workflow:failed"; error: SerializedError }

export function runWorkflow(
  definition: WorkflowDefinition,
  state?: WorkflowState
): {
  state: WorkflowState
  events: AsyncIterable<WorkflowEvent>
}

// === Subscription (lives on top of events) ===

export type Subscription = {
  unsubscribe(): void
}

export function subscribe(
  events: AsyncIterable<WorkflowEvent>,
  target: NodeId | "root",
  onEvent: (event: WorkflowEvent) => void
): Subscription

// === Zod extension for human-updatable fields ===

declare module "zod" {
  interface ZodType {
    humanUpdatable(): ZodType
  }
}

// === Type inference from schemas ===

export type InferNodeInput<N> = z.infer<N["inputSchema"]>
export type InferNodeOutput<N> = z.infer<N["outputSchema"]>

// === Workflow definition (consumer-facing) ===

export type WorkflowDefinition = {
  name: string
  version: number
  nodes: ReadonlyArray<NodeDefinition>
  edges: ReadonlyArray<Edge>
  inputs: ReadonlyArray<NodeId>
  outputs: ReadonlyArray<NodeId>
}

export type NodeDefinition = {
  id: NodeId
  kind: string
  inputSchema: ZodTypeAny
  outputSchema: ZodTypeAny
  // The consumer's Effect program is the only required behavior.
  // The lib validates the output against outputSchema (Zod) at runtime.
  program: (input: unknown) => Effect.Effect<unknown, Error, Requirements>
}
```

### Streaming (accumulator + final)

A node's lifecycle when streaming is in play:
```
pending -> ready -> running -> streaming (with partial `output`) -> ... -> resolved (with `finalOutput`)
```

The consumer's Effect program calls `publish(value)` to update the accumulator. The lib validates `value` as a partial of `outputSchema` (Zod's `.partial()` works for `z.object()`; for unions/primitives the lib stores untyped partials with `outputPartial: false`). When the Effect program returns, the runner calls `write(value)`, which validates against the full schema and sets `finalOutput`.

A consumer that doesn't want streaming simply doesn't call `publish` — the node goes `running → resolved` with no `streaming` event. Streaming is opt-in.

### The render protocol (two modes, lib ships zero UI)

1. **Auto-render the whole graph.** For SSR, full-page renderers, the wall-display use case. The consumer subscribes to `"root"` and gets every event.
2. **Subscribe to a specific node.** For embedding workflow pieces in chat, modal popups, etc. The consumer subscribes to `nodeId` and gets events for that node and its subtree.

In both cases, the consumer supplies a renderer registry mapping `kind` → `(node, children) => UIElement`. The lib ships zero UI. The renderer receives a node plus its resolved subtree; it does not need to traverse the DAG itself.

The lib ships a reference React adapter and a no-op renderer for testing.

## Module map

```
underwai/
  src/
    types.ts                // WorkflowState, Node, Edge, ResolvedInput, InputSource
    schemas.ts              // Zod extensions (z.humanUpdatable)
    operations.ts           // init, get, serialize, deserialize, findReadyNodes, findSubtree
    runner.ts               // runWorkflow, the Effect-based execution loop
    events.ts               // WorkflowEvent union
    subscribe.ts            // subscribe() — node-level subscription over the event stream
    transports/
      in-process.ts         // default in-process transport: an AsyncIterable over an in-process channel
      sse.ts                // optional SSE adapter (v1.1)
      ws.ts                 // optional WebSocket adapter (v1.1)
    renderers/
      react.tsx             // reference React adapter
      no-op.ts              // for testing
  test/
    runner.test.ts
    streaming.test.ts
    human-input.test.ts
    subscribe.test.ts
    serialization.test.ts
  docs/
    design.md               // this file
```

## Load-bearing decisions

These are the decisions that make the design cohere. If you're tempted to change one, you should re-read the synthesis record at the bottom of this file.

1. **Flat typed DAG as single source of truth.** One `Node` type. No `ReduceNode`. The lib's input resolver is the reduce — multi-parent is a property of the topology, not a separate primitive. The data structure fits in your head and serializes cleanly to JSON.

2. **Effect is the composition language; the runner is the runtime.** Consumers write plain `Effect` programs. The lib ships no builder API, no DSL, no wrapper around Effect. The lib's job is narrow: data structure + runtime + transport. Composition is Effect's job.

3. **Zod schemas are the runtime authority for I/O.** Every node has `inputSchema` and `outputSchema`. The lib validates inputs on resolution, partials on `publish`, and finals on `write`. Serialized state has a Zod schema, not a TypeScript type. Renderers introspect schemas to know what they're rendering.

4. **The runner emits a transport-agnostic event stream.** `AsyncIterable<WorkflowEvent>`. SSR, wall displays, chat-embedded, and tests are all consumers of the same stream. The in-process channel is the reference transport; SSE/WS are v1.1 adapters.

5. **Human-in-the-loop is a property of the input schema, not a separate node kind.** A field is marked `humanUpdatable()` in the Zod schema. The lib exposes `writeHumanInput`. Setting a human value triggers subtree re-derivation — `findSubtree(state, nodeId)` returns the nodes to invalidate.

6. **Accumulator + final streaming.** The consumer's Effect program calls `publish(value)` for partials and returns a final value. Streaming is opt-in. Field-level streaming is a v1.x feature.

## Tradeoffs accepted

- **We accept the consumer writing more code** (schema + Effect program) in exchange for a strict, schema-literal contract at the serialization boundary. Schema-driven means the lib is the runtime authority, not "we'll validate the model output later."

- **We accept in-process transport as the only v1 transport** in exchange for the runner being a simple `AsyncIterable` over an in-process channel. SSE/WS are v1.1; the event stream is the seam.

- **We accept that the consumer's Effect program must call `publish` to stream** in exchange for streaming being opt-in and not requiring a new node kind, a new status, or a new data structure. The lib's accumulator is one optional field (`output`); the alternative (field-level streaming) is a bigger surface for marginal benefit.

- **We accept that the consumer's program has to be Effect** in exchange for the lib's composition story being Effect's composition story. The whole pitch is "Effect composition primitives as the workflow language." A plain-async adapter would be a contradiction.

- **We accept the dual type system (schema + Effect) is not type-checked at compile time** in exchange for the lib not requiring a builder or `defineNode`-style helper. C4's dual type guard is a v1.1 refinement; v1 ships with the runtime check (Zod) and trusts the consumer to keep their Effect program aligned with the schema.

## Alternatives considered

- **Explicit `reduce` node kind (Candidate 1).** Rejected. The data structure stays flat. Multi-parent is implicit in the lib's input resolver. A separate `ReduceNode` adds complexity without buying anything the consumer can't write in 3 lines.

- **Effect-program-driven types (Candidate 2).** Rejected. The serialized state would have a Zod schema but the in-memory value would have an Effect type — these can drift. Schema-driven means the runtime boundary is the schema, and the lib validates every step.

- **In-process-only transport (Candidate 2).** Rejected. SSR + wall + chat are all v1 use cases; transport-agnostic is the right call. The runner emits an `AsyncIterable<WorkflowEvent>`; transports are consumers.

- **Field-level streaming (Candidate 1).** Rejected for v1. The accumulator covers 90% of streaming cases. Field-level is a v1.x feature that requires a new node status, a `fieldStatus` map, and a more complex consumer API.

- **Dual type system with `defineNode` helper (Candidate 4).** Deferred to v1.1. v1 ships with the runtime check (Zod) and trusts the consumer. The `defineNode` helper is a future hardening; the v1 lib is more permissive.

- **Final-only streaming (Candidate 2).** Rejected. Long-running LLM calls deserve progressive text; the accumulator is a small addition for a real UX win.

## Synthesis decision

The arena process produced four candidate designs:

| Candidate | Reduce | Transport | Types | Streaming |
|---|---|---|---|---|
| C1 | explicit | agnostic | schema | field-level |
| C2 | implicit | in-process | effect | final |
| C3 | implicit | agnostic | schema | accumulator |
| C4 | implicit | agnostic | dual | accumulator |

**Base: Candidate 3.** Cross-judge scores: C1=22, C2=26, C3=29, C4=28 (out of 30). C3 wins on the "runner is boring" criterion — the most reliable indicator of "this lib will be small enough to fit in your head." C3 and C4 converge on three of the four pivots; the divergence on type system mechanics is a v1.x refinement, not a v1 must-have.

**Grafts from losers:**

- From C4: the *concept* of a `defineNode` helper as a v1.1 feature. v1 ships without it; the schema + Effect program are both required but not type-checked against each other. C4's `defineNode` is the future v1.1 hardening.
- From C2: the in-process `WorkflowEventBus` (`bus.on(handler) => unsubscribe`) as the reference in-process transport for the transport-agnostic event stream. C3 keeps the `AsyncIterable<WorkflowEvent>` as the primary API but documents the in-process bus as the default transport.

**Rejections from losers:**

- C1's explicit `ReduceNode` — rejected; the data structure stays flat.
- C1's `path` on `from_node` — rejected; the consumer picks a field off the parent's output in their Effect program's destructuring, not in the data structure.
- C1's field-level streaming — rejected for v1; accumulator covers 90% of cases.
- C2's in-process-only transport — rejected; SSR + wall + chat are v1 use cases.
- C4's `defineNode` helper — deferred to v1.1.

**Convergence signal:** C3 and C4 converge on three of four pivots (implicit reduce, transport-agnostic, accumulator streaming). The divergence on type system mechanics is a v1.x refinement, not a v1 must-have. Strong agreement on the core shape.

## Open questions and risks

- **Long-running workflow durability.** Resume = `init(definition) + deserialize(state) + findReadyNodes`. But are Effect programs idempotent? Are there non-deterministic side effects in the consumer's program? "use workflow" has opinions about this; we should too. (Defer to v1.1; v1 ships the resume primitive and trusts the consumer.)
- **Partial validation edge cases.** Zod's `.partial()` works cleanly for `z.object()`. For `z.string()`, `z.number()`, etc., the lib can't enforce "this is a partial" — it just stores untyped partials with `outputPartial: false`. Is this acceptable? (My read: yes; the final validation is what matters for typed outputs.)
- **The schema + Effect program drift risk.** C4's `defineNode` would catch drift at compile time. v1 catches it at runtime via Zod validation. This is a known gap, deferred to v1.1.
- **The transport stream's backpressure.** The runner returns an `AsyncIterable<WorkflowEvent>`. Long-running workflows with many subscribers need backpressure. The in-process transport (v1) handles this naturally; v1.1 transports (SSE/WS) need to be designed with this in mind.

## Next implementation step

Write the TS stub in `src/types.ts` and `src/operations.ts` — the data structure and the state-derivation functions (`findReadyNodes`, `findSubtree`). These are the smallest pieces that prove the design compiles and that the data structure's invariants hold. The runner, schemas, events, and subscribe come next, in that order.

The TS stub ships alongside this file as `src/stub.ts` — a complete type-level proof that the design compiles, with `throw new Error("not implemented")` bodies. Implementation fills in body-by-body against this contract.
