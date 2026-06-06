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
