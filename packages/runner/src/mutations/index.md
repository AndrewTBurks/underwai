---
title: "runner/mutations"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, laziness-protocol]
decisions:
  - id: DEC-RUNNER-006
    date: 2026-06-06
    author: agent
    summary: "Mutations (publish, write, writeHumanInput) update WorkflowState and return a new state. The runner's state machine handles the rest: pending → running/paused, running → streaming/resolved/failed/stale, paused → pending (verified gate closes) (TASK-A, TASK-H)."
  - id: DEC-RUNNER-011
    date: 2026-06-08
    author: agent
    summary: "Each mutation is a pure function: `(state, ...) => state`. No Effect, no async, no I/O. The dispatch loop in `runtime.ts` calls these in sequence as the workflow progresses. The return type is `WorkflowState` (a new state object); if the node is missing the function returns the same state unchanged (idempotent no-op)."
  - id: DEC-RUNNER-011a
    date: 2026-06-08
    author: agent
    summary: "Six transitions: `markRunning`, `markStreaming`, `markResolved`, `markFailed`, `markPaused`, `writeHumanInput`. Each takes `(state, nodeId, ...)` plus a `now: string` ISO timestamp. The timestamp is computed at the call site (not inside the function) so the runner can pass an explicit time when it needs determinism in tests."
  - id: DEC-RUNNER-011b
    date: 2026-06-08
    author: agent
    summary: "The public `writeHumanInput` export from `@underwai/runner` was removed (TASK-40). The function is now an internal pure transition (`writeHumanInput as writeHumanInputMutation`) imported by `runtime.ts`; consumers go through the `WorkflowRuntime` service. The internal signature drops the legacy `_fiber` and `_stateRef` parameters (those were never used). (TASK-40 path (i).)"
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# runner/src/mutations

Pure state transitions on a `WorkflowState`. Each function takes a state and returns a new state (or the same state if the node is missing). No Effect, no async, no I/O. The runner's dispatch loop calls these in sequence as the workflow progresses.

## What lives here

The source is `mutations.ts` next to this directory.

- **`markRunning(state, nodeId, now)`** — `pending → running`. Sets `startedAt`.
- **`markStreaming(state, nodeId, output, partial, now)`** — `running → streaming`. Sets `output` and `outputPartial`.
- **`markResolved(state, nodeId, finalOutput, now)`** — `running → resolved` (or `pending → resolved` for consumer injection). Sets `finalOutput` and `resolvedAt`.
- **`markFailed(state, nodeId, error, now)`** — `running → failed`. Sets `error` and `failedAt`.
- **`markPaused(state, nodeId, now)`** — `pending → paused`. Sets `pausedAt`. Used when a node has a human-marked field and no input value.
- **`writeHumanInput(state, nodeId, value, now)`** — internal pure transition. Updates the node's input and marks it `resolved` (or `stale` if mid-execution). The public mutation goes through the `WorkflowRuntime` service; this function is internal.

## Why pure

The runtime is in `runtime.ts`. It threads a `Ref<WorkflowState>` and decides when to call which transition. By keeping the transitions pure, they can be tested in isolation (no Effect, no async), and the dispatch loop is the only place that orders them.

## Boundary

- Imports from: `effect` (peer, type-only), `@underwai/core` (Node, NodeStatus, SerializedError, WorkflowState types).
- Exports to: `runtime.ts` (the dispatch loop). Nothing else — these are not consumer-facing.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
