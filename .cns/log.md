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

**TASK-G (resolved, folded with TASK-J, TASK-K, TASK-S).** Andrew's pivot: `Node["status"]` becomes a discriminated union. The shared fields (id, kind, inputSchema, input, outputSchema, actor, createdAt, updatedAt) stay on `Node` once. Per-status data (output, error, timestamps) lives on the status variants. Four plans fold into one refactor: TASK-G (per-node error on `failed` variant), TASK-J (`output`/`finalOutput` move off the top level onto `streaming`/`resolved` variants), TASK-K (`humanFields` cache drops, `getHumanFields(node)` reads the schema on demand), TASK-S (`getHumanInputDisplay` returns a discriminated union on `source` kind). The property is named `status`, not `state`, to avoid the namespace collision with `WorkflowState`. Patches: `Node` and `NodeStatus` reshaped in `docs/design.md`, `.cns/architecture/index.md`, and `src/stub.ts`. `getHumanFields` and `getHumanInputDisplay` added to the operations section. `tsc` green. CNS health gate green.
