---
title: "Product"
type: module
parent: ../index.md
principles: [minimal-api-surface, experience-first]
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# Product
## Principles in this layer

**Minimal API surface.** The v1 must-haves list is bounded: eight items, each a primitive. The deferred list is explicit so consumers know what is *not* shipping. The anti-goals list is a fence: agent frameworks, workflow designers, hosted services, and DSLs are not underwAI's territory.

**Experience first.** The success-and-failure statements frame outcomes, not implementations. "A second consumer builds something on underwAI without the lib needing to change" is an experience. "The lib grows a builder API to hide Effect from consumers" is the failure that experience-first rejects.

## What underwAI is

A library that lets a developer define a workflow as a flat, typed DAG. The lib executes the workflow by walking the DAG, running consumer-supplied Effect programs at each node, validating the typed outputs, and writing them back to the same data structure. The data structure is the source of truth; it can be serialized, persisted, resumed, and rendered.

## What we replace

- **langgraph / langchain** — opaque checkpoints become inspectable, typed DAGs.
- **AI SDK `<Tool>` / `<GenerateObject>`** — chat-surface primitives become typed graph positions.
- **"use workflow"** — borrows the replay/determinism vocabulary, but as plain data, not vercel-locked infrastructure.
- **instructor** — structured outputs are integrated at every node, not bolted on.

The AI's role is to *resolve a typed position in a graph* — fill a node with a value of a declared type. The human's role is the same. The effect's role is the same. The lib does not care who or what filled the node, only that the value matches the schema.

## The gap it fills

- **AI SDK** gives you a chat surface with tool calls. Generative UIs are rendered via a switch statement over message parts.
- **langgraph** gives you a Python orchestrator with opaque checkpoints. The data structure exists but is not the interface.
- **instructor** gives you structured outputs from LLMs, bolted onto an existing chat surface.
- **"use workflow"** gives you resumable workflows, but the runtime is vercel-locked.
- **Effect** is a runtime, not a workflow library.

UnderwAI fuses these: typed outputs at every node, Effect composition, durable data structure as the single source of truth, human-in-the-loop as a compositional primitive, renderers as a thin subscription layer. None of the existing libs has this shape.

## v1 must-haves

The non-negotiable surface for v1:

1. **Flat typed DAG data structure** — `WorkflowState` with `Node[]` and `Edge[]`, JSON-serializable.
2. **Zod-validated typed inputs and outputs** at every node.
3. **Effect program as the node's behavior.** Plain Effect, no wrapper.
4. **Runner** — `init()`, `resume(data)`, `write()`, `writeHumanInput()`, `findReadyNodes()`, `findSubtree()`.
5. **Human-in-the-loop** — `z.humanUpdatable()` schema wrapper, subtree re-derivation.
6. **Subscription API** — subscribe to a node, get the subtree as a typed value.
7. **Reference renderer** — React adapter + no-op renderer for testing.
8. **Persistence** — `serialize()` / `deserialize()` round-trip.

## v1.x / v2 deferred

- Multi-host transport (SSE, WebSocket) — v1.1, requires the transport story to be settled.
- Field-level streaming resolution — interesting for form-fill UIs, adds complexity.
- AI SDK provider — the lib should be model-agnostic; integration via a thin adapter that wraps `@ai-sdk/*` as an Effect program.
- Effect-mitigation (a "plain async" mode for consumers who don't want to learn Effect) — punted. The whole pitch is Effect.
- Visual debugger / timeline UI — nice-to-have, defer.
- Cross-platform effects (Vercel, Cloudflare, etc.) — v2+; portability is a property of the data structure, not the runtime.

## The threadweaver relationship (note, not in scope)

Andrew is building ThreadWeaver (separate project at `~/Documents/thesis-project`) — a research instrument for studying AI co-authorship in scientific workflows. ThreadWeaver's product doc describes *exactly* the data structure underwAI is designed to be: a typed workflow graph, two render surfaces (client + wall), human-in-the-loop, durable provenance. The decision is to build underwAI as a *general* library that can be slotted underneath ThreadWeaver, not as a domain-specific tool. Andrew is the domain expert on ThreadWeaver and explicitly does not want underwAI constrained by it.

This means: v1 of underwAI is whatever ThreadWeaver would *want* from a lib, generalized. The killer demo for v1 is "ThreadWeaver runs on top of this." The killer demo for v1.1+ is "a different consumer runs on top of this, and the lib doesn't have to change."

## Success looks like

- A second consumer (not Andrew) builds something on underwAI without the lib needing to change.
- The data structure is small enough to fit in your head and JSON-serializable.
- The renderer protocol is thin enough that consumers supply their own UI in a weekend.
- The runner is boring — it just walks a DAG and runs Effect programs. The interesting parts are the *primitives it composes*, not the runner itself.

## Failure looks like

- The lib grows a builder API to hide Effect from consumers, and then reimplements Effect badly.
- The data structure is so generic that it becomes a graph database with extra steps.
- The renderer protocol is so opinionated that consumers can't ship their own UI without a wrapper.
- The runner becomes an "agent runtime" with tool calls, planning, and memory — the lib is no longer about a typed graph, it's about an agent.

## Anti-goals

- Not a general-purpose agent framework. Do not add "agent" concepts (memory, planning, tool use, reflection) as first-class. The AI is a *resolver*, not an *agent*.
- Not a workflow designer / visual editor. The lib is a runtime; the consumer's authoring experience is their Effect code.
- Not a hosted service. UnderwAI is a library. Hosting, observability, and dashboards are separate concerns.
- Not a DSL. Effect is the language. The lib is the runtime.

## Packages (planned)

The library is a pnpm workspace. The 6-package split was pre-shard on 2026-06-06 (see [`.cns/index.md`](../../.cns/index.md) § "Package references" for the full structure). Each package has its own `index.md` (peripheral nervous system node) with local context for the implementation phase.

| Package | Status | Depends on | Purpose |
|---|---|---|---|
| `@underwai/core` | v1 | zod, effect (peer) | Data structure: types, keys, composition, operations. The foundation. |
| `@underwai/schema` | v1 | zod (peer) | Zod extension: `z.human()` + `.verified()`. Standalone. |
| `@underwai/runner` | v1 | `@underwai/core`, `@underwai/schema`, zod, effect | The runner: `runWorkflow`, `WorkflowRuntime` service, mutation primitives. |
| `@underwai/transport` | v1.1+ | `@underwai/core` (planned) | Subscription API and wire format (`WorkflowEvent` stream). |
| `@underwai/renderer-react` | v1.1+ | `@underwai/core`, `@underwai/transport` (planned), react (peer) | Reference React adapter. |
| `@underwai/renderer-log` | v1.1+ | `@underwai/core`, `@underwai/transport` (planned) | stdout log renderer for tests. |

The original 5-module list (core, schema, runner, transport, renderers) is split into 6 packages because the two reference renderers ship as separate npm packages under the `@underwai/renderer-*` scope, with their own version lines and own peer-dependency contracts. The v1.1+ packages have only `index.md` on disk; no `package.json` or `src/` until v1.1 work begins.
