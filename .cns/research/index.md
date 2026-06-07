---
title: "Research"
type: module
parent: ../index.md
principles: [encode-lessons-in-structure, exhaust-the-design-space]
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# Research

## Principles in this layer

**Encode lessons in structure.** The "Open questions" section is the source of `intent.md` tasks. When a question is resolved by a design conversation or an arena, the question moves out of this doc and the resolution moves into the architecture or design doc. The research doc holds _unresolved_ questions, not resolved history.

**Exhaust the design space.** When prior art suggests a shape, the "What underwAI takes / What underwAI rejects" split is a deliberate boundary. The rejection column is not "we don't know" — it is a positive decision made after looking at the alternative.

Background, related work, and the questions we still need to answer.

## The space

UnderwAI sits in the intersection of: typed LLM outputs, durable execution, DAG-based workflow systems, and structured-data-as-state. The closest prior art and our relationship to it:

| Library                        | What it does                                               | What underwAI takes                                       | What underwAI rejects                                                |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| **AI SDK** (`ai`, `@ai-sdk/*`) | Chat surface with tool calls and structured outputs        | The "structured outputs" model; provider ecosystem        | The chat-as-primary-interface framing                                |
| **langgraph**                  | Python orchestrator with stateful nodes and edges          | The DAG-of-nodes mental model; the "checkpoint" concept   | The Python lock-in; the opaque-checkpoint data model                 |
| **instructor**                 | Structured outputs from LLMs, via Pydantic / Zod           | The Zod-as-schema choice for node I/O                     | Bolting onto a chat surface; the "validate the model output" framing |
| **"use workflow"** (Vercel)    | Resumable workflows, time-travel debugging                 | The determinism/replay vocabulary; the resumability story | The vercel-locked runtime; the JSX-as-workflow framing               |
| **Effect**                     | A runtime for typed async programs with composable failure | The whole composition layer                               | None — Effect is the lib's substrate                                 |
| **Zod**                        | TypeScript-first schema validation                         | The schema-as-type model for node I/O                     | None                                                                 |

## Open questions

These are the questions that shape the v1 API. They live in `intent.md` as concrete tasks.

### Persistence

How is the workflow _definition_ (the consumer's Effect programs) bound to the workflow _state_ (the JSON-serializable DAG)? The lib can be portable across machines; the definition is the consumer's code and ships with the consumer's app. Resume is `init(definition) + deserialize(state) + findReadyNodes`. Is the definition versioned with the state, or is version-compatibility a consumer concern?

### Multi-parent reduce

A node with parents [A, B] is ready when both resolve; the lib gathers `{aField: A.output, bField: B.output}` and the consumer's Effect program receives that. But: does the consumer's program receive _both_ as separate fields, or is there a `reduce` step that combines them into one input? My recommendation: implicit — the lib's input resolution is the reduce. But a "race" semantic (either parent is enough) might also be needed; that's an `effect: all | any` on the node.

### Transport

What is the wire protocol between the runner and the renderers? Options: (a) in-process pub/sub, (b) SSE, (c) WebSocket, (d) a custom change-stream. Affects the SSR story (React Server Components + streaming), the wall-display story (long-lived WebSocket), and the chat-embedded story (in-process subscription).

### Schema ergonomics

The `z.humanUpdatable(z.string())` wrapper is one possible shape. Alternatives: `.describe('human-updatable')`, a separate `humanFields: string[]` array on the node, or a runtime flag. The choice affects how consumers write forms, how renderers introspect schemas, and how the lib serializes the "this is a human input" marker.

### Effect buy-in

The lib is defined in Effect, but is the consumer's _defining_ a workflow an Effect program too, or is it a plain TypeScript object that the lib translates into Effect internally? Affects the lib's surface: if the consumer writes Effect, the lib is a thin runtime; if the consumer writes plain TS, the lib is also a compiler.

### Streaming

Three options for what a node's output looks like as it streams: (a) final value only, no streaming; (b) accumulator + final; (c) field-level resolution. Recommendation: (b) — accumulator + final, with a `publish(value)` effect the consumer calls to update the partial. (c) is interesting for form-fill UIs but adds complexity; defer.

### Type system mechanics

"the type system IS the composition" — concretely, how do consumers define the relationship between a node's input and output types? Options: (a) Zod schema on each node, lib infers types; (b) explicit `Workflow<{Input, Output}>` generic; (c) consumer writes Effect program with `Effect<Output, Error, Requirements>`, lib uses the inferred type. The answer changes whether a consumer needs to learn Effect deeply to use the lib.

### Long-running workflows

How does a workflow survive a deploy, a machine restart, a year of inactivity? The state is JSON; the _runtime_ (the Effect programs waiting to be triggered) is not. Resume is `init(definition) + deserialize(state) + findReadyNodes`. But: are Effect programs `idempotent`? Are there any non-deterministic side effects in the consumer's program? "use workflow" has opinions about this; we should too.

## Things to read

- **"use workflow"** (Vercel) — for the replay/determinism vocabulary, even if the platform lock-in is rejected.
- **Effect docs on `Layer` and `Context`** — for how to give a consumer's program access to runtime services (model client, DB connection, etc.) without coupling the workflow definition to the runtime.
- **AI SDK's `generateObject` and `streamObject`** — for how structured outputs are produced and consumed in a streaming context. UnderwAI's lib doesn't depend on AI SDK, but the ergonomics of structured outputs are battle-tested there.
- **langgraph's checkpointing internals** — for the failure modes of opaque checkpoints. The point of underwAI is that the checkpoint is the data, not a serialization format.
- **Ink & Switch's "local-first software" essays** — for the broader philosophy of "the data structure is the source of truth, the network is the transport, the local copy is the working copy." UnderwAI's portability story rhymes with local-first.
