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
