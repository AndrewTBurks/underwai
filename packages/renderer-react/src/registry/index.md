---
title: "renderer-react/registry"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, minimal-api-surface]
decisions:
  - id: DEC-RR-002
    date: 2026-06-06
    author: agent
    summary: "Renderer registry: kind -> (state, node) -> ReactElement. registerKind / getKindRenderer / clearRegistry. Default renderer is a <pre> with the kind and status."
  - id: DEC-RR-002a
    date: 2026-06-08
    author: agent
    summary: "`registerKind(kind, fn): () => void` returns an unsubscribe function. The registry is a `Map<string, KindRenderer>` at module scope — process-wide. The example app uses `clearRegistry()` between demos so kind registrations from one demo don't leak to the next."
  - id: DEC-RR-002b
    date: 2026-06-08
    author: agent
    summary: "`defaultElement(node)` was removed (TASK-40). The function was dead — `AutoRender` calls `defaultRenderer` directly. The cleanup keeps the public surface to the four used-by-consumers functions: `registerKind`, `getKindRenderer`, `clearRegistry`, `defaultRenderer`."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-react/src/registry

The renderer registry: `kind -> (state, node) -> ReactElement`. Consumers register renderers per kind; `AutoRender` walks the DAG and asks the registry for each node's renderer.

## What lives here

The source is `registry.tsx` next to this directory.

- **`KindRenderer`** — `(state: WorkflowState, node: Node) => ReactElement`.
- **`registerKind(kind, fn): () => void`** — registers a renderer. Returns an unsubscribe function.
- **`getKindRenderer(kind): KindRenderer | undefined`** — looks up a renderer. Returns `undefined` for unknown kinds.
- **`clearRegistry()`** — clears all registrations. Used between demos.
- **`defaultRenderer(state, node)`** — fallback for unknown kinds. Renders a `<pre>` with `${kind} (${status})`.

## Why module-scope

A single `Map` at module scope is the simplest shape. The example app calls `clearRegistry()` between demos to avoid kind-name collisions. The alternative — a context-carried registry — was tried and rejected: `AutoRender` doesn't need the context, and consumers don't use it (TASK-40).

## Boundary

- Imports from: `react` (peer, `createElement`, `ReactElement`, `ReactNode), `@underwai/core` (Node, WorkflowState).
- Exports to: `auto-render.tsx` (calls `getKindRenderer` and `defaultRenderer`), consumer code that registers per-kind renderers.
- **What does NOT live here:** `RegistryContext` and `useRegistry` (removed in TASK-40 — the global registry is the only shape).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
