# Intent

## Phase 1: v1 design hardening (interrogate-driven)

This phase is **design, not implementation**. Each task is a brief-driven design session: I post the brief from the plan file (3 options + my recommendation), you say "go with the recommendation" or "do X instead." After each task, I patch `docs/design.md` + `src/stub.ts` and commit.

After this phase, the design is rock-solid. Phase 2 (implementation) begins.

Each task has its own plan file in `.cns/plans/TASK-{letter}.md`. The plan file contains the full brief, the source finding (verbatim from the interrogate), the options, my recommendation, and the patches to design.md and stub.ts that the task will require.

### Act-on criticals (8 tasks; resolved by interrogate 2026-06-06)

Each task resolves one critical finding from the v1.1 interrogate.

1. **TASK-A: Resolve the running + writeHumanInput race** *(B1, critical)*. → [`.cns/plans/TASK-A.md`](plans/TASK-A.md). The state machine says "if running, ignore the write." Human's write is lost. Pick (a) ignore-apply-on-next-ready, (b) cancel-and-rerun, (c) queue-and-rerun-on-complete, or (d) signal-the-effect.
2. **TASK-B: Concurrent step() safety** *(B2, critical)*. → [`.cns/plans/TASK-B.md`](plans/TASK-B.md). `step()` is a synchronous state function; concurrent calls clobber. Pick (a) doc-only single-fiber, (b) Runtime object, (c) Effect-wrapped step, or (d) mutex.
3. **TASK-C: Subscribe prefix semantics + default inversion** *(A7 + D4, critical)*. → [`.cns/plans/TASK-C.md`](plans/TASK-C.md). "Prefix match" is undefined; default is surprising. Define path-segment rule; invert default to exact-match, opt-in prefix.
4. **TASK-D: subscribeAll for the wall-display case** *(D3, critical)*. → [`.cns/plans/TASK-D.md`](plans/TASK-D.md). Add `subscribeAll(state, onUpdate, opts?)` for the wall-display. (a) for v1, (b) with filters deferred.
5. **TASK-E: Runtime implementation of z.human()** *(A2 + C5, critical)*. → [`.cns/plans/TASK-E.md`](plans/TASK-E.md). Pick (a) mutate _def, (b) wrap schema, or (c) Zod .meta() (Zod 4+ only).
6. **TASK-F: Edge indexing** *(A3, critical)*. → [`.cns/plans/TASK-F.md`](plans/TASK-F.md). Add `edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>` derived at init.
7. **TASK-G: Per-node error field** *(C8, critical)*. → [`.cns/plans/TASK-G.md`](plans/TASK-G.md). Add `error?: SerializedError` to Node; keep `WorkflowState.error` for top-level (non-node) errors.
8. **TASK-H: InputSource carries the schema (two-stage validation)** *(C3 + C4, critical)*. → [`.cns/plans/TASK-H.md`](plans/TASK-H.md). Add per-source schema (only for from_node in v1); runner validates per-source first, then aggregate.

### Consider-list items (14 tasks; resolved by interrogate 2026-06-06)

Real but lower-priority refinements. Each is a design session + small patch. The brief in the plan file will say whether it's doc-only or a real API change.

9. **TASK-I: Path generic on `NodeKey<Path>`** *(A1, warning)*. → [`.cns/plans/TASK-I.md`](plans/TASK-I.md). Ship `NodeRef<string>` for v1; templated path types in v1.1.
10. **TASK-J: `output` vs `finalOutput` duality** *(C1, warning)*. → [`.cns/plans/TASK-J.md`](plans/TASK-J.md). Keep the two-field shape; document the rule.
11. **TASK-K: Drop `humanFields` cache** *(C2, warning)*. → [`.cns/plans/TASK-K.md`](plans/TASK-K.md). Drop the cache; lib re-walks schema when needed.
12. **TASK-L: `Actor` type — pick one** *(A6 + C7, warning)*. → [`.cns/plans/TASK-L.md`](plans/TASK-L.md). Drop the brand; `type Actor = string`. Document the convention.
13. **TASK-M: Stale re-execution coalescing** *(B4, warning)*. → [`.cns/plans/TASK-M.md`](plans/TASK-M.md). "Multiple writes coalesce; most recent value wins." Document the rule.
14. **TASK-N: Effect buy-in as a documented limitation** *(B6, warning)*. → [`.cns/plans/TASK-N.md`](plans/TASK-N.md). Add a "Limitations" section to design.md.
15. **TASK-O: `findReadyNodes` consistency** *(B7, warning)*. → [`.cns/plans/TASK-O.md`](plans/TASK-O.md). `findReadyNodes` returns `pending` OR `stale`. `paused` is NOT ready.
16. **TASK-P: Batched subscription** *(D2, warning)*. → [`.cns/plans/TASK-P.md`](plans/TASK-P.md). Add `{ batched: true }` option. Default unbatched.
17. **TASK-Q: Stale UX reference behavior** *(D7, warning)*. → [`.cns/plans/TASK-Q.md`](plans/TASK-Q.md). Document one reference: "show previous output with 're-deriving' indicator."
18. **TASK-R: `topologicalOrder` derived field** *(D6, warning)*. → [`.cns/plans/TASK-R.md`](plans/TASK-R.md). Add `topologicalOrder: ReadonlyArray<NodeKey>` to workflow state, computed at init.
19. **TASK-S: `getHumanInputDisplay` helper** *(D8, warning)*. → [`.cns/plans/TASK-S.md`](plans/TASK-S.md). Add a helper that returns `{ value, status, proposed: boolean }`.
20. **TASK-T: `WorkflowRuntime` Effect service** *(B5, warning)*. → [`.cns/plans/TASK-T.md`](plans/TASK-T.md). The lib provides a `WorkflowRuntime` service via Effect's `Context`.
21. **TASK-U: `thenLoop` family handle typing** *(A8, warning)*. → [`.cns/plans/TASK-U.md`](plans/TASK-U.md). Document that the family handle is `NodeRef<string>`.
22. **TASK-V: Delta-based subscription callback** *(A5, warning)*. → [`.cns/plans/TASK-V.md`](plans/TASK-V.md). Add `(prev: Node | null, next: Node) => void` option.

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
