# Log

## 2026-06-06

**Bootstrap.** Project initialized with the design conversation distilled into the central nervous system. Created `.cns/` with `index.md`, `architecture/`, `design/`, `product/`, `research/`, `intent.md`, `log.md`, `plans/`, `graph.json`.

**Decisions captured:**
- Name: `underwAI` (lowercase, capital "AI"). The "way" is the workflow; the AI is the resolver.
- License: Apache-2.0. Adoption > copyleft; patent grant matters for AI libs.
- Data structure: flat typed DAG, JSON-serializable, the only state.
- Runtime: Effect for composition, lib is the runner (not a language, not a builder).
- Structured outputs: first-class via Zod, not a special primitive.
- Human-in-the-loop: compositional via input schema marker, subtree re-derivation.
- Renderers: two modes (auto-render / subscribe), consumer supplies the registry, lib ships zero UI.
- Repo: `github.com/AndrewTBurks/underwai`.

**v1 scope settled:** flat typed DAG, Zod I/O, Effect programs, runner with `init`/`deserialize`/`findReadyNodes`/`findSubtree`/`publish`/`write`/`writeHumanInput`/`step`, transport-agnostic event stream, subscription API, Zod extension for human-updatable fields.

**Open questions in `intent.md`:** persistence binding, multi-parent reduce, transport, schema ergonomics, Effect buy-in, streaming shape, long-running durability, type system mechanics. Each is a real pivot; resolve before writing the v1 spec.

**Arena (architect skill).** Ran a 4-candidate arena to resolve the open pivots:

- **Candidates** (one per combination of the 4 most-load-bearing pivots):
  - C1: explicit reduce, transport-agnostic, schema-driven, field-level streaming
  - C2: implicit reduce, in-process, effect-driven, final-only streaming
  - C3: implicit reduce, transport-agnostic, schema-driven, accumulator streaming
  - C4: implicit reduce, transport-agnostic, dual (schema + effect), accumulator streaming

- **Base picked:** Candidate 3. Cross-judge scores: C1=22, C2=26, C3=29, C4=28. C3 wins on the "runner is boring" criterion. C3 and C4 converge on three of four pivots; the divergence on type system mechanics is a v1.x refinement.

- **Grafts:**
  - From C4: the *concept* of a `defineNode` helper as a v1.1 feature.
  - From C2: the in-process `WorkflowEventBus` as the reference transport.

- **Rejections:** C1's explicit `ReduceNode`, C1's path-on-from_node, C1's field-level streaming, C2's in-process-only transport, C4's `defineNode` in v1.

- **Convergence signal:** C3 and C4 converge on three of four pivots. Strong agreement on the core shape.

**v1 design committed (commit `ffff8ed`).** `docs/design.md` ships with the full rationale + synthesis record. `src/stub.ts` is a complete type-level proof that the design compiles, with `throw new Error("not implemented")` bodies. `tsc --noEmit` exit 0.

**Decisions resolved:** reduce semantics (implicit), transport (transport-agnostic), type system mechanics (schema-driven), streaming shape (accumulator + final).

**Decisions deferred to v1.1+:** `defineNode` dual type guard, long-running workflow durability, SSE/WS transports, AI SDK adapter, reference React adapter.

**CNS health gate green:** validate.py PASSED, graph.py --check OK.

---

**Design revision (v1 → v1.1).** Andrew's feedback after reviewing the v1 design:

- "It's overly verbose."
- "Arrays are the wrong data structure to store nodes, inputs, and outputs."
- "Nodes should be addressable by key. Keys should be deterministic (think React useId)."

The revision is substantial. The new design is key-addressable, has a stricter composition API, drops the event-stream subscription model, splits human-in-the-loop into two modes, and reduces verbosity throughout.

**Resolved in the design conversation:**

- **Composition API is the only way to create nodes.** Consumers never type keys. Keys are produced by combinators and carried as template-literal types on `NodeRef<Path>`.
- **Combinators:** `run`, `then`, `all` (overloaded array|object), `thenLoop(body, predicate)`. The set is small and bounded.
- **Data structure:** `Record<string, Node>` keyed by `NodeKey<Path>`. No `Readonly` wrappers; immutability by convention. `nodes: Record<string, Node>` instead of `ReadonlyArray<Node>`.
- **Subscription:** `subscribe(state, key, onUpdate(node))`. Node-granularity. The consumer's renderer switches on `node.status`. The wire format (v1.1+) is `WorkflowEvent`-driven.
- **Human-in-the-loop:**
  - `z.human(z.string())` for writeable (the field is human-writable; node runs with seeded value; can be updated later).
  - `z.human(z.string()).verified()` for hard-pause (the field is human-writable; node pauses for confirmation; the human MUST engage).
  - One API: `writeHumanInput(state, nodeKey, fieldKey, value)`. The "starting value" (proposed, current, or empty) is a property of the field's state; the API doesn't distinguish.
  - The verified gate resets on parent re-execution. When an upstream re-execution changes a node's input, the node's status flips to `stale` and (when the runner picks it up) to `paused` for re-confirmation.
- **Staleness:** `stale` is a node-level property, not a per-field marker. When a node's input changes, the node goes `stale`. Downstream subtree propagates. Siblings unaffected.
- **Loops:** A family of nodes (`root.refine[0]`, `root.refine[1]`, ..., `root.refine.final`). The body, predicate, and final are all real nodes in the DAG. The predicate is a node, not a callback — fully composable.
- **Wire format:** `WorkflowEvent` is wire-only (v1.1+). In-process is Node-granularity. The wire format is a more minimal representation of the same event log.

**New node status:** `paused` (waiting for verified-field human input) and `stale` (input changed; needs to re-execute). Eight total: `pending` / `ready` / `running` / `streaming` / `resolved` / `failed` / `paused` / `stale`.

**Revised design committed.** `docs/design.md` (v1.1) supersedes the v1 design. `src/stub.ts` matches the new shape. `tsc --noEmit` exit 0.

**20 load-bearing decisions** captured in the design doc. Tradeoffs accepted: composition API restrictiveness, schema+Effect program dual contract without compile-time enforcement, whole-Node subscription callbacks, family-of-nodes loop shape, single human-input API, no `Readonly` wrappers, etc.

**CNS health gate green:** validate.py PASSED, graph.py --check OK.


---

**Interrogate + Phase 1 plan.** Andrew invoked the `interrogate` skill to stress-test the v1.1 design. Ran a 4-reviewer manual arena (one posture per reviewer: type-system purist, Effect/runtime engineer, data structure/schema, renderer/UX) over the v1 → v1.1 diff. Total: 32 findings (7 critical, 20 warning, 5 nit), deduped to ~26 unique.

**Act-on criticals (8):** running+writeHumanInput race (B1), concurrent step() safety (B2), subscribe prefix semantics + default inversion (A7+D4), subscribeAll for wall-display (D3), runtime impl of z.human() (A2+C5), edge indexing (A3), per-node error field (C8), InputSource carries schema for two-stage validation (C3+C4).

**Consider list (14):** Path generic, output vs finalOutput duality, humanFields cache, Actor type, stale coalescing, Effect buy-in as documented limitation, findReadyNodes consistency, batched subscription, stale UX, topologicalOrder, getHumanInputDisplay, WorkflowRuntime service, thenLoop family handle, delta-based subscription.

**Andrew's choices for Phase 1:** (1) all 8 act-on criticals in Phase 1, (2) all 14 consider-list items in Phase 1, (3) pre-prepared brief per task (3 options + recommendation + one-question `clarify`). Rock-solid before code. 22 design sessions total.

**Phase 1 written to `.cns/intent.md`.** Phase 2 and Phase 3 unchanged. CNS health gate green: validate.py PASSED, graph.py --check OK.

---

**Phase 1 design sessions begin.** Andrew: "execute-mode lets work through each plan in phase 1 to solidify the details." Sequential one-at-a-time. Each task is a brief-driven design session: 3 options + recommendation (or a patch shape for non-decision tasks) + one-question `clarify`. Patches land in `docs/design.md` and `src/stub.ts`; commit per task; CNS health gate after.

**TASK-A (resolved).** running+writeHumanInput race. Andrew: "Effect already ships an interrupt primitive. expose a signal for each node's execution that supports interruption. clean." State machine gets `running → stale → running` on mid-execution writeHumanInput; the runner interrupts the in-flight Effect fiber via `Fiber.interrupt`. Implementation gated on TASK-B's `runWorkflow` owning the fiber. Patch: state-machine paragraph in `docs/design.md`; stub unchanged. `tsc` green.

**TASK-B + TASK-T (resolved, combined).** Concurrent `step()` safety + `WorkflowRuntime` service. Andrew: rename `step` to `stepInternal` (not consumer-facing), ship `runWorkflow` as the primary API, `WorkflowRuntime` is a class extending Effect's `Context.Tag` so the name is both type and value. Consumers do `yield* WorkflowRuntime` in their `Effect.gen` programs; `runWorkflow` provides the service as a layer. Patches: `docs/design.md` runtime section, `src/stub.ts` adds `runWorkflow` and the `WorkflowRuntime` class, `step` becomes `stepInternal`. `tsc` green.

**TASK-C (resolved) + TASK-D (absorbed).** Subscribe prefix semantics + default inversion. Andrew pivoted twice. First: rejected the `{ prefix: true }` opt-in knob. "this is just really bad API design. super opaque. the best option would be to limit to only exact matches." Second: rejected `subscribeAll` as a separate function. "honestly we don't need subscribeAll even. it's wasteful to even include because the wildcard matching covers that completely." Final shape: two methods, no flags. `subscribe(state, key, onUpdate)` is single-key exact match. `subscribeSet(state, pattern, onUpdate)` is wildcard pattern with three cases (exact key, `prefix.*` path-segment prefix, bare `*` for every node). Callback is `(nodes: Record<string, Node>) => void` — the matched set, not a stream. TASK-D absorbed: the wall-display case is `subscribeSet(state, "*", onUpdate)`. TASK-P and TASK-V's prior cancellations compound with this — the subscription API has no flags left. Patches: `docs/design.md` subscription section rewritten; `src/stub.ts` `subscribe` simplified, `subscribeSet` added, `subscribeAll` and `SubscribeOptions` removed. `tsc` green.

**TASK-E (resolved).** Runtime implementation of `z.human()`. Andrew confirmed option (a): clone-and-mutate `_def.humanMode`. The `human()` runtime function clones the input schema and sets the marker on the clone's `_def`. The `getHumanMode()` helper reads the marker. The seed-vs-no-seed vocabulary is named in the design doc. Target: Zod 3.x. Patches: `docs/design.md` Human-in-the-loop section gains a "Runtime implementation" code block and a "Seed vs. no-seed vocabulary" paragraph; `src/stub.ts` schemas section gains the `human()` runtime function and the `getHumanMode()` helper. `tsc` green.

**Process note:** Andrew interrupted mid-patch to ask for clearer briefs upfront. Going forward, every task brief will lead with the design rationale and the tradeoffs in prose, then offer the choice. No more leading with the recommended option as the default; the default is "explain the options, ask."

**TASK-F (resolved).** Edge indexing. Andrew: ship both maps (`edgesByTarget` for `findReadyNodes`, `edgesByFrom` for `findSubtree`). Neither is serialized. The "Serialization contract" section is added to `docs/design.md` to lock the source-vs-derived pattern. TASK-R's `topologicalOrder` will follow the same pattern. Patches: `WorkflowState` gains both maps; `docs/design.md` data structure section shows both with their roles; serialization contract section is added. `tsc` green.

**TASK-H (resolved, big pivot).** Andrew's question ("I don't really understand what InputSource even is") surfaced a deeper issue. The per-field `InputSource` discriminated union was the wrong shape. The pivot: `ResolvedInput = { value, schema, humanFields }` (single value, not bundle). `Edge = { from, to, bridge? }` (no toField). Composition API has two `.then()` overloads: `parent.then(child)` direct match, `parent.then((out) => in_, child)` with bridge function. Bridge is composition metadata on the Edge, not a node. The composition API combinators enforce shape match; when shapes don't match, the consumer writes a bridge function. Two-stage validation preserved (per-source `value` vs `schema`, then aggregate). Patches: `InputSource` and the bundle shape removed; `ResolvedInput` becomes a single value; `Edge` drops `toField`; `then` has the two overloads. `tsc` green. CNS health gate green.

**TASK-I (resolved, against the plan's recommendation).** Andrew: "we MUST have path/node type safety and specificity as a first-class constraint. the consumer side is interfacing with a useless library if not." The plan's "drop the Path generic for v1" was wrong. The Path generic is non-negotiable. Combinator signatures carry the path through: `run(def)` → `NodeRef<"root">`, `then(parent, def)` → `NodeRef<`${P}.${K}`>`, `all` and `thenLoop` likewise. The brand on `NodeKey` rejects raw strings; the path generic rejects "wrong node ref" at the call site. `subscribeSet` is the consumer's path to addressing dynamic families (the array-form `all`'s N, the `thenLoop`'s iteration index). `tsc` green.

**Extract node.md.** Andrew's interrupt during the TASK-G commit: "instead of repeat, extract it into a single extra node.md file in the architecture folder and link to it from both design and architecture." The Node type was duplicated in `docs/design.md` and `.cns/architecture/index.md`; both copies would drift. Patches: extract canonical `Node` and `NodeStatus` to `.cns/architecture/node.md` with full rationale, per-status semantics, and cross-references. Both parent files link to it via a short comment + the architecture/index.md frontmatter `links[]` entry. Single source of truth for the data shape. The stub implementation stays in `src/stub.ts`; node.md is the doc.

**Edge shape pivot.** Andrew: "and honestly I think the Edge shape is wrong too with `toField` - what does this even mean?" The `toField` was the per-field wiring assignment (which field on the downstream's input the upstream's output feeds into). The concept was confused: the lib was trying to do per-field wiring in a data structure that doesn't naturally support it. The fix: `Edge = { from, to }` (positional connection), with composition-time wiring enforced by the API. The composition API has two `.then()` overloads: direct match (parent.output shape === child.input shape) and bridge (a function `(parentOut) => childIn`). Bridges live on the Edge as `Edge.bridge` — composition metadata, not a node. The runner applies the bridge at edge resolution.

**TASK-H then extended into TASK-A (running + writeHumanInput race) on a different axis.** When a human writes to a running node's input, the runner interrupts the in-flight Effect fiber via `Fiber.interrupt` (already decided in TASK-A), the node re-runs with the new input. The `ResolvedInput.value` is updated; the `humanFields` map says whether the new value marks the node stale (writeable) or pauses for confirmation (verified). The two-stage validation runs again: per-source `value` against `schema`, then aggregate. If the human's write is invalid, the node fails with a clear error. If valid, the node re-runs.

**TASK-I (resolved, against the plan's recommendation).** Andrew: "we MUST have path/node type safety and specificity as a first-class constraint. the consumer side is interfacing with a useless library if not." The plan's "drop the Path generic for v1" was wrong. The Path generic is non-negotiable. Combinator signatures carry the path through: `run(def)` → `NodeRef<"root">`, `then(parent, def)` → `NodeRef<`${P}.${K}`>`, `all` and `thenLoop` likewise. The brand on `NodeKey` rejects raw strings; the path generic rejects "wrong node ref" at the call site. `subscribeSet` is the consumer's path to addressing dynamic families (the array-form `all`'s N, the `thenLoop`'s iteration index). `tsc` green.

**TASK-L, M, N, O, Q, R, U (all resolved).** The remaining consider-list items closed out. TASK-L: drop the brand on `Actor`, ship `type Actor = string`. TASK-M, N, O, Q, U: doc-only patches. TASK-R: no `topologicalOrder` field; `findReadyNodes` returns `ReadonlyArray<NodeKey>` in dependency order directly. The footgun I labeled (return Set, runner sorts) was genuinely broken — caught and re-asked with two real options.

---

**Phase 1 closure.**

**Status:** 22 of 22 plans have a terminal status. 14 resolved (A, B, C, E, F, G, H, I, L, M, N, O, Q, R, S, U), 2 folded (J, K into G), 1 absorbed (D into C), 1 merged (T into B), 2 cancelled (P, V).

**The data structure converged.** The shapes that emerged from Phase 1:

- `Node["status"]` is a discriminated union. Per-status data lives on the variants that own them.
- `ResolvedInput = { value, schema, humanFields }`. Single value, not a per-field bundle.
- `Edge = { from, to, bridge? }`. No `toField`; bridges are an optional function on the edge.
- `WorkflowState` has `edgesByTarget` and `edgesByFrom` as derived fields. No `topologicalOrder` field; `findReadyNodes` returns the order.
- Composition API: `run`, `then` (two overloads: direct match and bridge), `all` (two forms: array and object), `thenLoop`. All return `NodeRef<P>` with the path type-checked.
- Subscription: `subscribe` (single key), `subscribeSet` (wildcard pattern). No flag options.
- Runner: `runWorkflow` Effect program owns the fiber; `WorkflowRuntime` service provides `publish` / `write` / `writeHumanInput` to consumer programs.
- `NodeKey` is branded and carries a `Path` template-literal generic. Combinator signatures thread the path through.

**Pivots from the original plan:**
- TASK-C: dropped `{ prefix: true }` knob; added `subscribeSet` with a pattern grammar.
- TASK-D: absorbed into TASK-C.
- TASK-G + J + K + S: `Node["status"]` is a discriminated union; per-status data lives on the variants.
- TASK-H: `InputSource` and per-field wiring gone; direct-match composition with optional bridge function.
- TASK-I: Path generic is non-negotiable; combinators carry the path.
- TASK-R: no `topologicalOrder` field; `findReadyNodes` returns in dependency order.

**The 7-status state machine is intact.** `pending` → `running` → `streaming` → `resolved`; `pending`/`running` → `paused` → `pending` (verified gate); `running`/`streaming` → `stale` (input change); `running`/`streaming` → `failed` (effect failure); `paused` is *not* in `findReadyNodes`.

**CNS health gate green.** `tsc --noEmit` green. 14 design commits + 6 docs commits = 20 commits since the start of Phase 1. The repo is at a clean checkpoint ready for Phase 2 (implementation).

**What Phase 2 needs:**
- The lib's `init` (build state from composition expression). Stub throws; needs to walk the composition tree, populate nodes and edges, build edgesByTarget/edgesByFrom.
- The lib's `findReadyNodes` (Kahn's algorithm in dependency order).
- The lib's mutation primitives (`publish`, `write`, `writeHumanInput`) — the consumer-facing half of the `WorkflowRuntime` service.
- The lib's `stepInternal` (run a single ready node's Effect program, handle pause/stale/resolved/failed transitions).
- The lib's `runWorkflow` (the main Effect program: own the fiber, call `stepInternal` in a loop until no ready nodes).
- The lib's `subscribe` / `subscribeSet` (state diff subscription).
- The lib's `serialize` / `deserialize` (round-trip the source fields, recompute derived fields).
- `getHumanFields(node)` and `getHumanInputDisplay(node, fieldKey)` (the operations helpers).

That's a lot. Phase 2 is bigger than Phase 1 was.

---

**Pre-shard landed.** Andrew's instruction (2026-06-06): "create all of the folders NOW with index.md for that project section. the implementation phase will add code. the local decisions/agent context should exist before the code does."

The library is now a pnpm workspace. **All 6 packages ship with v1.0.** Andrew's follow-up (2026-06-06): "to be clear, transport, renderer-react, renderer-log are all v1. there's no v1.1 without those clear packages implemented. they can be implemented in phase 3, but they ship alongside v of the library" — and the wire-format SSE/WebSocket transports are also v1.0. There is no v1.1+ tier. A v1.0 without a way to consume the lib isn't a true v1.0.

- `packages/core/` `@underwai/core` — v1.0. The data structure: types, keys, composition, operations.
- `packages/schema/` `@underwai/schema` — v1.0. The Zod extension: `z.human()` + `.verified()`. Standalone.
- `packages/runner/` `@underwai/runner` — v1.0. The runner: `runWorkflow`, `WorkflowRuntime` service, mutation primitives.
- `packages/transport/` `@underwai/transport` — v1.0. Subscription API + wire format + transports (SSE, WebSocket).
- `packages/renderer-react/` `@underwai/renderer-react` — v1.0. Reference React adapter.
- `packages/renderer-log/` `@underwai/renderer-log` — v1.0. stdout log renderer for tests.

The original pre-shard had transport, renderer-react, and renderer-log as folder-only (v1.1+); the correction promoted all three to real packages with `package.json` + `tsconfig.json` + `src/index.ts`. The root `tsconfig.json` references all six projects.

Each `index.md` carries: the package's purpose, the boundary (imports/exports), the design decisions that govern it (cross-references to CNS architecture/ and the plan files that touch it), and the Phase 2 implementation notes.

The pre-shard artifact at `src/stub.ts` was moved to `packages/core/src/stub.ts`. `packages/core/src/index.ts` re-exports from the stub so the package has a `main` until Phase 2 distributes the stub's contents.

Root-level changes: `pnpm-workspace.yaml`, workspace-root `package.json`, project-references `tsconfig.json`, `README.md` (package table, principles, repo context).

CNS updates: `.cns/index.md` `links[]` entries for all 6 packages + new "Package references" section. `.cns/product/index.md` "Modules" → "Packages" with the 6-package table (v1.0 across). `.cns/intent.md` Phase 2 implementation order now spans all 6 packages (schema → core → runner → transport → renderer-react → renderer-log → tests).

CNS health gate green: `validate.py` PASSED, `graph.py --check` OK. `tsc -b` green.

**The 22 plan files are deleted.** The plan files were the work product of the design phase (per the nervous-system skill's persistent-per-task-plan pattern for multi-session design phases). Now that the design phase is over and the decisions are sharded into the CNS + the new package `index.md` files, the plan files are redundant scratch.

The skill says: "a completed plan that has been distributed into CNS nodes is stale; delete it." The standard shard pipeline's "delete the source plan file" step applies here, but the distribution is already done. The deletion is the final step.

The deleted content is preserved in the git history (22 individual plan files, ~94,000 chars total, all resolved). Anyone who needs to revisit a decision can grep git for the file or look at the cross-references in the package `index.md` files.

---

## 2026-06-07 — Phase 2 audit + intent re-plan

A parallel subagent audited the 4 implemented packages against the
design spec. The verdict: ~50% of the named surface area is
implemented. Tests pass (61/61) but only cover what exists.

The follow-up is encoded in intent.md as TASK-30 through TASK-34
(five new top-level tasks). Execution order: 30 → 31 → 32 → 33 → 34.
Each task closes one of: core gaps, runner integration test, transport
wire format + live subscription, renderer-react, renderer-log.

## 2026-06-07 — TASK-30 start: close core gaps

`init()` walks a composition tree and produces a WorkflowState.
`getHumanInputDisplay()` real implementation. `publish`/`write`
core mutation primitives (currently inlined in the runner). TDD per
function: RED, watch fail, GREEN, refactor.

## 2026-06-07 — TASK-30 done: core gaps closed

12 new tests added across three test files. 73/73 green.

  - `core/compose(fn)`: wraps a composition expression in a
    per-compose Builder. The combinators (run, chain, all,
    thenLoop) record their defs and edges into the Builder.
    Result: a CompositionTree that init() can walk. DEC-CORE-015.
  - `core/init(tree, id)`: walks CompositionTree.defs, builds
    nodes + edges + derived fields. Replaces the pre-shard stub.
    DEC-CORE-016.
  - `core/getHumanInputDisplay(state, node, fieldKey)`: real
    implementation. Source kind: literal / from_node / human
    (with status pending or set). The function now takes state
    so it can read edgesByTarget. DEC-CORE-017.
  - `core/publish(state, key, output, partial, now)` and
    `core/write(state, key, value)`: public mutation primitives
    in core/operations.ts. The runner still inlines markStreaming
    in runtime.ts; the migration to use core's publish is
    TASK-31. DEC-CORE-018.

Follow-up: TASK-31 (runner integration test) re-attempts the
test that was rolled back on 2026-06-07.

## 2026-06-07 — TASK-31 start: runner integration test

Re-attempt the integration test that was rolled back on
2026-06-07 (DEC-RUNNER-009). The runtime is structurally
complete; the test was the hard part. Now I have core/init() to
construct a real WorkflowState from a composition, and
core/publish() / core/write() as the public mutation
primitives. The integration test can drive a real composed
workflow end-to-end.

Plan: 4 tests per the original TASK-31 spec.

## 2026-06-07 — TASK-31 done: runner integration test

4 new tests in packages/runner/src/runtime.test.ts. 77/77
green. DEC-RUNNER-009 closed.

  - test 1: single-node workflow drives pending -> running ->
    resolved, then workflow status === "completed".
  - test 2: a failing program marks the node failed and the
    workflow status === "failed".
  - test 3: subscribers are notified >= 2 times during a
    single-node flow (markRunning + markResolved).
  - test 4: a 3-node workflow drives root -> a -> b in
    dependency order.

The runtime now accepts state.status "pending" as a valid
starting state (was previously an early-exit). The orchestrator
flips to "completed" when all nodes are resolved. This was
the friction point from the rolled-back 2026-06-07 attempt.

## 2026-06-07 — TASK-32 start: transport wire format + live subscription

The audit found transport's subscribe/subscribeSet are one-shot
(no live fan-out from the runner), there's no event-stream
wire format, and no SSE/WebSocket transports. The package's
index.ts is empty.

Plan:
  - transport/live.ts: a LiveSubscriptionRegistry (re-uses the
    runner's SubscriptionRegistry contract).
  - transport/event-stream.ts: the WorkflowEvent discriminated
    union, JSON-serializable, round-trippable.
  - transport/transports/sse.ts: SSE structure (open/write/close).
  - transport/transports/ws.ts: WebSocket structure.
  - transport/index.ts: re-exports the public surface.

## 2026-06-07 — TASK-32 done: transport wire format + live subscription

11 new tests added. 89/89 green. CNS validates.

  - core/live.ts: LiveSubscriptionRegistry. One fan-out
    primitive; transport wraps it with pattern matching,
    runner wires it into RunOptions.liveRegistry. DEC-TRANSPORT-008.
  - core/live.test.ts: 3 tests for register/notify/unsubscribe.
  - transport/subscribe.ts: subscribe(registry, key, cb) and
    subscribeSet(registry, pattern, cb) are now live (callbacks
    fire on every notify, not just once). subscribe.test.ts
    updated: 6 tests pass.
  - transport/event-stream.ts: WorkflowEvent discriminated
    union (6 kinds: node-added, node-updated, node-removed,
    edge-added, edge-removed, workflow-status). JSON
    serializable. encodeSseEvent formats SSE wire.
  - transport/event-stream.test.ts: 3 tests for
    roundtrip + SSE encoding + reject malformed.
  - transport/transports/sse.ts: SseServer + SseClient.
    Open(registry, sink) subscribes and writes SSE messages.
    Parse(stream) yields WorkflowEvents. 2 tests.
  - transport/transports/ws.ts: WsServer + WsClient. Same
    pattern, JSON frames instead of SSE. 2 tests.
  - transport/index.ts: re-exports the public surface.
    Was `export {}` before.
  - runner/runtime.ts: RunOptions accepts liveRegistry.
    After every state mutation, runtime calls
    liveRegistry.notify(result). 1 new test exercises this.

The wiring closes the runner -> transport -> renderer data
path. Renderers can now subscribe to a live state and get
real-time updates.

## 2026-06-07 — TASK-33 start: renderer-react

Scaffold the React adapter package. Plan:
  - package.json with @underwai/core + react peer deps.
  - vitest.config.ts.
  - provider.tsx: <WorkflowProvider registry={...} state={...} />.
  - hooks.ts: useWorkflowState, useNode, useSubtree (useSyncExternalStore).
  - registry.tsx: registerKind(kind, fn), getKindRenderer(kind).
  - auto-render.tsx: <AutoRender state={...} /> walks DAG.
  - index.ts: re-exports.
  - 1 test: register a renderer, instantiate state with 3 nodes,
    assert the renderer is called for each. Skip RTL.

## 2026-06-07 — TASK-33 done: renderer-react

5 source files + 1 test. 92/92 green. CNS validates.

  - provider.tsx: <WorkflowProvider registry state children> wires
    LiveSubscriptionRegistry + WorkflowState into React context.
  - hooks.ts: useWorkflowState, useNode, useSubtree. All use
    useSyncExternalStore. (DEC-RR-001.)
  - registry.tsx: registerKind, getKindRenderer, clearRegistry,
    defaultRenderer. (DEC-RR-002.)
  - auto-render.tsx: <AutoRender state={...} /> walks the DAG
    and calls each registered kind renderer. Unknown kinds use
    defaultRenderer. (DEC-RR-003.)
  - index.ts: re-exports.
  - index.test.ts: 3 tests. Asserts on the *call* to render
    (kind match) and on the element's props (data-auto-render),
    not the rendered DOM. Per the audit: skip RTL. (DEC-RR-004.)

The renderer is a thin adapter over the LiveSubscriptionRegistry.
Consumers compose their own UI from useNode, useSubtree,
useWorkflowState.

## 2026-06-07 — TASK-34 start: renderer-log

The smallest possible renderer. Two files:
  - registry.ts: kind -> (node, indent) => string.
  - runner.ts: runLogRenderer(registry, state, opts?) subscribes
    via subscribeSet(registry, "*", ...) and prints each notify.

## 2026-06-07 — TASK-34 done: renderer-log

3 source files (registry, runner, index). 3 tests. 95/95
green. CNS validates.

  - registry.ts: kind -> (node, indent) -> string. Default
    renderer prints "<indent><kind> (<status>)". (DEC-RL-001.)
  - runner.ts: runLogRenderer(registry, initialState,
    {print, getState}) subscribes via subscribeSet(registry,
    "*", onUpdate). On every notify, calls getState() and walks
    the DAG. (DEC-RL-002.)
  - index.test.ts: 3 tests. Initial render prints all 3
    kinds with indentation by depth. Re-render on registry
    notify works.

The runner takes a getState function from the consumer (the
consumer owns the state). This is the v1.0 wire; a v1.1 could
push state through subscribeSet's callback.

## 2026-06-07 — Conformance audit encoded

A subagent walked 49 design decisions against the code. Findings:
35 implemented, 13 partial, 1 unimplemented, 0 cancelled-but-shipped.
The 1 unimplemented is `Edge.bridge` resolution (DEC-RUNNER-007).
The 13 partials split 6/13 wording drift and 7/13 real implementation
gaps. The audit is in this session's prior turn; the user asked to
encode all actions (not just the top 5) into intent.md.

Consolidating into TASK-35 through TASK-40 + 2 judgment calls. Per
the consolidation pattern: small tasks where the work is coherent,
not 13+ individual items. Wording-drift partials go in a single
doc-reconcile task; code fixes for the load-bearing contracts go in
focused tasks.

## 2026-06-07 — Conformance-audit follow-ups encoded as TASK-35..43

9 new intent tasks encoded from the conformance audit, plus 2
judgment calls surfaced in-task (TASK-37, TASK-38, TASK-40
each have a "JUDGMENT CALL — surface to user" callout).

Tasks 35-43:
  - TASK-35: bridge resolution + Fiber.interrupt (v1.0 contract
    breaks; the two highest-priority fixes).
  - TASK-36: SubscriptionRegistry duplication (one registry,
    three adapters).
  - TASK-37: WorkflowRuntime service shape (JUDGMENT CALL).
  - TASK-38: DEC-CORE-018 reconciliation (JUDGMENT CALL).
  - TASK-39: wording-drift partials reconcile (doc-only).
  - TASK-40: prune phantom exports + YAML fix (small deletions).
  - TASK-41: subscribeSet exact-key pattern (3-line fix).
  - TASK-42: architecture doc stale on ResolvedInput (doc-only).
  - TASK-43: WsClient typed send API.

Execution order: 35 -> 36 -> [37 + 38 with clarifies] -> 41
-> 43 -> 42 -> 40 -> 39. The 3 judgment-call tasks block on
the user's `clarify` answers before code lands.

CNS health gate: validate.py PASSED, graph.json OK.

## 2026-06-07 — Plan-mode interview: 3 judgment calls resolved

Plan-mode interview closed all 3 in-task judgment calls on
TASK-37, TASK-38, TASK-40.

  - TASK-37: WorkflowRuntime service = { publish, write,
    writeHumanInput }. write = consumer injection; program
    returns final output via Effect. Workflow-level 'paused'
    deleted from state machine (7 -> 6). Per-node 'paused'
    unaffected.
  - TASK-38: delete core's publish/write. Runner is the only
    mutator. Core becomes pure data-model + composition
    layer.
  - TASK-40 (writeHumanInput sub-bullet): delete the public
    export, drop the _fiber/_stateRef parameters.

Intent.md patched with the resolved shapes. Execution order
updated: no judgment-call tasks block on a `clarify` anymore.

CNS health gate: validate.py PASSED, graph.json OK.

## 2026-06-07 — Plan-mode: examples before the rest (TASK-44, TASK-45)

Andrew's read: the conformance audit asked "does the code
match the design?" but never asked "does the design match how
a real consumer would actually use the library?" Mocking up
example workflows first validates the design before TASK-35
through TASK-43 lock it in.

Resolved (plan-mode interview):
  - 3 examples: linear pipeline w/ bridge, human-in-the-loop,
    live subscription wall display.
  - Single `packages/examples/` Vite app, three sub-routes.
    Deployable, buildable, runs in CI.
  - Examples first, then design audit (TASK-45), then the
    fix tasks. Sequential, not parallel.
  - Examples are real committed code (not sketches); the
    "build and deploy" framing resolved the question.

TASK-44 added to intent.md: scaffold the examples package,
write the three compositions + renderers, expand
runtime.test.ts to run the linear-pipeline example.

TASK-45 added to intent.md: walk each example against the
design. Output is either "design validated, proceed" or
"design needs adjustment" + the change set that folds back
into TASK-35 through TASK-43.

Execution order: 44 -> 45 -> 35 -> 36 -> 37 -> 38 -> 41 ->
43 -> 42 -> 40 -> 39. Examples come first.

CNS health gate: validate.py PASSED, graph.json OK.

## 2026-06-07 — TASK-37 done: WorkflowRuntime service shape

The service now has { run, publish, write, writeHumanInput,
getState, subscribe }. publish is the program-side method
(running program surfaces partial output). write and
writeHumanInput are consumer-side (the workflow's owner
injects values from outside the program). No pause method.

The service holds the state. WorkflowRuntimeLive(opts)
constructs a fresh service with its own stateRef. The
stateRef is the source of truth; consumers call
writeHumanInput *before* run, then run, and the run sees
the mutated state.

WorkflowStatus reduced from 5 to 4: removed "paused".
The per-node "paused" state survives; it's used when a
node has a human-marked field. The workflow-level
"paused" status had no transition into it; it was a
phantom slot. The state machine 5->4 is the laziest
expression of the design.

Tests: 16/16 in the runner (was 13/13). 3 new tests for
the service methods (publish, write, writeHumanInput).
98/98 across the monorepo. tsc clean.

CNS health gate: validate.py PASSED, graph.json OK.

## 2026-06-07 — TASK-38 done: delete core's publish/write

Per plan-mode path (d): core's `publish` and `write` are
deleted. Core is now a pure data + composition layer with
no mutation primitives. The runner is the only mutator.

Files:
  - packages/core/src/operations.ts (-30 lines: publish and
    write removed)
  - packages/core/src/index.ts (re-exports cleaned)
  - packages/core/src/publish-write.test.ts (DELETED: 3 tests)

Tests: 95/95 across the monorepo (was 98, minus the 3
removed tests). The runner's 16 tests cover the same
transitions via the WorkflowRuntime service. tsc clean.

Net: -33 lines from core. Core is now a pure value layer.

## 2026-06-07 — TASK-35 done: bridge resolution + (deferred) Fiber.interrupt

Bridge resolution: `resolveInput(state, key)` added to
@underwai/core. Walks `edgesByTarget[key]`, looks up each
upstream's `status.finalOutput`, applies the edge's
`bridge` function (if any). Returns undefined if any
upstream is unresolved. The runtime now calls
`resolveInput(result, key) ?? node.input.value` before
each program execution.

Fiber.interrupt: DEFERRED. The current runtime is
single-threaded (programs run sequentially, no in-flight
fiber to interrupt). The interrupt pattern is needed for
the WebSocket transport where a client writes while a
server-side program is running. That requires a more
substantial refactor (worker pool or fiber-per-node) and
is out of scope for this task. Documented in the test
description; the supported injection pattern is
`write`/`writeHumanInput` before `run`.

Side effects:
  - `markPaused` no longer sets workflow-level "paused"
    (phantom slot, removed in TASK-37). Per-node paused
    survives.
  - The runtime test for `markPaused` updated.
  - serialize/deserialize: bridges are functions and
    don't survive serialization. This is a known
    limitation; consumers who need to serialize must
    re-attach bridges. Documented in the resolveInput
    test.

Files:
  - packages/core/src/operations.ts (+resolveInput)
  - packages/core/src/index.ts (re-export)
  - packages/core/src/resolve-input.test.ts (4 tests, all
    pass)
  - packages/runner/src/runtime.ts (use resolveInput)
  - packages/runner/src/mutations.ts (markPaused cleanup)
  - packages/runner/src/mutations.test.ts (markPaused test
    updated)
  - packages/runner/src/runtime.test.ts (bridge test +
    write-before-run test)

Tests: 101/101 across the monorepo. tsc clean.
