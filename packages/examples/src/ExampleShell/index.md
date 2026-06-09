---
title: "examples/ExampleShell"
type: module
parent: ../../index.md
principles: [experience-first, boundary-discipline, type-system-discipline]
decisions:
  - id: DEC-EXAMPLES-007
    date: 2026-06-08
    author: agent
    summary: '`ExampleShell` is the 3-area UI for every example: left = rendered UI (consumer view + human form), right top = graph topology, right bottom = event log. One shell, one runtime, one subscription. The shell takes a `Demo` object (built tree + setup + display metadata) and drives the workflow through Effect. Runs are user-initiated only — switching demos or mounting does not auto-run. (TASK-44.)'
  - id: DEC-EXAMPLES-004
    date: 2026-06-08
    author: agent
    summary: '`Demo` type carries an optional `maxConcurrent?: number` that propagates from `ExampleShell` to `WorkflowRuntime.run`. The join demo opts in to `maxConcurrent: 4`; the others default to 1 (sequential, original behavior). The runtime respects the value as a hard cap on parallel in-flight fibers (DEC-RUNNER-010). (TASK-JF-4, .cns/plans/join-fixes/.)'
  - id: DEC-EXAMPLES-007a
    date: 2026-06-08
    author: agent
    summary: 'When the runtime pauses on a human-marked node, the panel surfaces a form generated from the node''s schema. The form is the consumer''s input to the workflow — its emphasis is intentional. The shell wires `rt.writeHumanInput` to the form''s submit handler.'
  - id: DEC-EXAMPLES-007b
    date: 2026-06-08
    author: agent
    summary: '`Demo` is generic on the typed tree''s path map (`PathMap extends Record<string, unknown>`) so the `view()` call site narrows the leaf''s output type. The shell''s render uses `view(state, leafKey)` to read the leaf with the declared output type.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/ExampleShell

The 3-area UI for every example. The shell takes a `Demo` object (built tree + setup + display metadata) and drives the workflow through Effect. Runs are user-initiated only.

## What lives here

The source is `ExampleShell.tsx` next to this directory.

- **`Demo<PathMap>`** — the per-demo metadata: `{ id, title, description, built, setup, leafKey, panel, maxConcurrent? }`. Generic on the typed tree's path map so `view()` narrows the leaf's output type.
- **`ExampleShell<PathMap>({ demo, onSelectDemo?, demoIdx? })`** — the shell component. Holds `state`, `events`, `scrollToKey`, `input` as React state. Renders the rendered panel, graph, event log, and a "Run" button.

## Three areas

- **Left** — the rendered UI (consumer view + human form). Reads from `state` via the panel hooks.
- **Right top** — the graph topology (`<Graph state={...} />`).
- **Right bottom** — the event log (`<EventLog events={...} lastEvent={...} />`).

The shell drives `rt.run({ state, maxConcurrent: demo.maxConcurrent, liveRegistry })` on click of "Run." On every state change, the shell calls `capture()` to diff the new state against the previous one and appends the resulting events.

## Boundary

- Imports from: `react` (peer), `effect` (peer, for `Effect.gen`), `@underwai/core` (NodeKey, TypedTree, WorkflowState), `@underwai/runner` (WorkflowRuntime, WorkflowRuntimeLive), `@underwai/transport` (WorkflowEvent), `./Graph.js`, `./EventLog.js`, `./RenderedPanel.js`, `./StatusPill.js`, `./workflows.js`.
- Exports to: the example app's `main.tsx` (mounts the shell), the test suite (`workflows.test.ts` exercises the demos through the shell).
- **What does NOT live here:** the graph layout (in `Graph.tsx`), the event log (in `EventLog.tsx`), the rendered panel (in `RenderedPanel.tsx`), the per-demo setup (in `workflows.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
