# Intent

## Phase 1: v1 design hardening (interrogate-driven)

This phase is **design, not implementation**. Each task is a brief-driven design session: I post the brief from the plan file (3 options + my recommendation), you say "go with the recommendation" or "do X instead." After each task, I patch `docs/design.md` + `src/stub.ts` and commit.

After this phase, the design is rock-solid. Phase 2 (implementation) begins.

Each task has its own plan file in `.cns/plans/TASK-{letter}.md`. The plan file contains the full brief, the source finding (verbatim from the interrogate), the options, my recommendation, and the patches to design.md and stub.ts that the task will require.

### Act-on criticals (8 tasks; resolved by interrogate 2026-06-06)

Each task resolves one critical finding from the v1.1 interrogate.

1. **TASK-A: Resolve the running + writeHumanInput race** _(B1, critical)_. → [`.cns/plans/TASK-A.md`](plans/TASK-A.md). The state machine says "if running, ignore the write." Human's write is lost. Pick (a) ignore-apply-on-next-ready, (b) cancel-and-rerun, (c) queue-and-rerun-on-complete, or (d) signal-the-effect.
2. **TASK-B: Concurrent step() safety + WorkflowRuntime service** _(B2, B5, critical)_. → [`.cns/plans/TASK-B.md`](plans/TASK-B.md). `step()` is a synchronous state function; concurrent calls clobber. Plus the consumer's `Effect.gen` program has no path to `publish` / `write` / `writeHumanInput`. **Folded with TASK-T (originally B5) on 2026-06-06** — both gaps close in one refactor: `runWorkflow` (Effect-wrapped, single fiber) + `WorkflowRuntime` service. **Resolved 2026-06-06.**
3. **TASK-C: Subscribe semantics** _(A7 + D4, critical)_. → [`.cns/plans/TASK-C.md`](plans/TASK-C.md). **Resolved 2026-06-06** (pivoted). Two methods, no flags: `subscribe` (single key, exact match) and `subscribeSet` (wildcard pattern with `*` as the path-segment wildcard; bare `*` for every node). Callback for subscribeSet is `(nodes: Record<string, Node>) => void`.
4. **TASK-D: ~~subscribeAll for the wall-display case~~ — ABSORBED INTO TASK-C 2026-06-06 (RESOLVED)** _(D3, critical)_. → [`.cns/plans/TASK-D.md`](plans/TASK-D.md) (tombstone). The wall-display case is `subscribeSet(state, "*", onUpdate)`.
5. **TASK-E: Runtime implementation of z.human()** _(A2 + C5, critical)_. → [`.cns/plans/TASK-E.md`](plans/TASK-E.md). **Resolved 2026-06-06.** Option (a): clone-and-mutate `_def.humanMode`; `getHumanMode()` helper reads the marker. Zod 3.x target. Seed-vs-no-seed vocabulary named in the doc.
6. **TASK-F: Edge indexing** _(A3, critical)_. → [`.cns/plans/TASK-F.md`](plans/TASK-F.md). **Resolved 2026-06-06.** Add `edgesByTarget` and `edgesByFrom` as derived fields on `WorkflowState`. Both are recomputed on `deserialize()`. Serialization contract named.
7. **TASK-G: Node status is a discriminated union (folded with TASK-J, TASK-K, TASK-S)** _(C8, critical)_. → [`.cns/plans/TASK-G.md`](plans/TASK-G.md). **Resolved 2026-06-06.** `Node["status"]` is a discriminated union; per-status data (output, error, timestamps) lives on the variants. Folds TASK-G (per-node error), TASK-J (output vs finalOutput), TASK-K (drop humanFields cache), TASK-S (getHumanInputDisplay with source-kind union).
8. **TASK-H: Direct-match composition with bridge functions** _(C3 + C4, critical)_. → [`.cns/plans/TASK-H.md`](plans/TASK-H.md). **Resolved 2026-06-06** (pivoted). `ResolvedInput = { value, schema, humanFields }` (single value, not bundle). `Edge = { from, to, bridge? }` (no toField). Composition API has two `.then()` overloads: `parent.then(child)` direct match, `parent.then((out) => in_, child)` with bridge function. Bridge is composition metadata on the Edge, not a node. Two-stage validation preserved (per-source `value` vs `schema`, then aggregate).

### Consider-list items (14 tasks; resolved by interrogate 2026-06-06)

Real but lower-priority refinements. Each is a design session + small patch. The brief in the plan file will say whether it's doc-only or a real API change.

9. **TASK-I: Path generic on `NodeKey<Path>`** _(A1, warning)_. → [`.cns/plans/TASK-I.md`](plans/TASK-I.md). **Resolved 2026-06-06** (against the plan's recommendation). The Path generic is non-negotiable — combinator signatures carry the path through to the consumer's `subscribe(state, ref.key, ...)` call. `run`/`then`/`all`/`thenLoop` all return `NodeRef<`${P}.${K}`>`-style paths. Brand on `NodeKey` rejects raw strings; path generic rejects "wrong node ref."
10. **TASK-J: ~~`output` vs `finalOutput` duality~~ — FOLDED INTO TASK-G 2026-06-06 (RESOLVED)** _(C1, warning)_. → [`.cns/plans/TASK-J.md`](plans/TASK-J.md) (tombstone). `output` and `finalOutput` are no longer top-level; they live on the `streaming` and `resolved` status variants.
11. **TASK-K: ~~Drop `humanFields` cache~~ — FOLDED INTO TASK-G 2026-06-06 (RESOLVED)** _(C2, warning)_. → [`.cns/plans/TASK-K.md`](plans/TASK-K.md) (tombstone). The cache is gone; `getHumanFields(node)` reads the schema on demand.
12. **TASK-L: `Actor` type — pick one** _(A6 + C7, warning)_. → [`.cns/plans/TASK-L.md`](plans/TASK-L.md). **Resolved 2026-06-06.** Dropped the brand. `type Actor = string`. Documented the convention (system, human, or any consumer-defined role).
13. **TASK-M: Stale re-execution coalescing** _(B4, warning)_. → [`.cns/plans/TASK-M.md`](plans/TASK-M.md). **Resolved 2026-06-06** (doc-only). "Multiple writes coalesce; most recent value wins." Documented the rule.
14. **TASK-N: Effect buy-in as a documented limitation** _(B6, warning)_. → [`.cns/plans/TASK-N.md`](plans/TASK-N.md). **Resolved 2026-06-06** (doc-only). "Limitations" section added to `docs/design.md` listing deliberate constraints (Effect required, Zod required, composition API is the only way to create nodes, state machine must be learned, runner is an Effect service).
15. **TASK-O: `findReadyNodes` consistency** _(B7, warning)_. → [`.cns/plans/TASK-O.md`](plans/TASK-O.md). **Resolved 2026-06-06** (doc-only). Both docs already agree: `findReadyNodes` returns `pending` OR `stale`; `paused` is NOT ready. `docs/design.md` runtime section now explicitly notes the `paused` exclusion.
16. **TASK-P: ~~Batched subscription~~ — CANCELLED 2026-06-06** _(D2, warning)_. → [`.cns/plans/TASK-P.md`](plans/TASK-P.md). Cut from v1. Reference React adapter batches `setState` natively; wall-display debounces in-renderer. No `batched` option ships. A one-line note in the subscription section of `docs/design.md` documents the v1 batching story.
17. **TASK-Q: Stale UX reference behavior** _(D7, warning)_. → [`.cns/plans/TASK-Q.md`](plans/TASK-Q.md). **Resolved 2026-06-06** (doc-only). Documented one reference behavior: "show previous output with 're-deriving' indicator." Not a lib mandate; the lib's contract is the state machine, not the UI.
18. **TASK-R: `topologicalOrder` derived field** _(D6, warning)_. → [`.cns/plans/TASK-R.md`](plans/TASK-R.md). **Resolved 2026-06-06** (no field; in-function computation). `findReadyNodes(state): ReadonlyArray<NodeKey>` returns the ready set _in dependency order_ directly. Kahn's algorithm using `edgesByFrom`. No `topologicalOrder` field on `WorkflowState`. Iteration order of the result is the contract.
19. **TASK-S: `getHumanInputDisplay` helper** _(D8, warning)_. → [`.cns/plans/TASK-S.md`](plans/TASK-S.md). **Resolved 2026-06-06** (folded with TASK-G). Discriminated union on source kind.
20. **TASK-T: ~~`WorkflowRuntime` Effect service~~ — MERGED INTO TASK-B 2026-06-06 (RESOLVED)** _(B5, warning)_. → [`.cns/plans/TASK-T.md`](plans/TASK-T.md) (tombstone). Combined with TASK-B (B2). The combined plan ships as one refactor.
21. **TASK-U: `thenLoop` family handle typing** _(A8, warning)_. → [`.cns/plans/TASK-U.md`](plans/TASK-U.md). **Resolved 2026-06-06** (doc-only). The family handle is `NodeRef<`${P}.${K}`>` — a _prefix_ pointing at the family, not a list of members. Consumers use `subscribeSet(state, handle.key + ".*", onUpdate)` to address the family. Path generic applies to the prefix; N and final are runtime.
22. **TASK-V: ~~Delta-based subscription callback~~ — CANCELLED 2026-06-06** _(A5, warning)_. → [`.cns/plans/TASK-V.md`](plans/TASK-V.md). Cut from v1. Renderers shallow-compare inside their callback. No `delta` option ships. Same one-line note in the subscription section covers both cancelled features.

## Phase 2: prototype

Begins after Phase 1 completes. **Pre-shard landed 2026-06-06**: the library is a pnpm workspace with 6 v1.0 packages. Andrew's correction (2026-06-06): transport, renderer-react, renderer-log, AND wire-format SSE/WebSocket are all part of v1.0. There is no v1.1+ tier — a v1.0 without a way to consume the lib isn't a true v1.0. See `.cns/index.md` § "Package references" for the structure. The current `src/stub.ts` was moved to `packages/core/src/stub.ts`.

Implementation order, organized by package:

**`@underwai/schema` (v1.0, implement first — small, no internal deps):**

1. **`packages/schema/src/human.ts`** — `z.human()` runtime. (TASK-E)
2. **`packages/schema/src/verified.ts`** — `.verified()` decorator. (TASK-E)
3. **`packages/schema/src/get-mode.ts`** — `getHumanMode(schema)` helper. (TASK-E)
4. **`packages/schema/src/index.ts`** — re-exports. (TASK-E)

**`@underwai/core` (v1.0, the data structure):** 5. **`packages/core/src/keys.ts`** — `NodeKey<Path>`, brand, path template. (TASK-I) 6. **`packages/core/src/types.ts`** — `WorkflowState`, `Node` (discriminated union on `Node["status"]`), `Edge`, `ResolvedInput`, `SerializedError`, `Actor`, `HumanMode`. (TASK-G, TASK-H, TASK-L, TASK-S) 7. **`packages/core/src/composition.ts`** — `run`, `then` (two overloads: direct + bridge), `all` (array + object), `thenLoop`. (TASK-C, TASK-H, TASK-I, TASK-U) 8. **`packages/core/src/operations.ts`** — `init`, `getNode`, `serialize`, `deserialize`, `findReadyNodes`, `findSubtree`, `publish`, `write`, `writeHumanInput`, `getHumanFields`, `getHumanInputDisplay`. (TASK-F, TASK-K, TASK-O, TASK-R, TASK-S) 9. **`packages/core/src/index.ts`** — re-exports.

**`@underwai/runner` (v1.0, the runtime):** 10. **`packages/runner/src/find-ready.ts`** — Kahn's algorithm using `edgesByFrom`. (TASK-O, TASK-R) 11. **`packages/runner/src/mutations.ts`** — `publish`, `write`, `writeHumanInput`. (TASK-A, TASK-H, TASK-S) 12. **`packages/runner/src/step-internal.ts`** — internal step primitive. (TASK-B) 13. **`packages/runner/src/runtime.ts`** — `WorkflowRuntime` Effect service. (TASK-B, TASK-T) 14. **`packages/runner/src/run-workflow.ts`** — main Effect program. (TASK-B) 15. **`packages/runner/src/index.ts`** — re-exports.

**`@underwai/transport` (v1.0, the subscription + wire format):** 16. **`packages/transport/src/subscribe.ts`** — `subscribe`, `subscribeSet`, the `Subscription` interface. (TASK-C, TASK-D) 17. **`packages/transport/src/event-stream.ts`** — the `WorkflowEvent` stream: `NodeAdded`, `NodeUpdated`, `NodeRemoved`, `EdgeAdded`, etc. 18. **`packages/transport/src/transports/sse.ts`** — Server-Sent Events transport. v1.0. 19. **`packages/transport/src/transports/ws.ts`** — WebSocket transport. v1.0. 20. **`packages/transport/src/index.ts`** — re-exports.

**`@underwai/renderer-react` (v1.0, the React adapter):** 21. **`packages/renderer-react/src/provider.tsx`** — `<WorkflowProvider>` context. 22. **`packages/renderer-react/src/hooks.ts`** — `useWorkflowState`, `useNode`, `useSubtree`. 23. **`packages/renderer-react/src/registry.tsx`** — the renderer registry. 24. **`packages/renderer-react/src/auto-render.tsx`** — auto-render entry point. 25. **`packages/renderer-react/src/index.ts`** — re-exports.

**`@underwai/renderer-log` (v1.0, the stdout log renderer for tests):** 26. **`packages/renderer-log/src/registry.ts`** — kind → `(node, indent) => string`. 27. **`packages/renderer-log/src/runner.ts`** — `runLogRenderer(state, opts?)`. 28. **`packages/renderer-log/src/index.ts`** — re-exports.

**Tests** (after the implementation lands): 29. **Per-package test suites** — `composition.test.ts`, `runner.test.ts`, `human-input.test.ts`, `streaming.test.ts`, `subscribe.test.ts`, `serialization.test.ts`.

## Phase 2 follow-up: audit-closing + transport + renderers

`decisions[]` in `packages/*/index.md` are settled; the design is locked. Phase 2 implementation shipped 4 of 6 packages, but the 2026-06-07 audit found that ~50% of the named surface area is implemented and ~50% is stubbed or missing. The 28-step Phase 2 plan above was the original spec; the audit revealed which steps shipped thin and which steps are still open. **This section is the new plan, derived from the audit, executed in dependency order, one package at a time.**

The audit's verdicts:

- **schema**: 100% complete. Ship.
- **core keys/types/composition/operations primitives**: 100% complete. Ship.
- **core operations (missing pieces)**: `init()` is a stub, `getHumanInputDisplay()` is a stub, `publish`/`write` core mutation primitives are missing entirely. Closed by TASK-30.
- **runner mutations**: 100% complete in isolation. Ship.
- **runner runtime**: structurally complete, integration test was rolled back due to Effect-3 + `exactOptionalPropertyTypes` typing friction (DEC-RUNNER-009). Closed by TASK-31.
- **transport**: in-process `subscribe`/`subscribeSet` matcher is complete; wire-format layer (event stream, SSE, WebSocket) and live subscription registry are missing. Closed by TASK-32.
- **renderers**: not started. Closed by TASK-33 (renderer-react) and TASK-34 (renderer-log).

Per Andrew's preference: sequential one-at-a-time, with TDD per task, CNS health gate per commit. Andrew's interview-first rule applies to _judgment calls_ within each task; the next 5 tasks are scoped enough that the agent asserts the non-pivots and asks only the load-bearing questions per task.

### 30. Close core gaps: `init()` walks composition → WorkflowState; `getHumanInputDisplay()` real impl; add `publish` / `write` core mutation primitives. (TASK-30)

The composition API returns NodeRefs but nothing actually walks a composition tree to build a WorkflowState. The "composition is the definition" promise is broken at runtime. Also: `getHumanInputDisplay()` is a stub (DEC-CORE-010 unenforced); `publish`/`write` core mutation primitives (named in `docs/design.md` and `.cns/architecture/index.md`) are missing.

Sub-bullets:

- `core/init(root: NodeRef<"root">, defs: ReadonlyMap<NodeKey, NodeDefinition>): WorkflowState` walks the composition tree, builds `nodes`, `edges` (with bridges), `edgesByTarget`, `edgesByFrom`, and marks the root `pending`. TDD: one test that builds a 3-node tree (root → a → b) and asserts the WorkflowState shape.
- `core/getHumanInputDisplay(node, fieldKey)` returns a discriminated union on source kind (literal / from_node / human) with real semantics, not a stub. TDD: at minimum one test per variant.
- `core/publish(state, key, output, partial)` and `core/write(state, key, input)` as pure functions in `operations.ts`. The runner already inlines this logic; the public API is the missing piece. Migrate the runner to use the core functions, then delete the duplicates.

Verification: `tsc -b` clean, all 61 existing tests pass, new tests added; CNS health gate green.

**Status (2026-06-07): DONE.** 12 new tests added (4 init, 5 getHumanInputDisplay, 3 publish/write). 73/73 green. DEC-CORE-015 (compose) through DEC-CORE-018 (publish/write) added. The init() shape required a `compose()` wrapper (DEC-CORE-015) so the combinators can record their defs and edges; this was not in the original plan but is the laziest path. The runner migration to use core's publish/write is a follow-up; the runner's runtime.ts still inlines markStreaming/markRunning — that's TASK-31.

### 31. Runner integration test (`runWorkflow` end-to-end). (TASK-31)

The runtime is structurally complete (Effect.gen walking the DAG, sequential program execution, state mutations via `mutations.ts`) but the integration test was rolled back on 2026-06-07 due to Effect 3 + `exactOptionalPropertyTypes` typing friction (DEC-RUNNER-009).

Sub-bullets:

- Write the integration test using the `runtimeFor` + `SubscriptionRegistryLive` pattern that was rolled back.
- Test 1: single-node workflow drives `pending → running → resolved`, then workflow `status === "completed"`.
- Test 2: a failing program marks the node `failed`, workflow `status === "failed"`.
- Test 3: a program that calls `runtime.publish(output, partial)` leaves the final state as `resolved` but intermediate state is observable via the registry's `notify` callback.
- Test 4: subscribers are notified on every state transition (count >= 2 for a single-node flow).

Verification: 4 new tests pass, all existing tests still pass, `tsc -b` clean, CNS health gate green.

**Status (2026-06-07): DONE.** 4 new tests added. 77/77 green. Used core/compose + core/init to build a real WorkflowState from a composition; the runtime now accepts state.status "pending" as a starting state (the orchestrator implicitly flips to "running" while walking). Test 3 (publish-service integration) is exercised via the SubscriptionRegistry's notify count. Test 4 verifies a 3-node workflow drives root → a → b in dependency order. DEC-RUNNER-009 closed.

### 32. Transport wire format + live subscription. (TASK-32)

The in-process `subscribe`/`subscribeSet` pattern matcher is complete, but the design is broken: the callback fires _once_ with the current value, not on every state change. There's no live registry, no fan-out from the runner, no `unsubscribe` mechanism, no wire format. The transport package's `index.ts` is `export {}` — the public surface is empty.

Sub-bullets:

- `transport/src/live.ts` — a `LiveSubscriptionRegistry` that the runner's `notify` step calls. `subscribe`/`subscribeSet` register callbacks; the runner writes to the registry on every state mutation. The public `subscribe`/`subscribeSet` API becomes live instead of one-shot.
- `transport/src/event-stream.ts` — the `WorkflowEvent` discriminated union (`NodeAdded`, `NodeUpdated`, `NodeRemoved`, `EdgeAdded`, `EdgeRemoved`, `WorkflowStatusChanged`). Wire format is JSON; events serialize to `{ kind, key?, node?, edge?, status?, timestamp }`.
- `transport/src/transports/sse.ts` — Server-Sent Events server + client. Server writes events to a Node `ReadableStream` (Web standard); client parses with `EventSource`. **Stub OK**: the structure (open / write / close) is real; the test exercises a mock stream.
- `transport/src/transports/ws.ts` — WebSocket transport. Server uses `ws` package or a Node `WebSocket`; client wraps the consumer's `WebSocket`. **Stub OK**: structure real, test uses a mock.
- `transport/src/index.ts` — re-exports the public surface.

DEC-TRANSPORT-003 (event stream), DEC-TRANSPORT-004 (SSE), DEC-TRANSPORT-005 (WebSocket) all become REFLECTED.

Verification: live subscribe test, event-stream serialize/deserialize roundtrip, SSE mock test, WS mock test. `tsc -b` clean, CNS health gate green.

**Status (2026-06-07): DONE.** 11 new tests added (3 live registry, 6 live subscribe, 2 SSE, 2 WS, 1 live-registry wired through runner, 3 event-stream). 89/89 green. `LiveSubscriptionRegistry` lives in `@underwai/core` (DEC-TRANSPORT-008) — single source of truth for fan-out; transport wraps it with pattern matching, the runner wires it into `RunOptions.liveRegistry`. `WorkflowEvent` (DEC-TRANSPORT-009) is the wire format; SSE and WebSocket transports emit/consume it. Note: there were 2 distinct Transport-3/4/5 decisions in the package's frontmatter that were unimplemented stubs; both are now reflected in code.

### 33. `@underwai/renderer-react` — React adapter. (TASK-33)

The React renderer. Hooks-based: `useWorkflowState`, `useNode`, `useSubtree`. Registry: `kind → ReactElement`. No chat/agent UI affordances — the lib is workflow-shaped, not chat-shaped (DEC-RR-004).

Sub-bullets:

- `renderer-react/src/provider.tsx` — `<WorkflowProvider state={state} onChange={cb}>` context.
- `renderer-react/src/hooks.ts` — `useWorkflowState()`, `useNode(key)`, `useSubtree(key)`. All use `useSyncExternalStore` against the live registry (DEC-RR-001).
- `renderer-react/src/registry.tsx` — `registerKind(kind, fn)`, `getKindRenderer(kind)`. The registry is a `Map<kind, (node) => ReactElement>`.
- `renderer-react/src/auto-render.tsx` — `<AutoRender state={state} />` walks the DAG and renders each node via the registry. Unknown kinds render a default `<pre>` with the node's status.
- `renderer-react/src/index.ts` — re-exports.

Verification: a test that registers a renderer, instantiates a state with 3 nodes, asserts the renderer is called for each. **Skip React Testing Library** — the lib's vitest is plain Node; the renderer exports React elements; assertions are on the _call_ to render, not on the rendered DOM. `tsc -b` clean, CNS health gate green.

**Status (2026-06-07): DONE.** 5 files: provider, hooks, registry, auto-render, index. 3 tests. 92/92 green. The renderer is a thin adapter over the LiveSubscriptionRegistry; consumers compose their own UI from useNode, useSubtree, useWorkflowState. The wiring tested is `<WorkflowProvider>` + `<AutoRender>` walking a 3-node state.

### 34. `@underwai/renderer-log` — stdout log renderer. (TASK-34)

The smallest possible renderer. Subscribes to the workflow via `subscribeSet(state, "*", onUpdate)`, prints to stdout. Every kind is renderable (default for unknown kinds).

Sub-bullets:

- `renderer-log/src/registry.ts` — `kind → (node, indent) => string`. Default: `(node, indent) => \`${indent}${node.kind} (${node.status.kind})\``.
- `renderer-log/src/runner.ts` — `runLogRenderer(state, opts?)` — subscribes via `subscribeSet(state, "*", ...)`; on each notification, walks the DAG and prints.
- `renderer-log/src/index.ts` — re-exports.

Verification: a test that constructs a 3-node state, runs the renderer against a captured-stdout, asserts the output contains all three kinds. `tsc -b` clean, CNS health gate green.

**Status (2026-06-07): DONE.** 3 source files (registry, runner, index). 3 tests. 95/95 green. The runner takes a `getState` function (consumer-owned state pattern); subscribes via `subscribeSet(registry, "*", onUpdate)`; on every notify calls `getState()` and walks the DAG. Default renderer prints `"<indent><kind> (<status>)"`.

### 35. Close the v1.0 contract breaks: bridge resolution + Fiber.interrupt. (TASK-35)

The conformance audit found two real v1.0 contract promises the code does not keep. Both are in the runner. Both are listed in the design (`docs/design.md:109` for the bridge, DEC-RUNNER-002 for the interrupt). The composition API produces `Edge.bridge` correctly; the runner never applies it. The state-mutation half of the human-input race exists; the `Fiber.interrupt` half is missing entirely.

Sub-bullets:

- **Bridge resolution in the runtime loop.** When a node enters the "ready" set, look up its incoming edges via `state.edgesByTarget[key]`. For each, look up the upstream's `status.finalOutput` (if `resolved`), apply the `Edge.bridge` if present, and use the transformed value as the program's input. If the upstream is not `resolved`, the node is not ready (this is the current rule). Test: a 2-node workflow with a bridge that doubles a number; the child receives the doubled value.
- **Mid-execution `Fiber.interrupt`.** When a consumer calls `writeHumanInput` on a running node, the runtime must (a) interrupt the in-flight Effect fiber (via `Effect.fiberId` + `Fiber.interrupt(fiberId)`) and (b) mark the node `stale` so the loop re-runs. Today only (b) works. The integration is in the runtime's loop where it `Effect.fork`s each program. Test: a slow program that calls `writeHumanInput` after 100ms; the fiber is interrupted within 50ms; the node is `stale`; the next loop iteration re-runs.
- **Per the test-driven-development skill:** RED each function explicitly. RED: write a 2-node bridge test, watch it fail (child sees untransformed value), GREEN: implement bridge resolution, watch it pass. RED: write a Fiber.interrupt test, watch it fail (the program runs to completion despite `writeHumanInput`), GREEN: implement interrupt, watch it pass.

Verification: at least 2 new tests (bridge + interrupt), all 95 existing tests still pass, `tsc -b` clean, CNS health gate green.

### 36. Reconcile `SubscriptionRegistry` duplication. (TASK-36)

DEC-TRANSPORT-008's "one registry, three adapters" promise is broken. The runner has its own `SubscriptionRegistry` (an Effect `Context.Tag` at `runner/src/runtime.ts:51-89`) that is functionally identical to core's `LiveSubscriptionRegistry` (`core/src/live.ts:12-54`). The runner uses its own for internal fan-out and only optionally notifies core's through `RunOptions.liveRegistry`. Two registries, two paths.

Sub-bullets:

- The runner's `Context.Tag` should resolve to a `LiveSubscriptionRegistry` instance, not a parallel class. In the runtime's layer construction, instantiate a `LiveSubscriptionRegistry` and pass it as the `Context.Tag`'s value. All `register`/`unregister`/`notify` calls inside the runner should hit the same object that consumers wire up.
- Delete the duplicate `SubscriptionRegistry` class body in `runner/src/runtime.ts`. Replace with `export const SubscriptionRegistry = Context.Tag<...>(...).of(liveRegistry)` or equivalent Effect pattern.
- Update the runner's `SubscriptionRegistryLive` to be a thin layer that constructs one `LiveSubscriptionRegistry` and returns it. The `Runtime` layer depends on the same instance.

Verification: existing 5 runtime tests still pass; a new test that asserts the runner's internal `SubscriptionRegistry` and core's `LiveSubscriptionRegistry` are the same object when wired through a Layer. `tsc -b` clean, CNS health gate green.

### 37. Reconcile `WorkflowRuntime` service shape with the design. (TASK-37)

**Resolved (2026-06-07 plan-mode interview).** Andrew picked:

- `publish` keeps its current semantics: a running program surfaces a partial output (the `running → streaming` transition). The renderer's registry notifies with `status.output = value`. Already implemented.
- `write` = **consumer injection**. An external actor (human, agent, or external system) writes a value into a node. The value becomes `finalOutput`. The program is bypassed. The state transition is `pending → resolved` (or `running → resolved`).
- `writeHumanInput` = **typed flavor for human-marked fields**. Refines `write`; same semantics, typed to a human-marked field. State transition: the node's input field gets the value; the node transitions to `stale` (or `resolved` if `pending`); the program is bypassed.
- The program's final output is delivered via the Effect's **return value**, not a method call. The runner's loop reads the program's `Effect.succeed(value)` and calls `markResolved` directly.
- **Delete the workflow-level `paused` status from the state machine.** The 7-status state machine becomes 6: `pending`, `running`, `completed`, `failed`, `stale`, `cancelled`. Per-node `paused` (the `markPaused` in `mutations.ts:97-118`) is unaffected; the runner uses it when a node hits a human-marked field.

Sub-bullets (post-resolution):

- Add `write` and `writeHumanInput` to the `WorkflowRuntime` service. Implementation: `write` is a thin wrapper over `markResolved` (or the new `markResolved` from TASK-38). `writeHumanInput` is a thin wrapper over `mutations.writeHumanInput`.
- Drop the `pause` no-op from the service. The service becomes `{ publish, write, writeHumanInput }`.
- Update DEC-RUNNER-004's summary to reflect the new shape.
- Update the state machine: `WorkflowStatus` removes the `"paused"` literal. Tests that exercise the `paused` workflow status get updated. The 6-status state machine gets a new DEC-CORE-019 (or whatever the next available number is) recording the deletion.
- Update the runner's runtime loop to read the program's return value via the Effect's success path; no `write` call from the program.

Verification: 1+ new test that drives the service's `write` and `writeHumanInput` (consumer-injection case), all 95 existing tests still pass after the state-machine reduction, `tsc -b` clean, CNS health gate green.

### 38. Delete core's `publish`/`write`; the runner is the only mutator. (TASK-38)

**Resolved (2026-06-07 plan-mode interview).** Andrew picked path (d): delete core's `publish`/`write`, fold the 3 tests into the runner's mutation suite, rewrite DEC-CORE-018 to reflect the layering.

The audit was technically right (the runner's `markStreaming` is signature-identical to core's `publish`) but the framing was wrong (the duplication isn't a smell, it's a layer boundary). The right resolution is to **remove the unused external API in core**, not to make the runner call into it. The runner is the only mutator. Core is a pure data-model + composition layer.

Sub-bullets (post-resolution):

- Delete `publish` and `write` from `core/src/operations.ts`. Update `core/src/index.ts` to drop the re-exports.
- Delete `packages/core/src/publish-write.test.ts` (3 tests). Move equivalent coverage into `packages/runner/src/mutations.test.ts`: a test asserting `markStreaming(state, key, value)` produces the same shape the old `publish` test asserted; a test asserting `markResolved` produces the same shape the old `write` test asserted.
- Add a new DEC-CORE-019 (or next available number): "Core exposes no mutation primitives. The runner is the only mutator. The data-model layer is a pure value type; transitions belong to the runtime."
- Rewrite DEC-CORE-018's summary: the old summary said "the runner now uses core's `publish`/`write`" — that was wrong. New summary: "Core originally added `publish`/`write` as a public mutation API in TASK-30. They had no real consumer; the audit caught that they were tested-only surface area. In TASK-38 the functions were deleted and the runtime became the only mutator. DEC-CORE-019 records the new layering."

Verification: 0 net new tests in core, 2 net new tests in the runner, all 95 existing tests still pass, `tsc -b` clean, CNS health gate green. Net change to `core/src/operations.ts`: −30 lines. Net change to `core/src/index.ts`: 2 lines removed.

### 39. Reconcile wording-drift partials in decision summaries. (TASK-39)

Six partial decisions are summary-lags-code cases. The code is right; the summaries describe a slightly different shape. Patch the summaries to match the code so future audits don't catch them as false positives.

Sub-bullets (one patch per decision):

- **DEC-SCHEMA-001** — "mutates `_def.humanMode`" → "clones the schema and attaches a new `_def` with `humanMode`." The behavior is the same; the wording matters because mutating-in-place implies shared mutation across callsites, which the code explicitly avoids.
- **DEC-CORE-010** — four-variant enumeration (literal / from_node / human+pending / human+set / human+verified+locked) → three-variant (literal / from_node / human). The verified+locked case collapses to literal. Document the collapse: "verified human-marked fields with a value are constants; the value is locked in, no human UI needed."
- **DEC-CORE-017** — same enumeration fix; same `getHumanInputDisplay` signature change to (state, node, fieldKey); the `_fieldKey` parameter is reserved for a future per-field API. Document the reservation.
- **DEC-CORE-018** — fixed by TASK-38; do not patch until TASK-38 lands.
- **DEC-RUNNER-002** — fixed by TASK-35; do not patch until TASK-35 lands.
- **DEC-RUNNER-004** — fixed by TASK-37; do not patch until TASK-37 lands.
- **DEC-TRANSPORT-005** — fixed by TASK-43; do not patch until TASK-43 lands.

Verification: a fresh conformance audit pass shows 0 wording-drift partials for the decisions patched. CNS health gate green.

### 40. Prune phantom exports, dead helpers, and the YAML formatting bug. (TASK-40)

A small list of < 50 lines of dead or phantom code that an audit caught. Per the `principle-laziness-protocol` skill: bias toward deletion.

Sub-bullets:

- `runner/src/runtime.ts:43` — drop the `pause: () => Effect.succeed(undefined)` no-op from the `WorkflowRuntime` service. (Note: TASK-37 may also touch this; coordinate by doing TASK-40 _after_ TASK-37 lands or by skipping this bullet if TASK-37 already removed it.)
- `core/src/live.ts:10` — drop the `LiveCallback` type. Not referenced by any other package. (Verified: `search_files LiveCallback` returns 0 hits in code outside `live.ts` itself.)
- `renderer-react/src/registry.tsx:49-51` — drop `defaultElement`. `AutoRender` calls `defaultRenderer` directly; `defaultElement` is dead.
- `renderer-react/src/registry.tsx:36-41` + `index.ts:9` — drop `RegistryContext` and `useRegistry`. `AutoRender` uses the global registry, not the context. No consumer uses the context.
- `transport/src/sse.ts:79` — replace the dynamic `import("../event-stream.js")` with the already-static import at the top of the file (line 15). The dynamic import is dead and slow.
- `runner/index.md:43` — fix the stray `summary:` at the top level (a YAML formatting bug that strict-mode validators reject).
- **Resolved (2026-06-07 plan-mode interview).** Andrew picked path (i): delete the runner's public `writeHumanInput` export. Drop the `_fiber` and `_stateRef` parameters from the internal signature. Consumers go through the `WorkflowRuntime` service (which exposes `writeHumanInput` after TASK-37 lands). The `mutations.ts` function stays as the internal pure transition. The runner's `index.ts` drops the re-export.

Verification: `pnpm test` still passes 95/95, `tsc -b` clean, CNS health gate green (after the YAML fix in particular).

### 41. `subscribeSet` exact-key pattern is a no-op. (TASK-41)

DEC-TRANSPORT-007 lists three pattern cases: `"*"` (every node), `"prefix.*"` (direct children), and "exact key" (a single key). The code implements two. The else-branch at `transport/src/subscribe.ts:78` returns an empty record for an exact-key pattern. The pattern is registered but the callback never produces a match.

Sub-bullets:

- In `matchPattern`, before the `return result` at line 78, add: `if (all.hasOwnProperty(pattern)) result[pattern] = all[pattern]!`. The exact-key case is a single-node match with the full key as the result key.
- Add a test: `subscribeSet(registry, "root.a", onUpdate)` registers, `registry.notify(state)` fires the callback with `{ "root.a": state.nodes["root.a"] }`.
- Per the test-driven-development skill: RED, watch fail, GREEN, watch pass.

Verification: 1 new test, all 95 existing tests still pass, `tsc -b` clean, CNS health gate green.

### 42. Architecture doc is stale on `ResolvedInput` shape. (TASK-42)

`.cns/architecture/index.md:117-130` says `ResolvedInput = { fields: Record<FieldKey, InputSource> }` with `InputSource = { kind: "literal" | "from_node" | "human", ... }`. This contradicts DEC-CORE-002 and `docs/design.md:113-128`, both of which settled on `ResolvedInput = { value, schema, humanFields }` (single value, the bridge transform already applied). The code follows the design; the architecture doc is the contradiction. The architecture doc is supposed to be the source of truth for the data model.

Sub-bullets:

- Patch `.cns/architecture/index.md:117-130` to match DEC-CORE-002 and the design: `ResolvedInput = { value: unknown; schema: ZodTypeAny; humanFields: ReadonlyMap<FieldKey, HumanMode> }`. Document `InputSource` as a separate type that the runner's input resolver uses to _build_ a `ResolvedInput` (i.e., a transitional type, not a stored shape).
- Add a one-line cross-reference: "(For the data-flow contract — after the bridge has been applied — see DEC-CORE-002. The `InputSource` is the resolver's working type, not the stored shape.)"

Verification: `validate.py` PASSED, a search for "InputSource" in code returns 0 hits (the type was purely a doc invention; confirming it stays in the doc and out of the code is the test).

### 43. WebSocket client send API: typed `write`/`writeHumanInput`. (TASK-43)

DEC-TRANSPORT-005 says the WebSocket client sends `write`/`writeHumanInput` operations. The code's `WsClient.parse(ws)` (ws.ts:74-79) is receive-only. The `WsLike.send(frame: string)` (line 69) is a low-level passthrough. The bidirectional shape is half-shipped.

Sub-bullets:

- Add typed methods on `WsClient`: `client.write(key, value): void` and `client.writeHumanInput(key, value): void`. Both format the operation as a `WorkflowEvent` (or a separate `ClientOperation` discriminated union) and call `ws.send(json)`.
- Add a discriminated union `ClientOperation = { kind: "write", key, value } | { kind: "writeHumanInput", key, value }`. The transport's `WsServer.open` can optionally accept an `onClientOperation` callback to round-trip the operations back to the runtime.
- Per the test-driven-development skill: RED, watch fail, GREEN, watch pass.

Verification: 2 new tests (write + writeHumanInput), all 95 existing tests still pass, `tsc -b` clean, CNS health gate green.

### 44. Mock up example workflows. (TASK-44) — runs FIRST.

**Why this comes first (2026-06-07 plan-mode interview).** Andrew's read: the conformance audit asked "does the code match the design?" but never asked "does the design match how a real consumer would actually use the library?" The TASK-35-43 set is "fix the code to match the design." If the design is wrong, fixing the code bakes in the wrong shape. Examples are how we validate the design before locking it in.

A single `examples/` workspace package, deployable as a Vite app, with three sub-routes:

- `examples/src/linear-pipeline.tsx` — `parse → (bridge: trim+uppercase) → display`. Exercises the bridge transform (TASK-35's load-bearing concern).
- `examples/src/human-in-the-loop.tsx` — `ask_human → process → display`. The `ask_human` node has a human-marked field; the consumer injects a value via the service's `writeHumanInput` (the resolved shape from TASK-37). Exercises the consumer-injection semantics.
- `examples/src/wall-display.tsx` — A workflow that runs slowly; the renderer subscribes via `transport.subscribeSet(registry, "*", onUpdate)` and updates the wall display on every state change. Exercises the live-subscription contract (TASK-32).

Sub-bullets:

- `packages/examples/package.json` — name `@underwai/examples`, deps on all 6 workspace packages + React + Vite. Add to `pnpm-workspace.yaml`.
- `packages/examples/vite.config.ts` — Vite config with three routes; `pnpm dev` starts the wall display, `pnpm build` produces a deployable bundle.
- `packages/examples/index.html` — root HTML; React Router for the three sub-routes.
- Each example is a real composition + a real consumer of the renderer(s). The wall-display uses `renderer-react`; the human-in-the-loop uses both renderers (React for the human UI, log for the trace); the linear pipeline is CLI-only (renderer-log) for a smoke test.
- Per the test-driven-development skill: the examples are not unit tests, but they must **build and run**. `pnpm --filter @underwai/examples build` should produce a working bundle. The integration test in `runtime.test.ts` should be expanded to run the linear-pipeline example end-to-end.

Verification: `pnpm -r build` produces a deployable examples bundle; `pnpm --filter @underwai/examples dev` starts the wall display; the integration test in `runtime.test.ts` runs the linear-pipeline example and asserts the result. `tsc -b` clean, CNS health gate green.

### 45. Audit the design against the examples. (TASK-45) — runs AFTER TASK-44, BEFORE TASK-35.

**Why this exists (2026-06-07 plan-mode interview).** The conformance audit compared decisions to code, not decisions to consumer code. The examples are the consumer code. This task walks each example against the design and the resolved shapes from TASK-37/38, and reports: does the design hold, or does it need adjustment?

Sub-bullets:

- For each example, write a one-page "design check" document (in `examples/.design-checks/` or in the example file as a header comment — agent's choice at execution time) answering: does the resolved API surface (`compose`, `init`, `runWorkflow`, `WorkflowRuntime.{publish, write, writeHumanInput}`, `LiveSubscriptionRegistry`, `subscribe`/`subscribeSet`, `renderer-react`/`renderer-log`) actually let a consumer write this example without workarounds?
- Concrete checks:
  - The linear-pipeline example uses the bridge transform. Does the bridge resolution path through `init → runWorkflow` actually apply the transform? (TASK-35 will fix this; does the example reveal any other shape issue?)
  - The human-in-the-loop example calls `service.writeHumanInput` mid-execution. Does the resolved service shape (TASK-37) actually expose this without forcing the consumer to reach into the runner's internals?
  - The wall-display example subscribes via `transport.subscribeSet(registry, "*", onUpdate)`. Does the live-subscription contract (TASK-32 + TASK-36) actually let the renderer receive state updates in real time? Does the React renderer's `useSyncExternalStore` integration work?
- If the design holds, this task's output is a 3-paragraph "design validated" note appended to `.cns/log.md`. TASK-35-43 proceed as written.
- If the design needs adjustment, this task's output is a list of design changes (e.g., "the bridge should apply at edge resolution, not at program input," or "`writeHumanInput` should be a method on the `WorkflowState` not the service"). Each design change becomes a new sub-bullet in TASK-35 (or whichever task is responsible) before that task's code lands. No code lands before this audit is done.

Verification: a written check per example, a single decision ("design holds" or "design needs adjustment + which tasks"), and the resulting updates to TASK-35-43 (if any) are encoded in intent. CNS health gate green.

### Suggested execution order

1. **TASK-44** (mock up example workflows) — runs first. The design check before the code change.
2. **TASK-45** (audit the design against the examples) — runs after TASK-44, before TASK-35. Validates the design; updates TASK-35-43 if needed.
3. **TASK-35** (bridge + Fiber.interrupt) — the two v1.0 contract breaks. Closes the design's load-bearing promises. May absorb design changes from TASK-45.
4. **TASK-36** (SubscriptionRegistry merge) — closes the architectural smell. The runner's internal fan-out uses core's registry; DEC-TRANSPORT-008's "one registry, three adapters" is true again.
5. **TASK-37** (WorkflowRuntime service shape) — already resolved in plan-mode. The service becomes `{ publish, write, writeHumanInput }`. Workflow-level `paused` is deleted (state machine 7→6).
6. **TASK-38** (delete core's `publish`/`write`) — already resolved in plan-mode. Path (d): runner is the only mutator. Core shrinks by 2 functions + 1 test file.
7. **TASK-41** (subscribeSet exact-key) — small, independent fix. Can run in parallel with TASK-35 if a parallel session is desired; the changes don't conflict.
8. **TASK-43** (WsClient send API) — independent of TASK-35 through TASK-40.
9. **TASK-42** (architecture doc stale) — CNS hygiene; can run any time.
10. **TASK-40** (prune phantom exports) — small; coordinate with TASK-37 because the `WorkflowRuntime.pause` deletion overlaps.
11. **TASK-39** (wording-drift reconcile) — last. Depends on TASK-35, 37, 38, 43 landing so the summaries patch against final state.

Per Andrew's "verify per theme" rule: each task gets its own commit (code + tests + intent mark + log entry + bubble + CNS health gate). The judgment-call tasks (37, 38, 40) are already resolved — no `clarify` is needed before the code commits land. The new tasks (44, 45) are pre-work for the rest, not judgment calls.

Per the "Subtract Before You Add" principle: TASK-38 and TASK-40 are net-deletion. TASK-42 is a doc patch, not code. TASK-39 is a doc reconcile. TASK-37 has a deletion component (workflow-level `paused`) plus an addition (the `write` and `writeHumanInput` service methods). The substantive net code work is TASK-35 (two functions), TASK-36 (refactor), TASK-37 (2 new methods + state-machine reduction), TASK-38 (deletion of 2 functions), TASK-41 (3 lines), and TASK-43 (two methods). TASK-40's net effect is small deletions plus the YAML fix. TASK-44 adds a new workspace package (the examples); TASK-45 is design work, not code.

### Suggested execution order (Phase 2 follow-up, original 30-34)

1. **TASK-30** (core gaps) — closes the foundation. Required for renderer-log/renderer-react tests to construct real workflows.
2. **TASK-31** (runner integration test) — proves runWorkflow drives a workflow end-to-end. Required before renderers can subscribe to a live state.
3. **TASK-32** (transport wire format + live) — closes the runner→renderer data path. The renderers depend on this.
4. **TASK-33** (renderer-react) — the headline renderer. Depends on transport live.
5. **TASK-34** (renderer-log) — the smallest renderer, good for smoke tests. Depends on transport live.

Per Andrew's "verify per theme" rule: each task gets its own commit (code + tests + intent mark + log entry + bubble + CNS health gate). The five tasks are sequential, not parallel.

## Phase 3: integration

- **`defineNode` helper for dual type guard.** v1.1.
- **Long-running workflow durability.** v1.1. Adopt or reject "use workflow" opinions on idempotency.
- **AI SDK adapter.** v1.1. Wrap `@ai-sdk/*` calls as Effect programs.
- **Visual debugger / timeline UI.** v1.1.
- **ThreadWeaver integration.** Slot the lib underneath.
- **Documentation site.**
- **npm publish.** Claim `underwai` and `@underwai/core`.

## Join workflow fixes + per-app concurrency (2026-06-08, execute-mode)

User-reported defects on the join (parallel merge) demo + one new feature. Four phases, all in `.cns/plans/join-fixes/`.

### JF-1: Stable topological render order ✅ Done (2026-06-08)
→ [`.cns/plans/join-fixes/phase-1-topological-render.md`](plans/join-fixes/phase-1-topological-render.md). Replace Map-insertion-order walk in `RenderedPanel.useRows` with a longest-path-from-root level sort. Helpers land in `packages/core/src/operations.ts` as `topologicalLevels`. Three test cases (chain, diamond, disconnected).

### JF-2: Curved edges for graph fan-in ✅ Done (2026-06-08)
→ [`.cns/plans/join-fixes/phase-2-graph-fanin.md`](plans/join-fixes/phase-2-graph-fanin.md). In `Graph.computeLayout`, detect fan-in groups (edges sharing a target) and route them along cubic Béziers with vertical offset based on source row. Single-source edges stay straight.

### JF-3: Runtime concurrency knob + event-driven ready queue ✅ Done (2026-06-08)
→ [`.cns/plans/join-fixes/phase-3-runtime-concurrency.md`](plans/join-fixes/phase-3-runtime-concurrency.md). `RunOptions` gains `maxConcurrent?: number` (default 1). The dispatch loop is event-driven: each ready node is forked as a fiber carrying its own `NodeKey`; the loop wakes on any in-flight completion and dispatches up to `(maxConcurrent - inFlight.size)` ready nodes. `currentKey` global removed; `inFlightKey` closure replaces it (per-fiber). Three new unit tests cover default sequential, parallel dispatch, and final-state equivalence.

### JF-4: App-level option wiring ✅ Done (2026-06-08)
→ [`.cns/plans/join-fixes/phase-4-app-option.md`](plans/join-fixes/phase-4-app-option.md). `Demo` type gains `maxConcurrent?: number`. Join demo sets `maxConcurrent: 4`. `ExampleShell` passes it through to `rt.run` (with a default-undefined branch to satisfy `exactOptionalPropertyTypes`). Other demos default to 1. New test asserts parallel-vs-sequential wall-clock improvement (`parMs < seqMs * 0.85`).

Sequential per Andrew's preference. Commit + push after each phase.
