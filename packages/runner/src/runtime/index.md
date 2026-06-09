---
title: "runner/runtime"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
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
    summary: "`runWorkflow` integration test was rolled back on 2026-06-07 due to Effect 3 + exactOptionalPropertyTypes typing friction. Re-attempted and landed on 2026-06-07 with the help of core/init() to construct a real WorkflowState from a composition. The runtime now accepts state.status \"pending\" as a valid starting state (the orchestrator flips it to \"running\" implicitly by starting to walk the DAG, and to \"completed\" when all nodes are resolved). The test uses core/compose + core/init + runWorkflow in 4 tests, all green. DEC-RUNNER-009 closed."
  - id: DEC-RUNNER-010
    date: 2026-06-08
    author: agent
    summary: "`RunOptions` gains `maxConcurrent?: number` (default 1). The dispatch loop is event-driven: each ready node is forked as a fiber carrying its own `NodeKey`; the loop wakes on `Fiber.join` of any in-flight completion and dispatches up to `(maxConcurrent - inFlight.size)` ready nodes. The legacy sequential `for (const key of ready)` is replaced. `currentKey` global is removed; `inFlightKey` is a single closure variable set by the dispatching fiber (JS single-threadedness makes this safe across parallel fibers). The per-fiber `Effect.ensuring` removes the key from inFlight and clears `inFlightKey`. (TASK-JF-3, .cns/plans/join-fixes/phase-3-runtime-concurrency.md)."
  - id: DEC-RUNNER-001a
    date: 2026-06-08
    author: agent
    summary: "The `WorkflowRuntime` service interface exposes: `run(opts)`, `publish(output, partial)`, `write(key, value)`, `writeHumanInput(key, value)`, `getState()`, `subscribe(cb)`. The service is a `Context.Tag(\"@underwai/WorkflowRuntime\")` (Effect 3.x). The `pause` no-op from the original sketch was removed (TASK-40)."
  - id: DEC-RUNNER-010a
    date: 2026-06-08
    author: agent
    summary: "`RunOptions.programs` was removed (TASK-39 follow-up). The runtime reads programs from `state.defs` (set up by `core/init()` from a `CompositionTree`). Consumers no longer thread a parallel `programs` record — the composition is the program registry."
  - id: DEC-RUNNER-001b
    date: 2026-06-08
    author: agent
    summary: "The dispatch loop in `run` is structured as: (1) read state, (2) compute ready nodes via `findReadyNodesLocal`, (3) dispatch up to (maxConcurrent - inFlight.size) ready nodes, each as a forked fiber, (4) await a `Fiber.join` of any in-flight fiber, (5) loop. The event-driven wake (vs. polling) means a fast sibling finishing unblocks downstream without waiting for the slow sibling. The maxIterations default of 1000 prevents infinite loops on misconfigured workflows."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# runner/src/runtime

The `WorkflowRuntime` Effect service. Owns the workflow state via a `Ref<WorkflowState>`. Exposes `run` (the main orchestrator), `publish` / `write` / `writeHumanInput` (the mutation methods), `getState`, and `subscribe` (internal fan-out).

## What lives here

The source is `runtime.ts` next to this directory.

- **`WorkflowRuntime`** — the `Context.Tag("@underwai/WorkflowRuntime")`. The service identifier in the Effect graph.
- **`WorkflowRuntimeShape`** — the interface: `run`, `publish`, `write`, `writeHumanInput`, `getState`, `subscribe`.
- **`WorkflowRuntimeLive(initialOpts)`** — a `Layer` that constructs a fresh service with its own `stateRef` and `subs` set. Each call creates a new service.
- **`RunOptions`** — `{ state, maxIterations?, maxConcurrent?, liveRegistry? }`. The `programs` field was removed (programs come from `state.defs`).
- **`notify(state)`** — internal: calls every `subs` callback and, if `RunOptions.liveRegistry` was set, calls `liveRegistry.notify(state)`. This is the runner's fan-out into the React renderer's `useSyncExternalStore`.

## Dispatch loop shape

Event-driven. Each ready node is `Effect.fork`'d as a fiber carrying its own `NodeKey` in a closure (`inFlightKey`). The loop wakes on `Fiber.join` of any in-flight fiber, recomputes the ready set, and dispatches up to `(maxConcurrent - inFlight.size)` ready nodes. Default `maxConcurrent: 1` preserves sequential behavior. The legacy `for (const key of ready)` was replaced.

## Boundary

- Imports from: `effect` (peer, for `Context`, `Effect`, `Fiber`, `Layer`, `Ref`), `@underwai/core` (types, `LiveSubscriptionRegistry`, `resolveInput`), `@underwai/schema` (`getHumanMode` to detect human-paused nodes), `./mutations.js` (the pure transition primitives).
- Exports to: consumer code that builds an Effect program and needs `WorkflowRuntime`. The examples package is the canonical consumer.
- **What does NOT live here:** the pure transition primitives (in `mutations.ts`). The dispatch loop calls those.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the runner's fiber model, the mid-execution policy, the re-execution coalescing rule, and the service contract.
