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

**v1 scope settled:** flat typed DAG, Zod I/O, Effect programs, runner with `init`/`deserialize`/`findReadyNodes`/`findSubtree`/`publish`/`write`/`writeHumanInput`/`runWorkflow`, transport-agnostic event stream, subscription API, Zod extension for human-updatable fields.

**Open questions in `intent.md`:** persistence binding, multi-parent reduce, transport, schema ergonomics, Effect buy-in, streaming shape, long-running durability, type system mechanics. Each is a real pivot; resolve before writing the v1 spec.

**Arena (architect skill).** Ran a 4-candidate arena to resolve the open pivots:

- **Candidates** (one per combination of the 4 most-load-bearing pivots):
  - C1: explicit reduce, transport-agnostic, schema-driven, field-level streaming
  - C2: implicit reduce, in-process, effect-driven, final-only streaming
  - C3: implicit reduce, transport-agnostic, schema-driven, accumulator streaming
  - C4: implicit reduce, transport-agnostic, dual (schema + effect), accumulator streaming

- **Base picked:** Candidate 3. Cross-judge scores: C1=22, C2=26, C3=29, C4=28. C3 wins on the "runner is boring" criterion — the most reliable indicator of "this lib will be small enough to fit in your head." C3 and C4 converge on three of four pivots; the divergence on type system mechanics is a v1.x refinement.

- **Grafts:**
  - From C4: the *concept* of a `defineNode` helper as a v1.1 feature. v1 ships without it; the schema + Effect program are both required but not type-checked against each other.
  - From C2: the in-process `WorkflowEventBus` (`bus.on(handler) => unsubscribe`) as the reference in-process transport for the transport-agnostic event stream.

- **Rejections:**
  - C1's explicit `ReduceNode` — data structure stays flat.
  - C1's `path` on `from_node` — consumer picks a field off the parent's output in their Effect program.
  - C1's field-level streaming — accumulator covers 90% of cases; field-level is v1.x.
  - C2's in-process-only transport — rejected; SSR + wall + chat are v1 use cases.
  - C4's `defineNode` helper — deferred to v1.1.

- **Convergence signal:** C3 and C4 converge on three of four pivots. Strong agreement on the core shape.

**v1 design committed.** `docs/design.md` ships with the full rationale + synthesis record. `src/stub.ts` is a complete type-level proof that the design compiles, with `throw new Error("not implemented")` bodies. `tsc --noEmit` exit 0. Implementation fills in body-by-body against this contract.

**Decisions resolved:** reduce semantics (implicit), transport (transport-agnostic), type system mechanics (schema-driven), streaming shape (accumulator + final).

**Decisions deferred to v1.1+:** `defineNode` dual type guard, long-running workflow durability, SSE/WS transports, AI SDK adapter, reference React adapter.

**CNS health gate green:** validate.py PASSED, graph.py --check OK.
