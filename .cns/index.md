---
title: "underwAI"
type: project
principles: [minimal-api-surface, maximal-flexibility]
links:
  - id: architecture
    path: .cns/architecture/index.md
  - id: architecture-node
    path: .cns/architecture/node.md
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
  - id: examples
    path: packages/examples/index.md
  - id: core-keys
    path: packages/core/src/keys/index.md
  - id: core-types
    path: packages/core/src/types/index.md
  - id: core-composition
    path: packages/core/src/composition/index.md
  - id: core-operations
    path: packages/core/src/operations/index.md
  - id: core-live
    path: packages/core/src/live/index.md
  - id: schema-human
    path: packages/schema/src/human/index.md
  - id: runner-runtime
    path: packages/runner/src/runtime/index.md
  - id: runner-mutations
    path: packages/runner/src/mutations/index.md
  - id: transport-subscribe
    path: packages/transport/src/subscribe/index.md
  - id: transport-event-stream
    path: packages/transport/src/event-stream/index.md
  - id: transport-sse
    path: packages/transport/src/transports/sse/index.md
  - id: transport-ws
    path: packages/transport/src/transports/ws/index.md
  - id: rr-provider
    path: packages/renderer-react/src/provider/index.md
  - id: rr-hooks
    path: packages/renderer-react/src/hooks/index.md
  - id: rr-registry
    path: packages/renderer-react/src/registry/index.md
  - id: rr-auto-render
    path: packages/renderer-react/src/auto-render/index.md
  - id: rl-registry
    path: packages/renderer-log/src/registry/index.md
  - id: rl-runner
    path: packages/renderer-log/src/runner/index.md
  - id: ex-EventLog
    path: packages/examples/src/EventLog/index.md
  - id: ex-ExampleShell
    path: packages/examples/src/ExampleShell/index.md
  - id: ex-Graph
    path: packages/examples/src/Graph/index.md
  - id: ex-RenderedPanel
    path: packages/examples/src/RenderedPanel/index.md
  - id: ex-HumanForm
    path: packages/examples/src/HumanForm/index.md
  - id: ex-workflows
    path: packages/examples/src/workflows/index.md
human_notes: |

status: clean
last_reconciled: 2026-06-11
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

Where the surface is small, the _expressiveness_ of each primitive is large. `z.human()` is one marker that means "this field is human-writable." `.verified()` is one decorator that means "this field is a confirmation point." Both primitives compose with the rest of Zod, so the expressiveness comes from composition, not from a longer surface.

The data structure is the protocol. A consumer who wants a feature that the lib doesn't ship can implement it as a node kind or a transport. The lib provides primitives; the consumer composes them.

## The five load-bearing decisions

1. **The data structure is a flat DAG of typed nodes.** Each node has `kind`, typed `input` and `output` (Zod-validated), `status` (one of seven values — see `.cns/architecture/index.md` for the per-status source of truth), `actor`, and metadata. Edges are explicit. Inputs can be literals, references to upstream outputs, or human-updatable.

2. **Effect is the composition language; the runner is the runtime.** Consumers write Effect programs for each node. The lib walks the DAG, finds ready nodes, plumbs typed inputs in, runs the consumer's Effect, validates the output against the node's Zod schema, writes the result back, and recurses. The lib is a _runtime_, not a _language_ — no builder API, no DSL.

3. **Structured outputs are a first-class node property, not a special case.** Every node has a typed output schema. Validation is part of the runner, not a separate step.

4. **Human-in-the-loop is compositional.** A node's input field can be marked human-updatable. The renderer consumer uses the schema to generate a form. Setting a human value triggers subtree re-derivation. Subtree isolation is computed from the DAG topology.

5. **Two render modes.** (a) auto-render the whole graph (for SSR full-page), (b) subscribe to a node and get its subtree (for embedding workflow pieces in chat, wall displays, etc.). Consumers supply a renderer registry — the lib ships zero UI.

## Layer references

The principles are restated and applied in each layer's `index.md`:

- **architecture** carries the data model and the runtime boundary. `principles: [boundary-discipline, type-system-discipline]`.
- **design** carries the encoding conventions: frontmatter field names, prose style, when to add a principle to a node's list. `principles: [laziness-protocol, exhaust-the-design-space, encode-lessons-in-structure]`.
- **product** carries the gap statement, the v1 must-haves, and the modules list. `principles: [minimal-api-surface, experience-first]`.
- **research** carries the related-work table and the open questions that drive `intent.md`. `principles: [encode-lessons-in-structure, exhaust-the-design-space]`.

## Package references

The library is a pnpm workspace. Each package has its own `index.md` peripheral nervous system node, and larger packages have module-level nodes under `src/*/index.md`. The completed Phase 1, Phase 2, audit-closing, and join-fix items from `intent.md` are sharded into those package and module nodes.

**The v1 workspace includes the library, transports, renderers, and examples.** The examples package is now the consumer-validation surface, not scratch code.

- **packages/core** ([`index.md`](packages/core/index.md)) — `@underwai/core`. The data structure and composition layer: keys, types, composition, operations, and the small live registry. Core is value-shaped; the runner is the mutator. Submodules: [`keys`](packages/core/src/keys/index.md), [`types`](packages/core/src/types/index.md), [`composition`](packages/core/src/composition/index.md), [`operations`](packages/core/src/operations/index.md), [`live`](packages/core/src/live/index.md).
- **packages/schema** ([`index.md`](packages/schema/index.md)) — `@underwai/schema`. The Zod marker package: named `human()`, `HumanSchema`, `.verified()`, and `getHumanMode`. Submodule: [`human`](packages/schema/src/human/index.md).
- **packages/runner** ([`index.md`](packages/runner/index.md)) — `@underwai/runner`. The Effect runtime: `WorkflowRuntime`, `WorkflowRuntimeLive`, `RunOptions`, event-driven dispatch, and pure transition helpers. Submodules: [`runtime`](packages/runner/src/runtime/index.md), [`mutations`](packages/runner/src/mutations/index.md).
- **packages/transport** ([`index.md`](packages/transport/index.md)) — `@underwai/transport`. Pattern subscriptions plus the `WorkflowEvent` wire format and SSE/WebSocket transports. Submodules: [`subscribe`](packages/transport/src/subscribe/index.md), [`event-stream`](packages/transport/src/event-stream/index.md), [`sse`](packages/transport/src/transports/sse/index.md), [`ws`](packages/transport/src/transports/ws/index.md).
- **packages/renderer-react** ([`index.md`](packages/renderer-react/index.md)) — `@underwai/renderer-react`. React provider, hooks, renderer registry, and auto-renderer over `LiveSubscriptionRegistry`. Submodules: [`provider`](packages/renderer-react/src/provider/index.md), [`hooks`](packages/renderer-react/src/hooks/index.md), [`registry`](packages/renderer-react/src/registry/index.md), [`auto-render`](packages/renderer-react/src/auto-render/index.md).
- **packages/renderer-log** ([`index.md`](packages/renderer-log/index.md)) — `@underwai/renderer-log`. Stdout renderer and kind-to-text registry. Submodules: [`registry`](packages/renderer-log/src/registry/index.md), [`runner`](packages/renderer-log/src/runner/index.md).
- **packages/examples** ([`index.md`](packages/examples/index.md)) — `@underwai/examples`. The deployable consumer examples: linear-pipeline, human-in-the-loop, join, streaming, and wall-display. Submodules: [`workflows`](packages/examples/src/workflows/index.md), [`ExampleShell`](packages/examples/src/ExampleShell/index.md), [`RenderedPanel`](packages/examples/src/RenderedPanel/index.md), [`Graph`](packages/examples/src/Graph/index.md), [`EventLog`](packages/examples/src/EventLog/index.md), [`HumanForm`](packages/examples/src/HumanForm/index.md).

## Decisions in scope

The package `index.md` files encode load-bearing decisions in `decisions[]`. Module-specific mechanics live in the linked module-level nodes. The body prose is only an entry point and boundary map.

Decision counts change as reconcile prunes stale decisions and adds new ones. Read the current frontmatter instead of relying on historical counts.

The current load-bearing decisions across the workspace are:

- **DEC-CORE-001** — node status is a discriminated union, with per-status data on the variants that own it.
- **DEC-CORE-002** — `ResolvedInput = { value, schema, humanFields }`, not a per-field bundle.
- **DEC-CORE-003 / DEC-RUNNER-007** — edges carry optional bridge functions, and runtime input resolution applies those bridges.
- **DEC-CORE-018** — core has no public mutation primitives; the runner is the only mutator.
- **DEC-RUNNER-010** — runtime dispatch is event-driven and bounded by `maxConcurrent`.
- **DEC-TRANSPORT-001 / DEC-TRANSPORT-007** — subscriptions expose `subscribe` and `subscribeSet` with exact-key, `prefix.*`, `prefix.`, and bare `*` patterns.
- **DEC-TRANSPORT-009** — `WorkflowEvent` is the JSON wire format for SSE and WebSocket transports.
