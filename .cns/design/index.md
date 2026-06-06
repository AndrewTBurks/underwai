---
title: "Design"
type: module
parent: ../index.md
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# Design

Conventions, naming, and design language for underwAI.

## Name

`underwAI` (lowercase, capital "AI" at the end). The "way" is the workflow; the "AI" caps out at the top as the resolver. The lib's name is one word, not separated: `underwai` on npm and GitHub, `underwAI` in prose and the brand. NPM and GitHub treat names as case-insensitive; the capital-AI version is the display name and the brand identity.

Pronunciation: "under-way" with the AI emphasized. Reads naturally in conversation: "an underwAI workflow," "the underwAI graph."

Repo: `github.com/AndrewTBurks/underwai`. Org: `underwai` (for `@underwai/core`, `@underwai/renderer-react`, etc. once sub-packages exist).

## License

**Apache-2.0.** Rationale:

- Adoption matters more than copyleft. The moat is the data structure, the Effect integration, the renderer protocol, and the integrations — not the code. Apache-2.0 maximizes adoption.
- Patent grant matters for AI libs. Apache-2.0 includes an explicit patent grant from contributors and a patent retaliation clause. For a lib that composes LLM outputs into typed positions, this is non-trivial protection for users.
- MIT is fine too; Apache-2.0 is the more "I take this seriously as infrastructure" choice.

A placeholder unscoped `underwai` package will be published to reserve the name, with a redirect message pointing to `@underwai/core`. The placeholder is the real lib's first published artifact.

## Effect as the composition language

**Decision: Effect is the runtime, but the consumer-facing API is plain Effect. No builder, no DSL, no wrapper.**

Rationale:

- The pitch is "Effect's composition primitives as the workflow language." A builder that papers over Effect is admitting Effect is too much and re-creating it badly.
- Effect's combinators are the API surface. Consumers learn them once and use them everywhere.
- The lib's job is narrow: data structure + runtime + transport. Composition is Effect's job.

The lib is a *runtime for Effect programs*, not a *language that produces Effect programs*. The distinction matters: it means consumers can use `Effect.withSpan` for logging, `Effect.retry` for resilience, `Effect.race` for competing strategies, `Effect.all` for parallel — all of Effect's power, none of it reinvented.

## The renderer protocol's posture

The lib ships zero UI. The consumer supplies a renderer registry mapping `kind` → `(node, children) => UIElement`. The lib provides:

- the subscription API (subscribe to a node, get its subtree as a typed value)
- the protocol (what does a renderer receive? what can it emit back?)
- reference renderers (a "no-op" renderer for testing, a React adapter, a "log" renderer that prints to stdout)

Reference renderers are convenience, not opinion. The lib does not encode any UI assumptions. A consumer could write a renderer that emits PDF, or audio, or a circuit-board layout.

## What we are *not*

- Not an agent framework. The AI is a *resolver of typed positions in a graph*, not an "agent" in a loop with tools.
- Not a chat surface. The output is a typed DAG that renders, not a transcript.
- Not a prompt-template engine. The consumer writes Effect programs; the lib does not have a "prompt" concept beyond the LLM call inside an Effect program.
- Not tied to a specific LLM. The lib has no opinion about which model produced the value. Any effect — model call, human edit, computation, external API — can fill a node.

## Anti-references

These libraries' *visual languages* and *data models* are explicitly rejected:

- **langchain / langgraph** — generic AI orchestration. Their "agent run" and "chain" terminology is not used. We have a single metaphor: the underwAI graph.
- **AI SDK `<Tool>` / `<GenerateObject>`** — chat-surface primitives. Underlying capabilities (model calls, structured outputs) are reachable via plain Effect programs.
- **"use workflow"** — borrows the replay/determinism vocabulary, but as plain data, not vercel-locked infrastructure. We do not integrate with it.
- **jupyter notebooks** — the cell metaphor, the "run all" mental model, the linear document. UnderwAI's primary affordance — concurrent DAG execution with human-in-the-loop — is the explicit alternative.
- **figma's canvas** — consumer-grade, playful, sticker-panel aesthetic. UnderwAI is a precision tool, not a creative jam whiteboard.

## Visual identity (TBD)

Deferred. The lib ships no UI; the brand identity lives in prose, the README, and a wordmark. The wordmark is one word in a clean sans-serif with the "AI" typeset to suggest a different weight or color than the "underw" — the structure is uniform, the resolver is distinct.
