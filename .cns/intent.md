# Intent

## Phase 1: v1 spec

These are the unresolved design questions that shape the v1 API. Most are now resolved by the v1 design (2026-06-06). Remaining open pivots are listed under "Deferred to v1.1+."

### Resolved (see `docs/design.md` for full rationale)

1. **Persistence: definition + state binding.** ✅ Resolved 2026-06-06.
   State is JSON, definition is consumer code, resume = `init(definition) + deserialize(state) + findReadyNodes`.

2. **Multi-parent reduce semantics.** ✅ Resolved 2026-06-06.
   IMPLICIT. The lib's input resolver IS the reduce. Multi-parent is a property of the topology, not a separate primitive. Rejected Candidate 1's explicit `ReduceNode`.

3. **Transport layer.** ✅ Resolved 2026-06-06.
   TRANSPORT-AGNOSTIC. Runner emits `AsyncIterable<WorkflowEvent>`. SSR, wall, chat, tests are all consumers. In-process bus is the reference v1 transport; SSE/WS are v1.1.

4. **Schema ergonomics for human-updatable fields.** ✅ Resolved 2026-06-06.
   Zod extension: `z.humanUpdatable()`. The schema field is marked; the lib exposes `writeHumanInput`; the renderer uses the schema to generate a form.

5. **Effect buy-in level.** ✅ Resolved 2026-06-06.
   Effect is the *only* required behavior. Consumers write `Effect<Output, Error, Requirements>` programs; the lib validates outputs against Zod schemas at runtime. The dual type guard (Candidate 4's `defineNode`) is deferred to v1.1.

6. **Streaming shape.** ✅ Resolved 2026-06-06.
   ACCUMULATOR + FINAL. `publish(value)` updates the partial; `write(value)` is the final. Streaming is opt-in (consumer chooses whether to call `publish`). Field-level streaming (Candidate 1) is rejected for v1.

### Deferred to v1.1+

7. **Long-running workflow durability.** Partial — `init` + `deserialize` + `findReadyNodes` is the resume primitive, but idempotency of consumer Effect programs is not enforced. "use workflow" has opinions; v1.1 should adopt or reject them.

8. **Type system mechanics (dual guard).** `defineNode` helper from Candidate 4 is the v1.1 hardening. v1 ships with the runtime check (Zod) and trusts the consumer to keep their Effect program aligned with the schema.

### New v1.x / v2 tasks (added after arena)

9. **SSE / WebSocket transport adapters.** v1.1. The transport-agnostic event stream is the seam; SSE and WS are thin consumers of it.

10. **AI SDK adapter.** v1.1. Wrap `@ai-sdk/*` calls as Effect programs. The lib is model-agnostic; the adapter is convenience.

11. **Reference React adapter.** v1.1. The render protocol is settled; the reference implementation is a thin React adapter over the subscription API.

## Phase 2: prototype

Once the v1 spec is settled (now):

- Implement the data structure (`WorkflowState`, `Node`, `Edge`).
- Implement the runner (`init`, `deserialize`, `findReadyNodes`, `findSubtree`, `publish`, `write`, `writeHumanInput`, `runWorkflow`).
- Implement the Zod schema extension (`z.humanUpdatable`).
- Implement the in-process event bus and the `subscribe()` API.
- Write the test suite.

## Phase 3: integration

- AI SDK adapter.
- ThreadWeaver integration (slot the lib underneath).
- Documentation site.
- npm publish (claim `underwai` and `@underwai/core`).
