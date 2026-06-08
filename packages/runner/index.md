---
title: "@underwai/runner"
type: package
parent: ../../.cns/index.md
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
    summary: '`runWorkflow` integration test was rolled back on 2026-06-07 due to Effect 3 + exactOptionalPropertyTypes typing friction. Re-attempted and landed on 2026-06-07 with the help of core/init() to construct a real WorkflowState from a composition. The runtime now accepts state.status "pending" as a valid starting state (the orchestrator flips it to "running" implicitly by starting to walk the DAG, and to "completed" when all nodes are resolved). The test uses core/compose + core/init + runWorkflow in 4 tests, all green. DEC-RUNNER-009 closed.'
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/runner

The runner. Owns the Effect fiber that walks the DAG. Provides `WorkflowRuntime` to consumer `Effect.gen` programs so they can call `publish` / `write` / `writeHumanInput` without state-threading. The lib is a runtime for Effect programs; this package _is_ that runtime.

## What lives here

The pre-shard file plan:

- `src/index.ts` — the public entry. Re-exports `runWorkflow`, `stepInternal`, `WorkflowRuntime`. The only file the consumer imports from.
- `src/runtime.ts` — the `WorkflowRuntime` Effect service. Implemented with `Context.Tag` (Effect 3.x). The service provides `publish` (accumulator update), `write` (final output), `writeHumanInput` (set a human field). The lib's internal state is what the service updates. (TASK-B, TASK-T)
- `src/run-workflow.ts` — the main Effect program. Owns the runner fiber. Iterates `findReadyNodes` (in dependency order), runs the consumer's Effect for each, applies the mutation, recurses until no ready nodes. (TASK-B)
- `src/step-internal.ts` — the internal step primitive. Runs a single ready node's Effect. Handles `pending → running` (or `pending → paused` if verified), `running → streaming` (on `publish`), `running → resolved` (on `write`), `running → failed` (on error), `running → stale` (on mid-execution `writeHumanInput` via `Fiber.interrupt`). Not consumer-facing; the lib uses it inside `runWorkflow`.
- `src/mutations.ts` — the mutation primitives: `publish(state, key, partial)`, `write(state, key, finalOutput)`, `writeHumanInput(state, nodeKey, fieldKey, value)`. These update `WorkflowState` and return the new state. (TASK-A, TASK-H, TASK-S)
- `src/find-ready.ts` — `findReadyNodes(state)`: Kahn's algorithm using `edgesByFrom`. Returns `ReadonlyArray<NodeKey>` in dependency order. (TASK-O, TASK-R)

## Boundary

- **Imports from:** `@underwai/core` (data structure), `@underwai/schema` (`getHumanMode` to read the marker on a node's `inputSchema`), `effect` (peer), `zod` (peer).
- **Exports to:** consumer code (`runWorkflow`, the `WorkflowRuntime` service), `@underwai/transport` (v1.1+, subscribes to state changes driven by the runner).
- **What does NOT live here:** the data structure (in `@underwai/core`), the Zod extension (in `@underwai/schema`).

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `.cns/architecture/index.md` and `.cns/architecture/node.md` for the state machine and per-status semantics, and implements the runner.

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the runner fiber model, the mid-execution interrupt policy, the re-execution coalescing rule, and the WorkflowRuntime service contract. Prose in the body is for the file plan and the boundary; the _why_ lives in the decisions array.

The runner is the most non-trivial piece of the lib. The state machine has seven statuses, six valid transitions, and the mid-execution interrupt. The composition is: `findReadyNodes` → `stepInternal` (run a single ready node's Effect, handle transitions) → loop until no ready nodes → re-run on stale/paused-closed.

The implementation is ~300-500 lines, mostly Effect plumbing. The state machine itself is the design (see `.cns/architecture/index.md` § "Statuses" — that's the source of truth for what each status means and what transitions are valid).
