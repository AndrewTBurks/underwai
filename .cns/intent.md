# Intent

## Phase 1: v1 spec

These are the unresolved design questions that shape the v1 API. Each is a real pivot — two or more implementation approaches that materially affect the surface. Resolve them, then write the v1 spec.

### 1. Persistence: definition + state binding ✅ Done (2026-06-06)
Resolved in `architecture/index.md`: state is JSON, definition is consumer code, resume = `init(definition) + deserialize(state) + findReadyNodes`. Definition is the consumer's concern; the lib is portable across machines via the data structure alone.

### 2. Multi-parent reduce semantics
A node with parents [A, B]: implicit (lib gathers both into the input, consumer's program receives them as separate fields) vs explicit (a `reduce` node kind). My recommendation: implicit. But "either parent is enough" (race) is a separate semantic — does it need an `effect: all | any` flag on the node, or is it always-all?

### 3. Transport layer
Wire protocol between runner and renderers. Options: in-process pub/sub, SSE, WebSocket, custom change-stream. Affects SSR (RSC + streaming), wall displays (long-lived WS), and chat-embedded (in-process).

### 4. Schema ergonomics for human-updatable fields
`z.humanUpdatable(z.string())` wrapper, `.describe('human-updatable')`, separate `humanFields: string[]` array, or a runtime flag. Choice affects form generation, renderer introspection, and serialization of the marker.

### 5. Effect buy-in level
Is defining a workflow an Effect program, or a plain TS object the lib translates internally? Affects the lib's surface: thin runtime vs compiler.

### 6. Streaming shape
(a) Final value only, no streaming. (b) Accumulator + final with a `publish(value)` effect. (c) Field-level resolution. Recommendation: (b). (c) is interesting for form-fill UIs but adds complexity; defer to v1.x.

### 7. Long-running workflow durability
How does a workflow survive a deploy, restart, or year of inactivity? The state is JSON; the runtime is not. Resume is `init(definition) + deserialize(state) + findReadyNodes`. But: are Effect programs required to be idempotent? Are there non-deterministic side effects? "use workflow" has opinions; we should too.

### 8. Type system mechanics
"the type system IS the composition" — concretely, how? Zod schema on each node + lib infers types, explicit `Workflow<{Input, Output}>` generic, or consumer writes Effect with `Effect<Output, Error, Requirements>` and lib uses inferred type. Answer changes whether a consumer needs Effect deep knowledge.

## Phase 2: prototype

Once the v1 spec is settled:

- Implement the data structure (`WorkflowState`, `Node`, `Edge`).
- Implement the runner (`init`, `resume`, `write`, `findReadyNodes`, `findSubtree`).
- Implement the Zod schema wrappers.
- Implement a reference no-op renderer.
- Implement a reference React renderer.
- Write the test suite.

## Phase 3: integration

- AI SDK adapter (wrapping `@ai-sdk/*` as an Effect program).
- ThreadWeaver integration (slot the lib underneath).
- Documentation site.
- npm publish.
