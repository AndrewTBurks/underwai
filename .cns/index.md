---
title: "underwAI"
type: project
principles: [minimal-api-surface, maximal-flexibility]
links:
  - id: architecture
    path: .cns/architecture/index.md
  - id: design
    path: .cns/design/index.md
  - id: product
    path: .cns/product/index.md
  - id: research
    path: .cns/research/index.md
  - id: core
    path: packages/core/index.md
  - id: schema
    path: packages/schema/index.md
  - id: runner
    path: packages/runner/index.md
  - id: transport
    path: packages/transport/index.md
  - id: renderer-react
    path: packages/renderer-react/index.md
  - id: renderer-log
    path: packages/renderer-log/index.md
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# underwAI

A typed, durable data structure where AI, humans, and effects resolve nodes into values. A portable workflow runtime built on Effect's composition primitives.

The structure **is** the state. There is no separate runtime memory. A workflow can be initialized from a definition, serialized to JSON, resumed on another machine, and have a human update a field, and the subtree re-derives.

## Principles

Two principles govern every decision in this project. Every layer of the CNS, every task in `intent.md`, every patch to `docs/design.md` and `src/stub.ts` is checked against them.

### Minimal API surface

The lib's surface is the smallest set of primitives that supports the workflow model. New combinators, types, or options are rejected unless they cannot be expressed by composing the existing ones. The state machine has exactly eight states. The composition API has four combinators. The subscription API has two functions. The runtime boundary is the data structure, not a builder. A consumer who learns the lib learns four combinators and a state machine, not a framework.

The cost of a new API element is borne forever. The bar for adding one is that removing it would make a real workflow impossible to express.

### Maximal flexibility

Where the surface is small, the *expressiveness* of each primitive is large. `z.human()` is one marker that means "this field is human-writable." `.verified()` is one decorator that means "this field is a confirmation point." Both primitives compose with the rest of Zod, so the expressiveness comes from composition, not from a longer surface.

The data structure is the protocol. A consumer who wants a feature that the lib doesn't ship can implement it as a node kind or a transport. The lib provides primitives; the consumer composes them.

## The five load-bearing decisions

1. **The data structure is a flat DAG of typed nodes.** Each node has `kind`, typed `input` and `output` (Zod-validated), `status` (one of seven values — see `.cns/architecture/index.md` for the per-status source of truth), `actor`, and metadata. Edges are explicit. Inputs can be literals, references to upstream outputs, or human-updatable.

2. **Effect is the composition language; the runner is the runtime.** Consumers write Effect programs for each node. The lib walks the DAG, finds ready nodes, plumbs typed inputs in, runs the consumer's Effect, validates the output against the node's Zod schema, writes the result back, and recurses. The lib is a *runtime*, not a *language* — no builder API, no DSL.

3. **Structured outputs are a first-class node property, not a special case.** Every node has a typed output schema. Validation is part of the runner, not a separate step.

4. **Human-in-the-loop is compositional.** A node's input field can be marked human-updatable. The renderer consumer uses the schema to generate a form. Setting a human value triggers subtree re-derivation. Subtree isolation is computed from the DAG topology.

5. **Two render modes.** (a) auto-render the whole graph (for SSR full-page), (b) subscribe to a node and get its subtree (for embedding workflow pieces in chat, wall displays, etc.). Consumers supply a renderer registry — the lib ships zero UI.

## Layer references

The principles are restated and applied in each layer's `index.md`:

- **architecture** carries the data model and the runtime boundary. `principles: [boundary-discipline, type-system-discipline]`.
- **design** carries the encoding conventions: frontmatter field names, prose style, when to add a principle to a node's list. `principles: [laziness-protocol, exhaust-the-design-space, encode-lessons-in-structure]`.
- **product** carries the gap statement, the v1 must-haves, and the modules list. `principles: [minimal-api-surface, experience-first]`.
- **research** carries the related-work table and the open questions that drive `intent.md`. `principles: [encode-lessons-in-structure, exhaust-the-design-space]`.

## Package references (the pre-shard library folder structure)

The library is a pnpm workspace. Each package has its own `index.md` (peripheral nervous system node) with local context for the implementation phase. Pre-shard on 2026-06-06.

**All six packages ship with v1.0.** There is no v1.1+ tier — the v1.0 deliverable is the lib *plus* the way to consume it. A "true v1.0" without a transport and renderers is not a usable v1.0; it's a data structure with a runner. The original product doc's "v1.x / v2 deferred" list had these as v1.1+; that was a misjudgment, corrected on 2026-06-06.

- **packages/core** ([`index.md`](packages/core/index.md)) — `@underwai/core`. The data structure: types, keys, composition, operations. No imports from the other v1 packages.
- **packages/schema** ([`index.md`](packages/schema/index.md)) — `@underwai/schema`. The Zod extension: `z.human()` + `.verified()`. Standalone; depends on Zod only.
- **packages/runner** ([`index.md`](packages/runner/index.md)) — `@underwai/runner`. The runner: `runWorkflow`, `WorkflowRuntime` service, mutation primitives. Depends on `@underwai/core` and `@underwai/schema`.
- **packages/transport** ([`index.md`](packages/transport/index.md)) — `@underwai/transport`. Subscription API (`subscribe`, `subscribeSet`) + wire format (`WorkflowEvent` stream) + transports (SSE, WebSocket). Depends on `@underwai/core`.
- **packages/renderer-react** ([`index.md`](packages/renderer-react/index.md)) — `@underwai/renderer-react`. The reference React adapter: hooks, provider, auto-render. Depends on `@underwai/core` and `@underwai/transport`.
- **packages/renderer-log** ([`index.md`](packages/renderer-log/index.md)) — `@underwai/renderer-log`. The stdout log renderer for tests. Depends on `@underwai/core` and `@underwai/transport`.

The pre-shard `src/stub.ts` was moved to `packages/core/src/stub.ts` on 2026-06-06. Phase 2 distributes the stub's contents across the four `packages/core/src/*` files (keys, types, composition, operations).

## Decisions in scope

The package `index.md` files encode their design decisions in the `decisions[]` frontmatter array. Read that array, not the body prose, to understand *why* each package is shaped the way it is. The body carries the file plan and the boundary; the frontmatter carries the load-bearing decisions.

Each `decisions[]` entry has `id:`, `date:`, `author:`, `summary:`. The IDs are scoped per-package (`DEC-CORE-001` through `DEC-CORE-013`, `DEC-SCHEMA-001` through `DEC-SCHEMA-005`, etc.). Where the same design point touches multiple packages, the decision appears once in the package that owns it; sibling packages cross-reference the design point by name in their `decisions[]` summary, not by ID.

Counts as of 2026-06-06: 13 in core, 5 in schema, 8 in runner, 7 in transport, 6 in renderer-react, 6 in renderer-log. 45 total. Decisions are pruned on reconcile — if the code drifts from a decision, the decision is deleted, not archived.

The five most load-bearing decisions across the workspace (read these first, then the per-package list):

- **DEC-CORE-001** (core) — `Node["status"]` is a discriminated union. Per-status data lives on the variants that own them.
- **DEC-CORE-002** (core) — `ResolvedInput = { value, schema, humanFields }`. Single value, not a per-field bundle.
- **DEC-RUNNER-002** (runner) — Mid-execution `writeHumanInput` interrupts the in-flight Effect fiber via `Fiber.interrupt`. The transition is `running → stale → running`.
- **DEC-TRANSPORT-001** (transport) — Two subscription methods, no flags. `subscribe` is exact-key; `subscribeSet` is wildcard pattern with `*`.
- **DEC-CORE-005** (core) — Path generic on `NodeKey<Path>` is non-negotiable. Combinator signatures thread the path through end-to-end.
