# Intent

## Phase 1: v1 spec

The v1 design is settled (see `docs/design.md` and `.cns/architecture/index.md`).

### Resolved (v1.1, 2026-06-06)

All eight open pivots are resolved in the v1.1 design:

1. **Persistence: definition + state binding.** ✅ State is JSON, definition is the composition expression, resume = `init(root) + deserialize(state) + findReadyNodes`.
2. **Multi-parent reduce semantics.** ✅ IMPLICIT. The lib's input resolver is the reduce.
3. **Transport layer.** ✅ In-process: Node-granularity. Wire: WorkflowEvent (v1.1).
4. **Schema ergonomics for human-updatable fields.** ✅ `z.human()` for writeable, `.verified()` for hard-pause. One API: `writeHumanInput`.
5. **Effect buy-in level.** ✅ Effect is the only required behavior. `defineNode` deferred to v1.1.
6. **Streaming shape.** ✅ ACCUMULATOR + FINAL.
7. **Long-running workflow durability.** Partial — `init` + `deserialize` + `findReadyNodes` is the resume primitive; idempotency of consumer Effect programs is not enforced. v1.1 should adopt or reject "use workflow"'s opinions.
8. **Type system mechanics (dual guard).** `defineNode` helper is v1.1. v1 ships with the runtime check (Zod) and trusts the consumer.

### New decisions (v1.1)

9. **Key-addressability.** Nodes are `Record<string, Node>` keyed by `NodeKey<Path>`. Composition API produces keys. Consumers never type them.
10. **Composition API is the only way to create nodes.** Combinators: `run`, `.then`, `.all` (overloaded), `.thenLoop(body, predicate)`.
11. **Subscription model.** `subscribe(state, key, onUpdate(node))`. Node-granularity. Wire format is `WorkflowEvent`.
12. **Loops are a family of nodes.** `root.refine[N]` + `root.refine.final`. Body, predicate, and final are real nodes in the DAG.
13. **Human modes:** `z.human()` writeable, `.verified()` for hard-pause. Verified gate resets on parent re-execution.
14. **Staleness model.** Node-level, not per-field. Propagates downstream; siblings unaffected.

## Phase 2: prototype

Implementation order (per the design doc's "Next implementation step"):

1. **`src/keys.ts`** — the `NodeKey` type and constructor.
2. **`src/types.ts`** — the data structure (`WorkflowState`, `Node`, `Edge`, `ResolvedInput`, `InputSource`).
3. **`src/schemas.ts`** — the `z.human()` + `.verified()` extension.
4. **`src/composition.ts`** — `run`, `then`, `all`, `thenLoop`.
5. **`src/operations.ts`** — `init`, `get`, `serialize`, `deserialize`, `findReadyNodes`, `findSubtree`.
6. **`src/runner.ts`** — `step`, `publish`, `write`, `writeHumanInput`.
7. **`src/subscribe.ts`** — Node-granularity subscription.
8. **Test suite** — `composition.test.ts`, `runner.test.ts`, `human-input.test.ts`, `streaming.test.ts`, `subscribe.test.ts`, `serialization.test.ts`.

## Phase 3: integration

- **`defineNode` helper for dual type guard.** v1.1.
- **Long-running workflow durability.** v1.1. Adopt or reject "use workflow" opinions on idempotency.
- **SSE / WebSocket transports.** v1.1 adapters on top of the `WorkflowEvent` stream.
- **AI SDK adapter.** v1.1. Wrap `@ai-sdk/*` calls as Effect programs.
- **Reference React adapter.** v1.1.
- **ThreadWeaver integration.** Slot the lib underneath.
- **Documentation site.**
- **npm publish.** Claim `underwai` and `@underwai/core`.
