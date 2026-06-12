---
title: "examples/useDemoRuntime"
type: module
parent: ../../index.md
principles: [boundary-discipline, experience-first]
decisions:
  - id: DEC-EXAMPLES-013
    date: 2026-06-12
    author: agent
    summary: "Runtime state moved out of ExampleShell into useDemoRuntime. The hook owns WorkflowRuntimeLive creation, subscription, state/event capture, root input writes, human input writes, paused detection, and last-event projection. ExampleShell is now layout/navigation glue. (TASK-50.)"
human_notes: |
status: clean
last_reconciled: 2026-06-12
---

# examples/src/useDemoRuntime

Runtime controller hook for the examples shell.

## What lives here

The source is `useDemoRuntime.ts` in the parent directory.

- Creates and caches `WorkflowRuntimeLive` per selected demo.
- Subscribes to runtime state and projects state diffs into `WorkflowEvent[]` via `capture()`.
- Owns root input writes, `run()`, and human input writes followed by runtime resume.
- Exposes derived UI state: `isPaused` and `lastEvent`.

## Boundary

- Imports from: React hooks, Effect, `@underwai/core`, `@underwai/runner`, `@underwai/transport` types, `EventLog.capture`, and `demo-types`.
- Exports to: `ExampleShell.tsx` only.
- What does NOT live here: visual layout, graph rendering, event rendering, or workflow definitions.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
