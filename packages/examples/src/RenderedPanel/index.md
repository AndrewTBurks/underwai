---
title: "examples/RenderedPanel"
type: module
parent: ../../index.md
principles: [experience-first, boundary-discipline, type-system-discipline]
decisions:
  - id: DEC-EXAMPLES-009
    date: 2026-06-08
    author: agent
    summary: '`RenderedPanel` is the left column of the example shell. Renders all intermediate states of the workflow as a vertical list of rows, ordered top to bottom by DAG level (longest path from any root). Siblings at the same level are sorted by node id for stable rendering. (TASK-44.)'
  - id: DEC-EXAMPLES-009a
    date: 2026-06-08
    author: agent
    summary: 'Each row shows: the node''s kind, the node''s path (small, dim), a `<StatusPill>` (pending, running, resolved, paused, failed), and the node''s output if resolved, or "—" if pending. When the workflow is paused on a human-marked node, that node''s row is the form (`<HumanForm>`). The form is the consumer''s input to the workflow — its emphasis is intentional.'
  - id: DEC-EXAMPLES-009b
    date: 2026-06-08
    author: agent
    summary: 'The render order is computed via `topologicalLevels(state)` from `@underwai/core` (DEC-CORE-020). The helper returns a 2-D array: outer index = level, inner = nodes at that level in deterministic order. The panel flattens with a single `flatMap`. (TASK-JF-1, .cns/plans/join-fixes/phase-1-topological-render.md.)'
  - id: DEC-EXAMPLES-009c
    date: 2026-06-08
    author: agent
    summary: "The panel surfaces the workflow's external input at the top: a text field + run button for \"input\" demos, or just a run button for \"none\" demos. The `isPaused` prop hides the input field when the workflow is paused on a human form (the human form is the input then)."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/RenderedPanel

The left column of the example shell. Renders all intermediate states of the workflow as a vertical list of rows, ordered top to bottom by DAG level. For a linear chain this matches the builder's declaration order; for a diamond or join it groups the parallel branches at the same vertical position with their parent above and their join child below.

## What lives here

The source is `RenderedPanel.tsx` next to this directory.

- **`RenderedPanel<PathMap>({ demo, state, input, onInputChange, onRerun, onHumanSubmit, isPaused, scrollToKey, onScrolled })`** — the component. Generic on the typed tree's path map.
- **`useRows(demo, state)`** — internal hook. Computes the rows via `topologicalLevels(state)` from `@underwai/core`. Each row carries the node's key, kind, path, status, and output.
- **`renderRow(demo, row, onHumanSubmit)`** — internal. Renders a single row. If the node is paused on a human-marked field, renders `<HumanForm>` instead of the output span.

## Why topological order

A linear chain's `topologicalLevels` output matches the builder's DFS order, so the panel looks the same as before the change. For the join workflow, the panel reads top-to-bottom as `trigger → fetchAvatar, fetchProfile → validateAvatar, validateProfile → merge → render` — the diamond shape is visible. Without topological ordering, the panel showed `render` at the top and `fetchAvatar` at the bottom (Map insertion order from the builder's DFS). (TASK-JF-1.)

## Boundary

- Imports from: `react` (peer, `useEffect`), `zod` (peer, `ZodTypeAny`), `@underwai/schema` (getHumanMode), `@underwai/core` (topologicalLevels, NodeKey, WorkflowState), `./ExampleShell.js` (Demo type), `./StatusPill.js`, `./HumanForm.js`.
- Exports to: `ExampleShell.tsx` (uses `<RenderedPanel>` in the left column).
- **What does NOT live here:** the human form (in `HumanForm.tsx`), the status pill (in `StatusPill.tsx`), the topological helper (in `@underwai/core/operations`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
