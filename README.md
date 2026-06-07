# underwAI

A typed, durable data structure where AI, humans, and effects resolve nodes into values. A portable workflow runtime built on Effect's composition primitives.

> **Status:** v1 design phase. The data structure and runtime contracts are settled (see [`docs/design.md`](./docs/design.md) and [`.cns/architecture/`](./.cns/architecture/index.md)). Implementation begins in Phase 2.

## Packages

This is a pnpm workspace. The pre-shard package structure is in [`packages/`](./packages/). Each package has its own `index.md` for local context during implementation.

| Package                                                  | Status | Purpose                                                                   |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| [`@underwai/core`](./packages/core/)                     | v1.0   | Data structure: types, keys, composition, operations                      |
| [`@underwai/schema`](./packages/schema/)                 | v1.0   | `z.human()` + `.verified()` Zod extension                                 |
| [`@underwai/runner`](./packages/runner/)                 | v1.0   | The runner: `runWorkflow`, `WorkflowRuntime` service, mutation primitives |
| [`@underwai/transport`](./packages/transport/)           | v1.0   | Subscription API + wire format + transports (SSE, WebSocket)              |
| [`@underwai/renderer-react`](./packages/renderer-react/) | v1.0   | Reference React adapter                                                   |
| [`@underwai/renderer-log`](./packages/renderer-log/)     | v1.0   | stdout log renderer for tests                                             |

**All six packages ship with v1.0.** A "true v1.0" is the lib _plus_ the way to consume it — without a transport and renderers, it's a data structure with a runner, not a usable v1.0. There is no v1.1+ tier.

## The five load-bearing decisions

1. **The data structure is a flat DAG of typed nodes.** Each node has a typed input and output (Zod-validated), a status, an actor, and metadata. Edges are explicit.
2. **Effect is the composition language; the runner is the runtime.** Consumers write Effect programs for each node. The lib walks the DAG, finds ready nodes, plumbs typed inputs in, runs the consumer's Effect, validates the output, writes the result back, and recurses.
3. **Structured outputs are a first-class node property, not a special case.** Every node has a typed output schema. Validation is part of the runner.
4. **Human-in-the-loop is compositional.** A node's input field can be marked human-updatable. Setting a human value triggers subtree re-derivation.
5. **Two render modes.** (a) auto-render the whole graph (for SSR full-page), (b) subscribe to a node and get its subtree (for embedding workflow pieces in chat, wall displays, etc.).

## Project principles

Two principles govern every decision in this project:

- **Minimal API surface.** The lib's surface is the smallest set of primitives that supports the workflow model. Eight states. Four combinators. Two subscription methods.
- **Maximal flexibility.** Where the surface is small, the _expressiveness_ of each primitive is large. `z.human()` is one marker; `.verified()` is one decorator. The data structure is the protocol.

## Repo

- `github.com/AndrewTBurks/underwai`
- Org: `underwai` (for `@underwai/core`, `@underwai/renderer-react`, etc.)
- License: Apache-2.0
- The placeholder unscoped `underwai` package on npm redirects to `@underwai/core`.

## Docs

- [`docs/design.md`](./docs/design.md) — the v1 source of truth
- [`.cns/architecture/`](./.cns/architecture/index.md) — the data model, statuses, runtime
- [`.cns/product/`](./.cns/product/index.md) — the gap statement, v1 must-haves, modules list
- [`.cns/design/`](./.cns/design/index.md) — naming, license, the renderer protocol's posture
- [`.cns/research/`](./.cns/research/index.md) — related work, open questions
- [`.cns/intent.md`](./.cns/intent.md) — Phase 1 (design) and Phase 2 (implementation) plans
