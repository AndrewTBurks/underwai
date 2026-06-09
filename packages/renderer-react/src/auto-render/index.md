---
title: "renderer-react/auto-render"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
decisions:
  - id: DEC-RR-003
    date: 2026-06-06
    author: agent
    summary: 'AutoRender walks the DAG (state.nodes) and calls the registered renderer for each node. Unknown kinds render the defaultRenderer. The result is a single <div data-auto-render="true"> with one child per node.'
  - id: DEC-RR-003a
    date: 2026-06-08
    author: agent
    summary: "`AutoRender({ state })` iterates `state.nodes` (a `Map<NodeKey, Node>`) and calls `getKindRenderer(node.kind) ?? defaultRenderer` for each. The result is wrapped in a single `<div data-auto-render=\"true\">` with one child per node. Insertion order is Map iteration order (which is the composition's DFS order for a fresh state). The example panel wraps AutoRender in a topological-order layout for the diamond workflow."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-react/src/auto-render

`<AutoRender state={...} />` walks the DAG and renders each node via the registered kind renderer. Unknown kinds render `defaultRenderer`.

## What lives here

The source is `auto-render.tsx` next to this directory.

- **`AutoRender`** — `({ state }: { state: WorkflowState }): ReactElement`. The component. Walks `state.nodes`, calls `getKindRenderer(node.kind) ?? defaultRenderer` for each, returns a `<div data-auto-render="true">` with the rendered children.

## Why a single component

AutoRender is the simplest possible renderer: walk the state, ask the registry, render. The example app uses it for the wall-display demo (where the consumer doesn't write a custom kind renderer) and as a reference for consumers building their own. For finer control — manual composition of `<useNode>` / `<useSubtree>` reads — consumers skip `AutoRender` and use the hooks directly.

## Boundary

- Imports from: `react` (peer, `createElement`, `ReactElement`), `@underwai/core` (WorkflowState), `./registry.js` (defaultRenderer, getKindRenderer).
- Exports to: consumer code that wants a one-line renderer, the example app's `ExampleShell`.
- **What does NOT live here:** the kind registry (in `registry.tsx`), the provider (in `provider.tsx`), the hooks (in `hooks.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
