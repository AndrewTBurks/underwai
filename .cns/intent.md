# Intent

## Phase 1: v1 design hardening (interrogate-driven)

This phase is **design, not implementation**. Each task is a brief-driven design session: I post 3 options + my recommendation + a one-question `clarify`. You say "go with the recommendation" or "do X instead." After each task, I patch `docs/design.md` + `src/stub.ts` and commit.

After this phase, the design is rock-solid. Phase 2 (implementation) begins.

### Act-on criticals (8 tasks; resolved by interrogate 2026-06-06)

Each task resolves one critical finding from the v1.1 interrogate.

1. **TASK-A: Resolve the running + writeHumanInput race** *(B1, critical)*. The state machine says "if running, ignore the write." Human's write is lost. Pick (a) ignore-apply-on-next-ready, (b) cancel-and-rerun, (c) queue-and-rerun-on-complete, or (d) signal-the-effect. Patch state machine in design.md.
2. **TASK-B: Concurrent step() safety** *(B2, critical)*. `step()` is a synchronous state function; concurrent calls clobber. Pick (a) doc-only single-fiber, (b) Runtime object, (c) Effect-wrapped step, or (d) mutex. Patch runtime section in design.md.
3. **TASK-C: Subscribe prefix semantics + default inversion** *(A7 + D4, critical)*. "Prefix match" is undefined; default is surprising. Define path-segment rule (`nodeKey.startsWith(subKey + ".")`) and invert default to exact-match, opt-in prefix. Patch subscription section in design.md.
4. **TASK-D: subscribeAll for the wall-display case** *(D3, critical)*. ThreadWeaver's wall display renders every node simultaneously. Add `subscribeAll(state, onUpdate, opts?)` for the wall-display. (a) for v1, (b) with filters deferred. Patch subscription section.
5. **TASK-E: Runtime implementation of z.human()** *(A2 + C5, critical)*. Type declarations are there; runtime function that adds the marker to the schema's `_def` is not. Pick (a) mutate _def, (b) wrap schema, or (c) Zod .meta() (Zod 4+ only). Patch schemas section.
6. **TASK-F: Edge indexing** *(A3, critical)*. `edges: ReadonlyArray<Edge>` is O(E) per node. Add `edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>` derived at init. Patch data structure.
7. **TASK-G: Per-node error field** *(C8, critical)*. Node has no error field. Add `error?: SerializedError` to Node; keep `WorkflowState.error` for top-level (non-node) errors. Patch data structure.
8. **TASK-H: InputSource carries the schema (two-stage validation)** *(C3 + C4, critical)*. `from_node` source has no schema. Add per-source schema (only for from_node in v1); runner validates per-source first, then aggregate. Patch data structure and operations.

### Consider-list items (14 tasks; resolved by interrogate 2026-06-06)

Real but lower-priority refinements. Each is a design session + small patch. The brief will say whether it's doc-only or a real API change.

9. **TASK-I: Path generic on `NodeKey<Path>`** *(A1, warning)*. Ship `NodeRef<string>` for v1; add templated path types in v1.1 once combinator signatures can carry them. (Doc-only.)
10. **TASK-J: `output` vs `finalOutput` duality** *(C1, warning)*. Keep the two-field shape; document the rule (non-streaming nodes leave `output` undefined; only `finalOutput` is set). (Doc-only.)
11. **TASK-K: Drop `humanFields` cache** *(C2, warning)*. The cache is redundant with the input schema. Drop it; lib re-walks schema when needed. (Data model removal + operations change.)
12. **TASK-L: `Actor` type — pick one** *(A6 + C7, warning)*. Drop the brand; `type Actor = string`. Document the convention. (Type change + doc.)
13. **TASK-M: Stale re-execution coalescing** *(B4, warning)*. Define: "multiple writes to the same node before re-execution completes coalesce; most recent value wins." Document the rule. (Spec change.)
14. **TASK-N: Effect buy-in as a documented limitation** *(B6, warning)*. Add a "Limitations" section to design.md: Effect is required; no plain-async or plain-promise adapter. (Doc-only.)
15. **TASK-O: `findReadyNodes` consistency** *(B7, warning)*. `findReadyNodes` returns `pending` OR `stale`. `paused` is NOT ready. Update both design.md and architecture/index.md. (Spec clarification.)
16. **TASK-P: Batched subscription** *(D2, warning)*. Add `{ batched: true }` option to subscribe. Default unbatched for low-latency. (API addition.)
17. **TASK-Q: Stale UX reference behavior** *(D7, warning)*. Document one reference: "show previous output with 're-deriving' indicator; replace when new value arrives." (Doc-only.)
18. **TASK-R: `topologicalOrder` derived field** *(D6, warning)*. Add `topologicalOrder: ReadonlyArray<NodeKey>` to workflow state, computed at init. (Data model addition.)
19. **TASK-S: `getHumanInputDisplay` helper** *(D8, warning)*. Add a helper that returns `{ value, status, proposed: boolean }` for the renderer's "starting value" affordance. (Helper addition.)
20. **TASK-T: `WorkflowRuntime` Effect service** *(B5, warning)*. The lib provides a `WorkflowRuntime` service via Effect's `Context`. Consumer's program yields it to access `publish`, `write`, `writeHumanInput`. (API commitment.)
21. **TASK-U: `thenLoop` family handle typing** *(A8, warning)*. Document that the family handle is `NodeRef<string>` (not a typed family). Consumers address individual iterations by string. (Doc-only.)
22. **TASK-V: Delta-based subscription callback** *(A5, warning)*. Add `(prev: Node | null, next: Node) => void` option. Default is `(node: Node) => void`. (API addition.)

## Phase 2: prototype

Begins after Phase 1 completes. Implementation order:

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
