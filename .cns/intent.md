# Intent

## Phase 1: v1 design hardening (interrogate-driven)

This phase is **design, not implementation**. Each task is a brief-driven design session: I post the brief from the plan file (3 options + my recommendation), you say "go with the recommendation" or "do X instead." After each task, I patch `docs/design.md` + `src/stub.ts` and commit.

After this phase, the design is rock-solid. Phase 2 (implementation) begins.

Each task has its own plan file in `.cns/plans/TASK-{letter}.md`. The plan file contains the full brief, the source finding (verbatim from the interrogate), the options, my recommendation, and the patches to design.md and stub.ts that the task will require.

### Act-on criticals (8 tasks; resolved by interrogate 2026-06-06)

Each task resolves one critical finding from the v1.1 interrogate.

1. **TASK-A: Resolve the running + writeHumanInput race** *(B1, critical)*. → [`.cns/plans/TASK-A.md`](plans/TASK-A.md). The state machine says "if running, ignore the write." Human's write is lost. Pick (a) ignore-apply-on-next-ready, (b) cancel-and-rerun, (c) queue-and-rerun-on-complete, or (d) signal-the-effect.
2. **TASK-B: Concurrent step() safety + WorkflowRuntime service** *(B2, B5, critical)*. → [`.cns/plans/TASK-B.md`](plans/TASK-B.md). `step()` is a synchronous state function; concurrent calls clobber. Plus the consumer's `Effect.gen` program has no path to `publish` / `write` / `writeHumanInput`. **Folded with TASK-T (originally B5) on 2026-06-06** — both gaps close in one refactor: `runWorkflow` (Effect-wrapped, single fiber) + `WorkflowRuntime` service. **Resolved 2026-06-06.**
3. **TASK-C: Subscribe semantics** *(A7 + D4, critical)*. → [`.cns/plans/TASK-C.md`](plans/TASK-C.md). **Resolved 2026-06-06** (pivoted). Two methods, no flags: `subscribe` (single key, exact match) and `subscribeSet` (wildcard pattern with `*` as the path-segment wildcard; bare `*` for every node). Callback for subscribeSet is `(nodes: Record<string, Node>) => void`.
4. **TASK-D: ~~subscribeAll for the wall-display case~~ — ABSORBED INTO TASK-C 2026-06-06 (RESOLVED)** *(D3, critical)*. → [`.cns/plans/TASK-D.md`](plans/TASK-D.md) (tombstone). The wall-display case is `subscribeSet(state, "*", onUpdate)`.
5. **TASK-E: Runtime implementation of z.human()** *(A2 + C5, critical)*. → [`.cns/plans/TASK-E.md`](plans/TASK-E.md). **Resolved 2026-06-06.** Option (a): clone-and-mutate `_def.humanMode`; `getHumanMode()` helper reads the marker. Zod 3.x target. Seed-vs-no-seed vocabulary named in the doc.
6. **TASK-F: Edge indexing** *(A3, critical)*. → [`.cns/plans/TASK-F.md`](plans/TASK-F.md). **Resolved 2026-06-06.** Add `edgesByTarget` and `edgesByFrom` as derived fields on `WorkflowState`. Both are recomputed on `deserialize()`. Serialization contract named.
7. **TASK-G: Node status is a discriminated union (folded with TASK-J, TASK-K, TASK-S)** *(C8, critical)*. → [`.cns/plans/TASK-G.md`](plans/TASK-G.md). **Resolved 2026-06-06.** `Node["status"]` is a discriminated union; per-status data (output, error, timestamps) lives on the variants. Folds TASK-G (per-node error), TASK-J (output vs finalOutput), TASK-K (drop humanFields cache), TASK-S (getHumanInputDisplay with source-kind union).
8. **TASK-H: Direct-match composition with bridge functions** *(C3 + C4, critical)*. → [`.cns/plans/TASK-H.md`](plans/TASK-H.md). **Resolved 2026-06-06** (pivoted). `ResolvedInput = { value, schema, humanFields }` (single value, not bundle). `Edge = { from, to, bridge? }` (no toField). Composition API has two `.then()` overloads: `parent.then(child)` direct match, `parent.then((out) => in_, child)` with bridge function. Bridge is composition metadata on the Edge, not a node. Two-stage validation preserved (per-source `value` vs `schema`, then aggregate).

### Consider-list items (14 tasks; resolved by interrogate 2026-06-06)

Real but lower-priority refinements. Each is a design session + small patch. The brief in the plan file will say whether it's doc-only or a real API change.

9. **TASK-I: Path generic on `NodeKey<Path>`** *(A1, warning)*. → [`.cns/plans/TASK-I.md`](plans/TASK-I.md). **Resolved 2026-06-06** (against the plan's recommendation). The Path generic is non-negotiable — combinator signatures carry the path through to the consumer's `subscribe(state, ref.key, ...)` call. `run`/`then`/`all`/`thenLoop` all return `NodeRef<`${P}.${K}`>`-style paths. Brand on `NodeKey` rejects raw strings; path generic rejects "wrong node ref."
10. **TASK-J: ~~`output` vs `finalOutput` duality~~ — FOLDED INTO TASK-G 2026-06-06 (RESOLVED)** *(C1, warning)*. → [`.cns/plans/TASK-J.md`](plans/TASK-J.md) (tombstone). `output` and `finalOutput` are no longer top-level; they live on the `streaming` and `resolved` status variants.
11. **TASK-K: ~~Drop `humanFields` cache~~ — FOLDED INTO TASK-G 2026-06-06 (RESOLVED)** *(C2, warning)*. → [`.cns/plans/TASK-K.md`](plans/TASK-K.md) (tombstone). The cache is gone; `getHumanFields(node)` reads the schema on demand.
12. **TASK-L: `Actor` type — pick one** *(A6 + C7, warning)*. → [`.cns/plans/TASK-L.md`](plans/TASK-L.md). **Resolved 2026-06-06.** Dropped the brand. `type Actor = string`. Documented the convention (system, human, or any consumer-defined role).
13. **TASK-M: Stale re-execution coalescing** *(B4, warning)*. → [`.cns/plans/TASK-M.md`](plans/TASK-M.md). **Resolved 2026-06-06** (doc-only). "Multiple writes coalesce; most recent value wins." Documented the rule.
14. **TASK-N: Effect buy-in as a documented limitation** *(B6, warning)*. → [`.cns/plans/TASK-N.md`](plans/TASK-N.md). Add a "Limitations" section to design.md.
15. **TASK-O: `findReadyNodes` consistency** *(B7, warning)*. → [`.cns/plans/TASK-O.md`](plans/TASK-O.md). `findReadyNodes` returns `pending` OR `stale`. `paused` is NOT ready.
16. **TASK-P: ~~Batched subscription~~ — CANCELLED 2026-06-06** *(D2, warning)*. → [`.cns/plans/TASK-P.md`](plans/TASK-P.md). Cut from v1. Reference React adapter batches `setState` natively; wall-display debounces in-renderer. No `batched` option ships. A one-line note in the subscription section of `docs/design.md` documents the v1 batching story.
17. **TASK-Q: Stale UX reference behavior** *(D7, warning)*. → [`.cns/plans/TASK-Q.md`](plans/TASK-Q.md). Document one reference: "show previous output with 're-deriving' indicator."
18. **TASK-R: `topologicalOrder` derived field** *(D6, warning)*. → [`.cns/plans/TASK-R.md`](plans/TASK-R.md). Add `topologicalOrder: ReadonlyArray<NodeKey>` to workflow state, computed at init.
19. **TASK-S: `getHumanInputDisplay` helper** *(D8, warning)*. → [`.cns/plans/TASK-S.md`](plans/TASK-S.md). **Resolved 2026-06-06** (folded with TASK-G). Discriminated union on source kind.
20. **TASK-T: ~~`WorkflowRuntime` Effect service~~ — MERGED INTO TASK-B 2026-06-06 (RESOLVED)** *(B5, warning)*. → [`.cns/plans/TASK-T.md`](plans/TASK-T.md) (tombstone). Combined with TASK-B (B2). The combined plan ships as one refactor.
21. **TASK-U: `thenLoop` family handle typing** *(A8, warning)*. → [`.cns/plans/TASK-U.md`](plans/TASK-U.md). Document that the family handle is `NodeRef<string>`.
22. **TASK-V: ~~Delta-based subscription callback~~ — CANCELLED 2026-06-06** *(A5, warning)*. → [`.cns/plans/TASK-V.md`](plans/TASK-V.md). Cut from v1. Renderers shallow-compare inside their callback. No `delta` option ships. Same one-line note in the subscription section covers both cancelled features.

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
