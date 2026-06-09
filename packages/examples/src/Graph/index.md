---
title: "examples/Graph"
type: module
parent: ../../index.md
principles: [experience-first, type-system-discipline, exhaust-the-design-space]
decisions:
  - id: DEC-EXAMPLES-008
    date: 2026-06-08
    author: agent
    summary: '`Graph` is the SVG topology of the workflow DAG. Reads `state.nodes` and `state.edges` and lays them out as a left-to-right graph. Each level is a column; nodes within a level are stacked. The layout fits to its container; on resize the layout recalculates. (TASK-44.)'
  - id: DEC-EXAMPLES-008a
    date: 2026-06-08
    author: agent
    summary: 'Fan-in groups (edges sharing a target with ≥2 incoming edges) are routed along cubic Béziers with vertical offset based on source row. The first source''s edge enters at `y2 = target.y + NODE_H * 0.25`, the second at `y2 = target.y + NODE_H * 0.75`. Single-source edges stay as straight `<line>` elements. (TASK-JF-2, .cns/plans/join-fixes/phase-2-graph-fanin.md.)'
  - id: DEC-EXAMPLES-008b
    date: 2026-06-08
    author: agent
    summary: 'The `<line>` element becomes a `<path>` when the edge is curved. The arrowhead marker (`markerEnd="url(#arrowhead)"`) still works on paths. The path-d output is built by the layout function, not by the renderer — the renderer is a thin projection of the layout.'
  - id: DEC-EXAMPLES-008c
    date: 2026-06-08
    author: agent
    summary: 'Layout algorithm: (1) topological sort by edges (Kahn''s algorithm), (2) for each node, compute its "level" = longest path from any root, (3) within a level, stack nodes vertically with even spacing, (4) position by level (x) and stack index (y). The render-ordering equivalent (topologicalLevels) is shared with `RenderedPanel` via `core/operations`.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/Graph

The SVG topology of the workflow DAG. Reads `state.nodes` and `state.edges` and lays them out as a left-to-right graph. Each level is a column; nodes within a level are stacked.

## What lives here

The source is `Graph.tsx` next to this directory.

- **`Layout`** — the computed layout: array of positioned nodes, array of positioned edges, width, height.
- **`LayoutEdge`** — `{ from, to, x1, y1, x2, y2, path? }`. The `path` field is set when the edge is part of a fan-in (curved); undefined for single-source edges.
- **`Graph({ state, onNodeClick? })`** — the component. Computes the layout via `useMemo` and renders an SVG.

## Fan-in routing

For each target, count incoming edges. If a target has ≥2 incoming edges, route them as cubic Béziers with vertical control points so the two parallel branches don't overlap on the target's left edge. The first source's edge enters at `y2 = target.y + NODE_H * 0.25`, the second at `y2 = target.y + NODE_H * 0.75`. Single-source edges stay as straight `<line>` elements. (TASK-JF-2.)

## Boundary

- Imports from: `react` (peer, `useMemo`), `@underwai/core` (Node, WorkflowState).
- Exports to: `ExampleShell.tsx` (uses `<Graph state={...} onNodeClick={...} />` in the right-top panel).
- **What does NOT live here:** the rendered panel (in `RenderedPanel.tsx`), the event log (in `EventLog.tsx`), the per-demo setup (in `workflows.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
