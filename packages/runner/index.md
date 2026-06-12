---
title: "@underwai/runner"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
links:
  - id: runner-runtime
    path: packages/runner/src/runtime/index.md
  - id: runner-mutations
    path: packages/runner/src/mutations/index.md
decisions:
  - id: DEC-RUNNER-001
    date: 2026-06-06
    author: agent
    summary: The runner is an Effect service. The lib owns the runner fiber. runWorkflow is the primary API; stepInternal is not consumer-facing. Concurrent runWorkflow calls are safe (each owns its own fiber); concurrent stepInternal calls are not (TASK-B, TASK-T).
  - id: DEC-RUNNER-002
    date: 2026-06-06
    author: agent
    summary: "writeHumanInput marks a node stale and updates the input. The runtime picks up the stale node on the next outer-loop iteration and re-runs it. The Fiber.interrupt pattern (mid-execution interrupt + restart) is deferred: the current runtime runs programs sequentially, so writeHumanInput is the supported injection pattern (TASK-35)."
  - id: DEC-RUNNER-003
    date: 2026-06-06
    author: agent
    summary: Multiple writes to the same node before re-execution completes coalesce. The most recent value wins. The runner processes a node at most once per step. A second write while the node is pending/running/paused just updates the input (TASK-M).
  - id: DEC-RUNNER-004
    date: 2026-06-06
    author: agent
    summary: "The consumer's Effect.gen program gets a WorkflowRuntime service. publish/write/writeHumanInput are methods on the service, not free functions. The lib provides the service as a layer for the duration of the workflow's run (TASK-B, TASK-T)."
  - id: DEC-RUNNER-005
    date: 2026-06-06
    author: agent
    summary: "findReadyNodes returns ReadonlyArray<NodeKey> in dependency order. Kahn's algorithm using edgesByFrom. Iteration order is the contract. paused is NOT in the result (TASK-O, TASK-R)."
  - id: DEC-RUNNER-006
    date: 2026-06-06
    author: agent
    summary: "Mutations (publish, write, writeHumanInput) update WorkflowState and return a new state. The runner's state machine handles the rest: pending → running/paused, running → streaming/resolved/failed/stale, paused → pending (verified gate closes) (TASK-A, TASK-H)."
  - id: DEC-RUNNER-007
    date: 2026-06-06
    author: agent
    summary: "Edge.bridge is applied at edge resolution. The runner transforms upstream's finalOutput via the bridge function before populating the downstream's ResolvedInput.value (TASK-H)."
  - id: DEC-RUNNER-008
    date: 2026-06-06
    author: agent
    summary: "@underwai/runner depends on @underwai/core and @underwai/schema. Effect is a peer; the runtime is built on Effect.gen. Renderers depend on @underwai/runner; @underwai/runner does NOT depend on any renderer."
  - id: DEC-RUNNER-009
    date: 2026-06-07
    author: agent
    summary: '`runWorkflow` integration test was rolled back on 2026-06-07 due to Effect 3 + exactOptionalPropertyTypes typing friction. Re-attempted and landed on 2026-06-07 with the help of core/init() to construct a real WorkflowState from a composition. The runtime now accepts state.status "pending" as a valid starting state (the orchestrator flips it to "running" implicitly by starting to walk the DAG, and to "completed" when all nodes are resolved). The test uses core/compose + core/init + runWorkflow in 4 tests, all green. DEC-RUNNER-009 closed.'
  - id: DEC-RUNNER-010
    date: 2026-06-08
    author: agent
    summary: '`RunOptions` gains `maxConcurrent?: number` (default 1). The dispatch loop is event-driven: each ready node is forked as a fiber carrying its own `NodeKey`; the loop wakes on `Fiber.join` of any in-flight completion and dispatches up to `(maxConcurrent - inFlight.size)` ready nodes. The legacy sequential `for (const key of ready)` is replaced. `currentKey` global is removed; `inFlightKey` is a single closure variable set by the dispatching fiber (JS single-threadedness makes this safe across parallel fibers). The per-fiber `Effect.ensuring` removes the key from inFlight and clears `inFlightKey`. (TASK-JF-3, .cns/plans/join-fixes/phase-3-runtime-concurrency.md).'
  - id: DEC-RUNNER-011
    date: 2026-06-12
    author: agent
    summary: "When a human-marked node is stale after writeHumanInput, the runtime uses the node's human-written input value instead of recomputing input from upstream bridge defaults. This preserves live-edit human input and prevents upstream defaults from overwriting the user's value before rerun. (TASK-46.)"
human_notes: |

status: clean
last_reconciled: 2026-06-11
---

# @underwai/runner

The Effect runtime package. It owns the service that walks a `WorkflowState`, runs node programs, applies pure transition helpers, and notifies subscribers. Core owns the value shape; runner owns mutation and execution.

## What lives here

- `src/runtime.ts` — `WorkflowRuntime`, `WorkflowRuntimeShape`, `WorkflowRuntimeLive`, `RunOptions`, the event-driven dispatch loop, and subscription fan-out.
- `src/mutations.ts` — pure transition helpers used by the runtime: streaming, resolved/write, human input, running, paused, stale, and failure transitions.
- `src/index.ts` — public re-exports.
- Tests next to the source exercise the service, runtime integration, and pure mutations.

## Runtime shape

`WorkflowRuntime` exposes `run`, `publish`, `write`, `writeHumanInput`, `getState`, and `subscribe`. Programs come from `state.defs`, which is populated by `core/init()` from a `CompositionTree`; callers no longer thread a parallel `programs` record. The dispatch loop is event-driven: ready nodes are forked up to `maxConcurrent`, each fiber carries its own key, and the loop wakes when any in-flight fiber completes.

## Boundary

- **Imports from:** `@underwai/core` for state, keys, `resolveInput`, and `LiveSubscriptionRegistry`; `@underwai/schema` for human marker detection; `effect` as the runtime substrate.
- **Exports to:** consumers and examples that run workflows.
- **What does NOT live here:** core data definitions, composition builders, transport protocol encoding, or renderer-specific UI.

The completed TASK-A, TASK-B, TASK-M, TASK-O, TASK-R, TASK-T, TASK-31, TASK-35, TASK-37, TASK-39, TASK-40, and TASK-JF-3 decisions are sharded into this package and its module nodes. Module-specific mechanics live in `src/runtime/index.md` and `src/mutations/index.md`.
