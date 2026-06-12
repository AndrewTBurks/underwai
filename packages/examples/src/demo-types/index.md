---
title: "examples/demo-types"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline]
decisions:
  - id: DEC-EXAMPLES-012
    date: 2026-06-12
    author: agent
    summary: "Demo and ScenarioKind live in a neutral module instead of ExampleShell. Workflow definitions, rendered panels, and scenario surfaces import metadata types from demo-types, so workflow definitions no longer depend on the shell component. (TASK-50.)"
human_notes: |
status: clean
last_reconciled: 2026-06-12
---

# examples/src/demo-types

Neutral scenario metadata types for the examples package.

## What lives here

The source is `demo-types.ts` in the parent directory.

- `ScenarioKind` — stable scenario identifiers used by miniature target-app renderers.
- `Demo<PathMap>` — the per-demo contract: metadata, built typed tree, setup function, leaf key, input panel shape, and optional runtime concurrency.

## Boundary

- Imports from: `@underwai/core` for `NodeKey`, `TypedTree`, and `WorkflowState` types.
- Exports to: workflow definitions, the shell, rendered panels, and scenario surfaces.
- What does NOT live here: runtime state, React layout, or workflow definitions.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
