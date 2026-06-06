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

**v1 scope settled:** flat typed DAG, Zod I/O, Effect programs, runner with `init`/`resume`/`write`/`writeHumanInput`/`findReadyNodes`/`findSubtree`, subscription API, React reference renderer, persistence.

**Open questions in `intent.md`:** persistence binding, multi-parent reduce, transport, schema ergonomics, Effect buy-in, streaming shape, long-running durability, type system mechanics. Each is a real pivot; resolve before writing the v1 spec.
