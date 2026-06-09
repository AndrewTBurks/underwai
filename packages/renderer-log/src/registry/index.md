---
title: "renderer-log/registry"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, minimal-api-surface]
decisions:
  - id: DEC-RL-001
    date: 2026-06-07
    author: agent
    summary: "The kind -> text registry: kind -> (node, indent) -> string. registerKind / getKindRenderer / clearRegistry. Default renderer prints '<indent><kind> (<status>)'."
  - id: DEC-RL-001a
    date: 2026-06-08
    author: agent
    summary: "Module-scope `Map<string, KindTextRenderer>`. `registerKind(kind, fn): () => void` returns an unsubscribe function. `defaultRenderer(node, indent)` is the fallback for unknown kinds. `clearRegistry()` is used between tests."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-log/src/registry

The kind → text registry. Each renderer takes a `Node` and an indent level and returns a string. The default renderer prints `"<indent><kind> (<status>)"`.

## What lives here

The source is `registry.ts` next to this directory.

- **`KindTextRenderer`** — `(node: Node, indent: number) => string`.
- **`registerKind(kind, fn): () => void`** — registers a text renderer.
- **`getKindRenderer(kind): KindTextRenderer | undefined`** — looks up a renderer.
- **`clearRegistry()`** — clears all registrations.
- **`defaultRenderer(node, indent)`** — fallback for unknown kinds.

## Why module-scope

Same as `renderer-react/registry`: a single `Map` at module scope is the simplest shape. Tests call `clearRegistry()` between cases.

## Boundary

- Imports from: `@underwai/core` (Node type).
- Exports to: `runner.ts` (the log renderer's main loop calls `getKindRenderer` and `defaultRenderer`).
- **What does NOT live here:** the log renderer's main loop (in `runner.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
