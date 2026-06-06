---
title: "Architecture"
type: module
parent: ../index.md
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# Architecture

## The data structure (key-addressable, flat, single source of truth)

The data structure is a flat DAG of typed nodes plus an edge list, with **every node addressable by a deterministic, type-safe key**. It is JSON-serializable and is the *only* state. There is no separate runtime memory.

### `WorkflowState`

```ts
type WorkflowState = {
  id: WorkflowId
  version: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'

  // Key-addressable. O(1) lookup by path.
  nodes: Record<string, Node>
  // Edges are structural metadata; not directly addressed.
  edges: ReadonlyArray<Edge>

  createdAt: string
  updatedAt: string
  error?: SerializedError
}
```

### `Node`

```ts
type Node = {
  id: NodeKey                    // e.g. "root.refine[1]"
  kind: string                   // consumer-defined node kind
  label?: string

  inputSchema: ZodTypeAny
  input: ResolvedInput
  // Computed from inputSchema at init(). Tells the runner which fields are
  // human-writable and whether they require pre-run confirmation.
  humanFields: ReadonlyMap<FieldKey, HumanMode>

  outputSchema: ZodTypeAny
  output?: unknown               // ACCUMULATOR (current partial)
  outputPartial: boolean
  finalOutput?: unknown          // ACCUMULATOR validated against full schema
  status: 'pending' | 'ready' | 'running' | 'streaming' | 'resolved' | 'failed' | 'paused' | 'stale'

  actor: 'system' | 'human' | string
  createdAt: string
  updatedAt: string
}
```

### `ResolvedInput`

```ts
type ResolvedInput = {
  fields: Record<FieldKey, InputSource>
}

type InputSource =
  | { kind: 'literal'; value: unknown }
  | { kind: 'from_node'; nodeId: NodeKey }      // multi-parent is implicit
  | {
      kind: 'human'
      fieldSchema: ZodTypeAny
      value?: unknown
      status: 'pending' | 'set'
    }
```

### `Edge`

```ts
type Edge = {
  from: NodeKey
  to: NodeKey
  toField: FieldKey
}
```

### `NodeKey`

```ts
type NodeKey<Path extends string = string> = string & {
  readonly __path: Path
  readonly __brand: 'NodeKey'
}
```

The `Path` is a template-literal type carried through the composition API. Consumers never construct `NodeKey` directly — the composition API produces them.

## Composition API (the only way to create nodes)

The consumer never types node keys. They use a small set of combinators that return `NodeRef<Path>` handles:

- `run(def)` — a single node. Key: `"root"`.
- `.then(def)` — sequential composition. Key: `"${parent.path}.${def.kind}"`.
- `.all(...refs)` — parallel composition. Array form: discriminated union output. Object form: record output. Keys: `"${parent.path}.all[N]"` or `"${parent.path}.all.${key}"`.
- `.thenLoop(body, predicate)` — iterative composition. Produces a family of nodes: `root.refine[0]`, `root.refine[1]`, ..., `root.refine.final`. The body, predicate, and final are all real nodes in the DAG.

Multi-parent (fan-in) is implicit. The lib's input resolver gathers all upstream outputs into a node's input. No explicit `reduce` primitive.

## Runtime (state machine, no event stream)

The runner is a state machine. Subscriptions are direct readers. There's no `WorkflowEvent` stream in the consumer-facing API.

### Mutation primitives

- `init(definition): WorkflowState` — build the initial state from a composition expression.
- `getNode(state, key): Node` — read a node.
- `serialize(state) → string` / `deserialize(json) → state` — persistence.
- `findReadyNodes(state): Set<NodeKey>` — walk the DAG, return nodes whose inputs are complete and status is `pending` or `stale` (ready to run or re-run).
- `findSubtree(state, root): Set<NodeKey>` — all nodes transitively downstream of `root`.
- `publish(state, key, partial): state'` — accumulator update. Validated as a partial of `outputSchema`.
- `write(state, key, finalOutput): state'` — final write. Validated against the full `outputSchema`.
- `writeHumanInput(state, nodeKey, fieldKey, value): state'` — set a human-writable field. Triggers the state-machine transition based on the node's current status.
- `step(state): state'` — the runner loop: find ready nodes, run their Effect programs, update state.

### Node lifecycle state machine

```
pending → ready → running → resolved
                       ↑         ↓ (input changed via writeHumanInput)
                       │       stale
                       │         ↓
                       │       ready ─→ paused (if input has verified fields)
                       │                          ↓ (writeHumanInput)
                       │                       ready
                       │                          ↓
                       │                       running → resolved
                       ↑
                       │ (upstream re-execution changes the input)
                       │ → stale → ready (or paused for verified)
```

The `paused` state is entered when a node has `verified` fields in its input schema and the gate is open (the field's source is `{ kind: "human", status: "pending" }`). The node is `paused` until `writeHumanInput` is called, which sets the field to `status: "set"`, closes the gate, and the node transitions to `ready`.

When an upstream re-execution changes a node's input, the node's status flips to `stale` (not `paused`). When the runner picks up the `stale` node, it transitions to `ready`, and *if* the input has `verified` fields, it then transitions to `paused` for re-confirmation.

**Staleness propagation:** when a node goes `stale`, the downstream subtree is marked `stale` too. Sibling subtrees (other branches of a fan-out that don't depend on the changed input) are unaffected. `findSubtree(state, staleNodeKey)` returns the descendants to invalidate.

## Subscription (Node-granularity, not event-granularity)

```ts
function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (node: Node) => void,
  opts?: { exact?: boolean }
): Subscription
```

The callback receives the **full updated `Node`**. The consumer's renderer switches on `node.status`:

```ts
subscribe(state, "root.refine.final" as NodeKey, (node) => {
  switch (node.status) {
    case "pending":   renderPending(); break
    case "ready":     renderReady(); break
    case "running":   renderRunning(); break
    case "streaming": renderStreaming(node.output); break
    case "resolved":  renderResolved(node.finalOutput); break
    case "paused":    renderPaused(node); break
    case "stale":     renderStale(node); break
    case "failed":    renderFailed(node); break
  }
})
```

Subscription matches by key prefix by default. `subscribe(state, "root.refine", onUpdate)` matches every node in the loop family. The consumer can opt into exact match: `subscribe(state, "root.refine.final", onUpdate, { exact: true })`.

**Wire format (v1.1+) is `WorkflowEvent`-driven.** Transports (SSE, WebSocket) consume a more minimal `WorkflowEvent` stream from the runner. The in-process `Node`-granularity model is a *projection* of the same event log.

## Streaming (accumulator + final)

The consumer's Effect program calls `publish(value)` to update the accumulator. The lib validates the value as a partial of `outputSchema`. When the Effect program returns, the runner calls `write(value)`, which validates against the full schema and sets `finalOutput`.

Subscribers to the node get the updated `Node` with `output` set and `status: "streaming"`. When the node resolves, they get the node with `finalOutput` set and `status: "resolved"`.

A consumer that doesn't want streaming simply doesn't call `publish` — the node goes `running → resolved` with no `streaming` state. Streaming is opt-in.

## Human-in-the-loop

### Schema extension

```ts
declare module "zod" {
  namespace z {
    function human<T extends ZodTypeAny>(schema: T): HumanSchema<T>
  }
}

type HumanSchema<T> = T & {
  __humanMode: HumanMode
  verified(): HumanSchema<T>
}
```

`z.human(z.string())` flags a field as human-writable. `.verified()` is a decorator that gates on human confirmation *before* the node runs.

**Two modes:**

- `z.human(z.string())` — `__humanMode: "writeable"`. The field is human-writable. The node runs with the seeded value (from upstream, or `undefined` if no seed). The human can update the field later via `writeHumanInput`, which marks the node `stale` and propagates `stale` downstream.

- `z.human(z.string()).verified()` — `__humanMode: "verified"`. The field is human-writable AND the node pauses for human confirmation *before* running. The human *must* engage.

### One API: `writeHumanInput`

The API sets the field's value. The runner's state machine handles the rest:

- if the node was `paused` (waiting for verified input), the field is now `"set"`, the gate closes, the node transitions to `ready`.
- if the node was `resolved`, the input has changed, the node transitions to `stale`. Re-execution is queued. Downstream subtree is marked `stale`.
- if the node was `pending` / `ready`, the input is now complete, the node transitions to `ready`.

The "starting value" the human sees (proposed, current, or empty) is a property of the field's state when the API is called. The renderer reads `node.input.fields[fieldKey]` and decides. The API doesn't distinguish.

### Verified gate resets on parent re-execution

When an upstream re-execution changes a node's input, the node's status flips to `stale` and (when the runner picks it up) to `paused` again. The gate is tied to the node's *input*, not the workflow's identity.

## Decisions (2026-06-06 arena + design conversation)

These decisions are now settled. See `docs/design.md` for the full rationale and synthesis record.

- **Reduce semantics:** IMPLICIT. The lib's input resolver IS the reduce.
- **Transport:** In-process: Node-granularity. Wire: WorkflowEvent-driven (v1.1).
- **Type system mechanics:** SCHEMA-DRIVEN. Zod is the runtime authority; `Effect<Output, ...>` is the static authority. `defineNode` deferred to v1.1.
- **Streaming:** ACCUMULATOR + FINAL.
- **Node addressability:** KEYED by `NodeKey<Path>`. `Record<string, Node>`. Composition API produces keys; consumers never type them.
- **Composition:** `run`, `.then`, `.all` (overloaded), `.thenLoop(body, predicate)`. The only ways to create nodes.
- **Loop shape:** FAMILY of nodes (`root.refine[N]`) + `root.refine.final`. Body and predicate are real nodes in the DAG.
- **Subscription:** `subscribe(state, key, onUpdate(node))`. Node-granularity in-process. Wire format is `WorkflowEvent`.
- **Human modes:** `z.human()` writeable, `.verified()` for hard-pause. One API: `writeHumanInput`.
- **Staleness:** Node-level, not per-field. `stale` propagates downstream; siblings unaffected.

## Open architectural questions (deferred to v1.1+)

- **`defineNode` helper for dual type guard.** Schema and Effect program are both required but not type-checked against each other in v1.
- **Long-running workflow durability.** Resume primitive exists; idempotency of consumer Effect programs is not enforced.
- **SSE / WebSocket transports.** v1.1 adapters consume the `WorkflowEvent` stream.
- **Reference React adapter.** v1.1.
- **AI SDK adapter.** v1.1.
