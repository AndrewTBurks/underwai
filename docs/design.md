# underwAI — Design (v1)

This is the v1 design for underwAI. It supersedes the candidate-3 design from the 2026-06-06 arena, incorporating feedback from the design conversation: nodes are key-addressable, the composition API is the only way to create nodes, the subscription model is `Node`-granularity (not event-granularity), the human-in-the-loop has two modes (`writeable` and `verified`), and the verbosity of the prior design is reduced.

## Problem

We want a library that lets a developer define a workflow as a flat, typed DAG. The library executes the workflow by walking the DAG, running consumer-supplied Effect programs at each node, validating the typed outputs against Zod schemas, and writing them back to the same data structure. The data structure is the source of truth; it can be serialized, persisted, resumed, and rendered.

Existing libraries don't have this shape:
- **AI SDK** gives a chat surface with tool calls. Generative UIs are a switch over message parts.
- **langgraph** gives a Python orchestrator with opaque checkpoints. The data structure exists but is not the interface.
- **instructor** gives structured outputs from LLMs, bolted onto a chat surface.
- **"use workflow"** gives resumable workflows, but the runtime is vercel-locked.
- **Effect** is a runtime, not a workflow library.

underwAI fuses these: typed outputs at every node, Effect composition, durable data structure as the single source of truth, human-in-the-loop as a compositional primitive, renderers as a thin subscription layer. **Every node is addressable by a deterministic, type-safe key.**

## Shape

### Composition API (the only way to create nodes)

The consumer never types node keys. They use a small set of combinators that return handles, and the handles carry the keys as template-literal types:

```ts
// Combinators
function run<S extends ZodTypeAny>(def: NodeDef<S>): NodeRef<"root">
function then<S extends ZodTypeAny>(parent: NodeRef, def: NodeDef<S>): NodeRef<"${parent.path}.${def.kind}">
function all(...args: [...NodeRef[]]): NodeRef<"${parent.path}.all[N]">         // array form: discriminated union output
function all(args: Record<string, NodeRef>): NodeRef<"${parent.path}.all.${key}"> // object form: record output
function thenLoop<B, P>(
  body: (prev: NodeRef) => NodeRef,        // body returns the next iteration
  predicate: (current: NodeRef) => NodeRef // predicate returns boolean
): NodeRef<"${parent.path}.${...}">        // produces a family of nodes
```

**Key invariants:**

1. The consumer never types a node key as a string. Keys are produced by the composition API and carried as template-literal types on the returned `NodeRef<Path>`.
2. The composition API is the only way to create nodes. There is no `addNode(state, ...)` API.
3. Multi-parent (fan-in) is implicit. The lib's input resolver gathers all upstream outputs into a node's input. No explicit `reduce` primitive.
4. `thenLoop` produces a *family* of nodes: `root.refine[0]`, `root.refine[1]`, ..., `root.refine.final`. Each iteration's body and predicate are real nodes in the DAG.
5. `z.human(schema)` flags a field as human-writable. `.verified()` is a decorator that gates on human confirmation *before* the node runs.

### Data structure (flat, keyed, single source of truth)

```ts
// The branded key type. Path is a template-literal type carried through
// composition. Consumers never construct these directly.
type NodeKey<Path extends string = string> = string & {
  readonly __path: Path
  readonly __brand: "NodeKey"
}

type WorkflowId = string & { readonly __brand: "WorkflowId" }

type FieldKey = string

// Node lifecycle. The discriminator is `status.kind`. Each variant
// carries only the data that variant owns — there is no `output` on
// `pending`, no `error` on `running`, no `outputPartial` on
// `resolved`. The type system enforces "illegal states are
// unrepresentable" at the node level. Shared fields (id, kind,
// inputSchema, etc.) live on `Node`; the per-status data lives
// here. See the `Node` type for the full shape.
type NodeStatus =
  | { kind: "pending" }
  | { kind: "running"; startedAt: string }
  | { kind: "streaming"; output: unknown; outputPartial: boolean }
  | { kind: "resolved"; finalOutput: unknown; resolvedAt: string }
  | { kind: "failed"; error: SerializedError; failedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "stale"; previousOutput?: unknown }

type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"       // at least one node is paused on verified input
  | "completed"
  | "failed"

type Actor = "system" | "human" | (string & {})

type ResolvedInput = {
  fields: Record<FieldKey, InputSource>
}

type InputSource =
  | { kind: "literal"; value: unknown }
  | { kind: "from_node"; nodeId: NodeKey }
  | {
      kind: "human"
      fieldSchema: ZodTypeAny
      value?: unknown
      status: "pending" | "set"
    }

// Node. Shared fields are on the type once. Per-status data lives
// in `node.status` (a discriminated union). The lib derives the
// human-fields view on read via `getHumanFields(node)` — no
// `humanFields` cache on the node. Output/error/etc. live on the
// status variants that own them.
type Node = {
  id: NodeKey
  kind: string
  label?: string

  inputSchema: ZodTypeAny
  input: ResolvedInput

  outputSchema: ZodTypeAny

  // The current node status. The kind discriminator tells you
  // which fields are present (output, error, etc.).
  status: NodeStatus

  actor: Actor
  createdAt: string
  updatedAt: string
}

type Edge = {
  from: NodeKey
  to: NodeKey
  toField: FieldKey
}

type SerializedError = {
  nodeId: NodeKey
  message: string
  cause?: SerializedError
}

type WorkflowState = {
  id: WorkflowId
  version: number
  status: WorkflowStatus

  // Key-addressable. O(1) lookup.
  nodes: Record<string, Node>
  // Edges are structural metadata; not directly addressed.
  edges: ReadonlyArray<Edge>

  // Derived fields. Computed at init() and on deserialize().
  // NOT serialized — recomputed from `edges` on every deserialize.
  // See "Serialization contract" below.
  edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>  // for findReadyNodes
  edgesByFrom: Record<NodeKey, ReadonlyArray<Edge>>    // for findSubtree

  createdAt: string
  updatedAt: string
  error?: SerializedError
}
```

**Verbosity reductions from the prior design:**
- `Record<string, Node>` instead of `ReadonlyArray<Node>`. No `Readonly` wrappers; immutability is by convention (the runner always returns a new state).
- No `inputs` / `outputs` arrays. Workflow has a conventional root key; the consumer's composition API defines inputs/outputs.
- `Node["status"]` is a discriminated union. Each variant carries only the data that variant owns — no `output?: unknown` ambiguity, no `outputPartial: boolean` on non-streaming nodes, no `error?` on non-failed nodes. The type system enforces "illegal states are unrepresentable" at the node level.

**Serialization contract.** `WorkflowState` carries two kinds of fields: **source fields** (`nodes`, `edges`, `error`, `id`, `version`, `status`, `createdAt`, `updatedAt`) and **derived fields** (`edgesByTarget`, `edgesByFrom`, future derived fields). The contract is:

- `serialize(state)` is a pure projection of the source fields. Derived fields are *not* serialized.
- `deserialize(json)` recomputes all derived fields. The recompute is total: every derived field the lib defines is rebuilt from `edges`.
- Mutation primitives (`init`, `write`, `publish`, `writeHumanInput`, `stepInternal`) do *not* invalidate derived fields, because derived fields are derived from `edges` and the topology is set at `init()` and never changes mid-workflow.
- Adding a new derived field to `WorkflowState` is not a breaking change. Adding a new source field is a breaking change (it changes the serialized shape).

This contract is named once, in TASK-F, because TASK-R also adds a derived field and a future plan will add another. The pattern needs to be explicit, not implicit, or the lib will drift.

### Runtime (state machine, no event stream)

The runner is a state machine. Subscriptions are direct readers. There's no `WorkflowEvent` stream in the consumer-facing API.

```ts
// Core operations
function init(definition: WorkflowDefinition): WorkflowState
function getNode(state: WorkflowState, key: NodeKey): Node
function serialize(state: WorkflowState): string
function deserialize(json: string): WorkflowState

// State derivation
function findReadyNodes(state: WorkflowState): Set<NodeKey>
function findSubtree(state: WorkflowState, root: NodeKey): Set<NodeKey>

// Mutation primitives (used by the runner)
function publish(state: WorkflowState, key: NodeKey, partial: unknown): WorkflowState
function write(state: WorkflowState, key: NodeKey, finalOutput: unknown): WorkflowState
function writeHumanInput(
  state: WorkflowState,
  nodeKey: NodeKey,
  fieldKey: FieldKey,
  value: unknown
): WorkflowState

// Primary API. The lib owns the runner fiber. The consumer drives the
// workflow forward by calling this Effect program; multiple concurrent
// `runWorkflow` calls would each own their own fiber, but the typical
// pattern is one `runWorkflow` per workflow instance for the lifetime
// of the consumer's session.
function runWorkflow(
  definition: NodeDefinition,
  state?: WorkflowState
): Effect.Effect<WorkflowState, never, never>

// The service a consumer's `Effect.gen` program yields to call
// publish / write / writeHumanInput. The service is provided by the
// `runWorkflow` Effect program as a layer; consumer programs that run
// outside `runWorkflow` will not have access to the service. The
// service is a class extending Effect's `Context.Tag` — the class
// name is both the type and the value; consumers do
// `yield* WorkflowRuntime` inside their `Effect.gen` program.
type WorkflowRuntime = {
  publish(partial: unknown): Effect.Effect<void>
  write(finalOutput: unknown): Effect.Effect<void>
  writeHumanInput(fieldKey: FieldKey, value: unknown): Effect.Effect<void>
}

// Low-level primitive. Internal. NOT consumer-facing. Concurrent
// calls are unsafe: two `stepInternal` calls in flight will find the
// same ready nodes, start duplicate Effect programs, and clobber
// state. Tests may use this; consumers must use `runWorkflow`.
function stepInternal(state: WorkflowState): WorkflowState
```

**Node lifecycle state machine:**

| Status | When entered | Transitions out | Renderer shows |
|---|---|---|---|
| `pending` | `init()` or upstream rerun | → `running` (input complete), → `paused` (verified gate open) | nothing (waiting) |
| `running` | `step` picks up the node | → `streaming` (publish), → `resolved` (return), → `failed` (error) | "running" indicator |
| `streaming` | `publish()` called | → `resolved` (return), → `failed` (error) | partial output |
| `resolved` | program returns, validated | → `stale` (input changed) | final output |
| `failed` | error or `Effect.fail` | → `stale` (writeHumanInput retry) | error + `error` field |
| `paused` | input has open `verified` gate | → `pending` (gate closes via `writeHumanInput`) | "needs your input" UI |
| `stale` | input changed, output no longer current | → `running`, → `paused` (verified gate) | previous value + "re-deriving" |

**Mid-execution `writeHumanInput` (when the node is `running` or `streaming`):** the runner marks the node `stale` and interrupts the in-flight Effect fiber via Effect's standard `Fiber.interrupt` primitive. The interrupted effect's output is discarded. The node re-runs with the new input. The transition is `running → stale → running` (or `running → stale → paused` if the input has open `verified` fields). Implementation gated on TASK-B's `runWorkflow` owning the fiber; the policy is defined here.

The runner picks up nodes whose status is `pending` or `stale` and whose inputs are complete. `findReadyNodes(state): Set<NodeKey>` returns exactly that set. The runner processes them in `topologicalOrder` and transitions them to `running`. Per-status semantics are documented in `.cns/architecture/index.md` (the source of truth).

**Staleness propagation:** when a node goes `stale`, the downstream subtree is marked `stale` too. Sibling subtrees (other branches of a fan-out that don't depend on the changed input) are unaffected. `findSubtree(state, staleNodeKey)` returns the descendants to invalidate.

### Subscription (three methods, three jobs)

```ts
type Subscription = {
  unsubscribe(): void
}

// 1. Subscribe to a single node. Exact match on the key. The
// callback gets the full updated Node.
function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (node: Node) => void
): Subscription

// 2. Subscribe to every node in the workflow. No key. The
// wall-display case (TASK-D). The callback gets the full updated
// Node with its original key.
function subscribeAll(
  state: WorkflowState,
  onUpdate: (node: Node) => void
): Subscription

// 3. Wildcard pattern. The pattern is a string with `*` as the
// path-segment wildcard suffix: "root.*" matches all descendants
// of "root." A bare "*" matches every node. The callback gets
// the matched set as a Record keyed by relative key — the prefix
// is stripped, so subscribeSet is a "namespace raise," not a
// filter. The consumer sees relative keys ("x", "y", "refine[0]");
// for "*", the prefix is empty and the keys are the full original
// keys. One consistent shape across all patterns.
function subscribeSet(
  state: WorkflowState,
  pattern: string,
  onUpdate: (nodes: Record<string, Node>) => void
): Subscription
```

The three methods are distinct paths, not flags on a single method. There is no `prefix`, no `exact`, no `batched`, no `delta` option in v1. Each method's signature is its type.

**Pattern grammar.** Three cases, all in `subscribeSet`:
1. **Exact key.** `"root.x"` matches only `"root.x"`. Same as `subscribe` with a single key, but the callback gets a one-entry record.
2. **Path-segment prefix.** Pattern ends in `.*`. `"root.*"` matches every node whose key starts with `"root."` (path-segment rule, dot is the boundary). The prefix is stripped from the keys in the callback's record.
3. **Every node.** Bare `"*"`. Matches every node. The prefix is empty, so the relative key equals the full key.

The pattern grammar is the type. No `prefix` / `exact` flag, no `batched` / `delta` option.

**Renderers subscribe, the lib never invents one.** The renderer picks the method that matches its need; the lib does not pick for it. The wall-display uses `subscribeSet(state, "*", onUpdate)`. The loop-family consumer uses `subscribeSet(state, "root.refine.*", onUpdate)`. The single-node consumer uses `subscribe(state, "root.x" as NodeKey, onUpdate)`.

The `subscribe` callback receives the **full updated `Node`**. The consumer's renderer switches on `node.status`:

```ts
const sub = subscribe(state, "root.refine.final" as NodeKey, (node) => {
  switch (node.status) {
    case "pending":   renderPending(); break
    case "running":   renderRunning(); break
    case "streaming": renderStreaming(node.output); break
    case "resolved":  renderResolved(node.finalOutput); break
    case "paused":    renderPaused(node); break
    case "stale":     renderStale(node); break
    case "failed":    renderFailed(node); break
  }
})
```

The `subscribeSet` callback receives the matched set keyed by relative key. A renderer that wants per-node status switching iterates `Object.values(nodes)`:

```ts
const sub = subscribeSet(state, "root.refine.*", (nodes) => {
  for (const node of Object.values(nodes)) {
    switch (node.status) {
      case "pending":   renderPending(node); break
      case "running":   renderRunning(node); break
      case "streaming": renderStreaming(node); break
      case "resolved":  renderResolved(node); break
      case "paused":    renderPaused(node); break
      case "stale":     renderStale(node); break
      case "failed":    renderFailed(node); break
    }
  }
})
```

The `subscribe` callback receives the **full updated `Node`**. The consumer's renderer switches on `node.status`:

```ts
const sub = subscribe(state, "root.refine.final" as NodeKey, (node) => {
  switch (node.status) {
    case "pending":   renderPending(); break
    case "running":   renderRunning(); break
    case "streaming": renderStreaming(node.output); break
    case "resolved":  renderResolved(node.finalOutput); break
    case "paused":    renderPaused(node); break
    case "stale":     renderStale(node); break
    case "failed":    renderFailed(node); break
  }
})
```

### Streaming (accumulator + final)

The consumer's Effect program calls `publish(value)` to update the accumulator. The lib validates the value as a partial of `outputSchema`. When the Effect program returns, the runner calls `write(value)`, which validates against the full schema and sets `finalOutput`.

Subscribers to the node get the updated `Node` with `output` set and `status: "streaming"`. When the node resolves, they get the node with `finalOutput` set and `status: "resolved"`.

A consumer that doesn't want streaming simply doesn't call `publish` — the node goes `running → resolved` with no `streaming` state. Streaming is opt-in.

### Human-in-the-loop (z.human + .verified)

```ts
declare module "zod" {
  namespace z {
    function human<T extends ZodTypeAny>(schema: T): HumanSchema<T>
  }
}

type HumanSchema<T> = T & {
  __humanMode: "writeable" | "verified"
  verified(): HumanSchema<T>
}
```

**Two modes:**

1. `z.human(z.string())` — `__humanMode: "writeable"`. The field is human-writable. The node runs with the seeded value (from upstream, or `undefined` if no seed). The human can update the field later via `writeHumanInput`, which marks the node `stale` and propagates `stale` downstream.

2. `z.human(z.string()).verified()` — `__humanMode: "verified"`. The field is human-writable AND the node pauses for human confirmation *before* running. The seeded value is shown as a "proposed" value in the renderer; the human either accepts it (writes the proposed value back via `writeHumanInput`) or types a new value and writes that. The human *must* engage — there's no "skip verification" path.

**Runtime implementation.** The `__humanMode` field is a *type-level* marker only; it does not exist on the runtime schema object. The lib reads the mode at runtime from a marker on the schema's `_def` object:

```ts
export function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
  const wrapped = (schema as any).clone?.() ?? schema
  ;(wrapped._def as any).humanMode = "writeable"
  ;(wrapped as any).verified = function(this: HumanSchema<T>) {
    ;(this._def as any).humanMode = "verified"
    return this
  }
  return wrapped as HumanSchema<T>
}

export function getHumanMode(schema: ZodTypeAny): "writeable" | "verified" | undefined {
  return (schema._def as any)?.humanMode
}
```

The schema is cloned before mutation to prevent shared-mutation across `z.human()` callsites. Target: Zod 3.x. The Zod 4.x `.meta()` API is the principled answer for a future version; for v1 we mutate `_def`.

**The verified gate resets on parent re-execution.** When an upstream re-execution changes a node's input, the node's status flips to `stale` and (when the runner picks it up) to `paused` again. The human is asked to re-confirm. The gate is tied to the node's *input*, not the workflow's identity.

**Seed vs. no-seed vocabulary.** `HumanMode` ("writeable" | "verified") says the field is human-editable. It does not say whether the field has a *seed* — an initial value the human can accept, override, or leave alone. A seed comes from one of three places:
- A `from_node` source — upstream's `finalOutput` flows into this field.
- A `literal` source — the workflow author hardcoded a default.
- A `human` source with no value yet — no seed; the human must provide one.

The renderer composes `InputSource.kind` (TASK-H) with `HumanMode` to answer "is this a proposal?" The lib exposes the source; the renderer decides the UX. TASK-S's `getHumanInputDisplay` is the typed join.

**One API for human writes:**

```ts
function writeHumanInput(
  state: WorkflowState,
  nodeKey: NodeKey,
  fieldKey: FieldKey,
  value: unknown
): WorkflowState
```
The API sets the field's value. The runner's state machine handles the rest:

- if the node was `paused` (waiting for verified input), the field is now `"set"`, the gate closes, the runner sees the input as complete and treats the node as `pending`. The next `step` picks it up: `pending → running`.
- if the node was `resolved`, the input has changed, the node transitions to `stale`. Re-execution is queued. Downstream subtree is marked `stale`.
- if the node was `pending`, the input is now complete, the node is ready to be picked up: `pending → running` on the next `step`.

The "starting value" the human sees (proposed, current, or empty) is a property of the field's state when the API is called. The renderer reads `node.input.fields[fieldKey]` and decides. The API doesn't distinguish.

### Effect integration (consumer-facing API)

```ts
// A node definition. The consumer supplies the schema, the kind, and an Effect program.
type NodeDefinition<TInput, TOutput, TError, TRequirements> = {
  id: NodeKey
  kind: string
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  program: (input: TInput) => Effect.Effect<TOutput, TError, TRequirements>
}
```

The consumer writes plain Effect programs. The lib wraps them with the runner's `publish` / `write` / `writeHumanInput` semantics:

```ts
const summarize: NodeDefinition<{ text: string }, { summary: string }, never, never> = {
  id: "summarize" as NodeKey,
  kind: "summarize",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  program: (input) => Effect.succeed({ summary: await callLLM(input.text) }),
}
```

The lib validates the program's output against `outputSchema` (Zod) at runtime. Type-level alignment between `program`'s success type and `outputSchema`'s inferred type is a v1.1 hardening (`defineNode` helper from Candidate 4 of the arena).

### Workflow definition (consumer-facing)

```ts
type WorkflowDefinition = {
  name: string
  version: number
  root: NodeRef
  // nodes and edges are derived from the composition at init() time.
}
```

The consumer writes a composition expression. The lib walks it, builds the data structure, populates `state.nodes` and `state.edges`. There's no separate "list of nodes" — the composition is the definition.

## Load-bearing decisions

1. **Key-addressable flat DAG.** Every node has a deterministic path-based key. The consumer never types keys; the composition API produces them. `state.nodes[key]` is O(1) lookup.

2. **Composition API is the only way to create nodes.** No `addNode(state, def)`. The consumer's composition expression *is* the definition. This is what makes keys type-safe.

3. **Effect programs are the only required behavior.** Plain `Effect<Output, Error, Requirements>`. The lib is a runtime, not a language. No builder, no DSL, no wrapper.

4. **Zod schemas are the runtime authority.** `inputSchema` and `outputSchema` per node. Partial validation on `publish`, full validation on `write`. The lib validates at every step; the consumer trusts the schema.

5. **`z.human()` is the marker, `.verified()` is the gate.** Two modes for human-writable fields. The marker is a Zod extension; the gate is a decorator. The runner's state machine handles the transitions.

6. **One API for human writes: `writeHumanInput`.** The "starting value" (proposed, current, or empty) is a property of the field's state. The API doesn't distinguish. The runner decides the node's status transition.

7. **In-process subscription is Node-granularity, not event-granularity.** `subscribe(state, key, onUpdate)` calls back with the full updated `Node`. The renderer switches on `node.status`. The wire format (v1.1+) is `WorkflowEvent`-driven.

8. **Staleness is a node-level property, not a per-field marker.** When a node's input changes, the node goes `stale`. Downstream subtree propagates. Siblings unaffected.

9. **Loops are a family of nodes.** `root.refine[0]`, `root.refine[1]`, ..., `root.refine.final`. The body and predicate are real nodes in the DAG. The final node is `pending` until the loop settles.

10. **Multi-parent (fan-in) is implicit.** The lib's input resolver gathers all upstream outputs into a node's input. No explicit `reduce` primitive.

11. **Transport-agnostic by construction.** The in-process model is a synchronous function call. The wire format is an event stream. Both are derived from the runner's state machine. SSE/WS are v1.1+ adapters.

12. **No `Readonly` wrappers in the data structure.** Immutability is by convention. The runner always returns a new state.

## Module map

```
underwai/
  src/
    types.ts                // WorkflowState, Node, Edge, ResolvedInput, InputSource
    keys.ts                 // NodeKey type, branded constructor
    composition.ts          // run, then, all, thenLoop (the only ways to create nodes)
    schemas.ts              // z.human() + .verified() extension
    operations.ts           // init, get, serialize, deserialize, findReadyNodes, findSubtree
    runner.ts               // step, publish, write, writeHumanInput, runWorkflow
    subscribe.ts            // subscribe() — Node-granularity subscription
    events.ts               // WorkflowEvent union (wire format only)
    transports/
      in-process.ts         // default: synchronous function-call to subscribers
      sse.ts                // v1.1
      ws.ts                 // v1.1
    renderers/
      react.tsx             // v1.1
      no-op.ts              // for testing
  test/
    composition.test.ts     // key shape, multi-parent, loop family, all overloads
    runner.test.ts          // state machine, pending/pause/stale transitions
    human-input.test.ts     // writeable vs verified, gate reset on parent re-execution
    streaming.test.ts       // publish/write, accumulator semantics
    subscribe.test.ts       // Node-granularity, prefix matching
    serialization.test.ts   // round-trip
  docs/
    design.md               // this file
```

## Tradeoffs accepted

- **The consumer writes more code (schema + Effect program) in exchange for a strict, schema-literal contract.** The lib is the runtime authority, not "we'll validate the model output later."

- **The composition API is restrictive in exchange for type-safe keys.** Consumers can't add a node by hand outside the composition API. This is what makes the keys carry real type information.

- **Subscription callbacks are whole-Node, not deltas, in exchange for simpler renderer code.** The consumer re-renders on every status change. For partial updates, the consumer can diff the previous and current `Node`, or use a `node.updatedAt` timestamp to skip renders.

- **The runner's state machine is the source of truth, not the consumer's mental model.** The consumer learns "writeHumanInput transitions the node based on its current status" once, then it just works. No separate `confirm` API.

- **Loops are a family of nodes, not a `loop` node kind, in exchange for full composability.** The body, predicate, and final are all real nodes. The consumer can subscribe to any of them.

- **The dual type system (schema + Effect) is not compile-time enforced in v1.** v1 ships with the runtime check (Zod) and trusts the consumer to keep the Effect program aligned with the schema. The `defineNode` helper is a v1.1 hardening.

## Alternatives considered

- **Explicit `reduce` node kind.** Rejected. The data structure stays flat. Multi-parent is implicit in the lib's input resolver.
- **Effect-program-driven types (schema as runtime check).** Rejected. The serialized state has a Zod schema; in-memory value has an Effect type. These can drift. Schema-driven means the runtime boundary is the schema.
- **Field-level streaming (Candidate 1).** Rejected. Accumulator covers 90% of cases. Field-level is v1.x.
- **Final-only streaming.** Rejected. Long-running LLM calls deserve progressive text. The accumulator is a small addition.
- **Event-based subscription (`WorkflowEvent` stream).** Rejected for in-process. Wire format is event-based (v1.1), in-process is Node-granularity.
- **Two human-input APIs (write + confirm).** Rejected. One API; the runner's state machine handles the transitions.
- **Consumer-supplied node keys.** Rejected. The composition API produces keys from the path. Consumers never type keys.
- **`addNode(state, def)` lower-level API.** Rejected. The composition API is the only way. This is what makes keys type-safe.
- **Loops as a single node with iteration count metadata.** Rejected. The user wants the iterations addressable individually. The family-of-nodes shape matches the model.

## Synthesis record

The candidate-3 design from the 2026-06-06 arena was the base. The current v1 design supersedes it after a design conversation that resolved:

| Topic | v0 (candidate 3) | v1 (this document) |
|---|---|---|
| Node addressability | `ReadonlyArray<Node>` | `Record<string, Node>` keyed by `NodeKey<Path>` |
| Key shape | Branded `NodeId` (string) | Branded `NodeKey<Path>` (template-literal type) |
| Key production | Consumer could construct | Composition API only |
| Subscription | `AsyncIterable<WorkflowEvent>` | `subscribe(state, key, onUpdate(node) => void)` |
| Human-input API | `writeHumanInput` only | `writeHumanInput` only (confirmed) |
| Human-input modes | One mode (`z.humanUpdatable`) | Two modes (`z.human`, `z.human().verified()`) |
| Staleness model | `staleFields: Set<FieldKey>` on node | `stale` status only; node-level, not per-field |
| Verified gate | n/a (no gate) | Gate resets on parent re-execution |
| Loop shape | One node, iteration count in metadata | Family of nodes + `final` |
| Multi-parent | Implicit | Implicit (unchanged) |
| Streaming | Accumulator + final | Accumulator + final (unchanged) |
| Transport | Transport-agnostic event stream | In-process: Node-granularity; wire: WorkflowEvent (v1.1) |
| Verbosity | `Readonly<Record<...>>` everywhere | Reduced; no `Readonly` wrappers; `Record` instead of `ReadonlyArray` |

## Open questions for v1.1+

- **`defineNode` helper for dual type guard.** Schema and Effect program are both required but not type-checked against each other in v1. v1.1 adds the helper.
- **Long-running workflow durability.** Resume = `init(definition) + deserialize(state) + findReadyNodes`. Idempotency of consumer Effect programs is not enforced.
- **SSE / WebSocket transports.** v1.1 adapters consume the `WorkflowEvent` stream.
- **AI SDK adapter.** v1.1. Wrap `@ai-sdk/*` calls as Effect programs.
- **Reference React adapter.** v1.1. The render protocol is settled; the reference implementation is a thin React adapter over `subscribe`.
- **Renderer-supplied `stale` UX.** The `stale` status is a real node status; what the renderer shows for it is the renderer's call. The lib doesn't ship a "re-deriving..." component.

## Next implementation step

Write `src/types.ts` (the data structure), `src/keys.ts` (the `NodeKey` type), and `src/schemas.ts` (the `z.human` extension). These are the smallest pieces that prove the design compiles and that the data structure's invariants hold. The composition API, operations, runner, and subscribe come next, in that order.

The TS stub in `src/stub.ts` is a complete type-level proof that the design compiles, with `throw new Error("not implemented")` bodies. Implementation fills in body-by-body against this contract.
