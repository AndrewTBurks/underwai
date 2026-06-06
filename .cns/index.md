---
title: "underwAI"
type: project
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

The structure **is** the state. There is no separate runtime memory. A workflow can be initialized from a definition, serialized to JSON, resumed on another machine, and have a human update a field — and the subtree re-derives.

## The five load-bearing decisions

1. **The data structure is a flat DAG of typed nodes.** Each node has `kind`, typed `input` and `output` (Zod-validated), `status` (pending / ready / running / streaming / resolved / failed / paused), `actor`, and metadata. Edges are explicit. Inputs can be literals, references to upstream outputs, or human-updatable.

2. **Effect is the composition language; the runner is the runtime.** Consumers write Effect programs for each node. The lib walks the DAG, finds ready nodes, plumbs typed inputs in, runs the consumer's Effect, validates the output against the node's Zod schema, writes the result back, and recurses. The lib is a *runtime*, not a *language* — no builder API, no DSL.

3. **Structured outputs are a first-class node property, not a special case.** Every node has a typed output schema. Validation is part of the runner, not a separate step.

4. **Human-in-the-loop is compositional.** A node's input field can be marked human-updatable. The renderer consumer uses the schema to generate a form. Setting a human value triggers subtree re-derivation. Subtree isolation is computed from the DAG topology.

5. **Two render modes.** (a) auto-render the whole graph (for SSR full-page), (b) subscribe to a node and get its subtree (for embedding workflow pieces in chat, wall displays, etc.). Consumers supply a renderer registry — the lib ships zero UI.

## What it replaces

- **langgraph / langchain** — opaque checkpoints become inspectable, typed DAGs.
- **AI SDK `<Tool>` / `<GenerateObject>`** — chat-surface primitives become typed graph positions.
- **"use workflow"** — borrows the replay/determinism vocabulary, but as plain data, not vercel-locked infrastructure.
- **instructor** — structured outputs are integrated at every node, not bolted on.

## Status

Greenfield. v1 spec in progress. See `intent.md` for open design questions.

## Modules

- **core** — the data structure, operations on it, the flat DAG representation
- **schema** — Zod extensions for human-updatable fields, node type registration
- **runner** — the `init()` / `resume()` / `write()` runtime, DAG traversal, Effect integration
- **transport** — subscription API, change-stream protocol, SSR streaming
- **renderers** — reference renderer registry, React adapter (and a "no-op" renderer for testing)
