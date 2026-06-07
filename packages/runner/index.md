---
title: "@underwai/runner"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/runner

The runner. Owns the Effect fiber that walks the DAG. Provides `WorkflowRuntime` to consumer `Effect.gen` programs so they can call `publish` / `write` / `writeHumanInput` without state-threading. The lib is a runtime for Effect programs; this package *is* that runtime.

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

## Design decisions that govern this package

- **The runner is an Effect service.** The lib owns the runner fiber. `runWorkflow` is the primary API; `stepInternal` is not consumer-facing. Concurrent `runWorkflow` calls are safe (each owns its own fiber); concurrent `stepInternal` calls are not. (TASK-B, TASK-T)
- **Mid-execution `writeHumanInput` interrupts the Effect fiber via `Fiber.interrupt`.** (TASK-A) The interrupted effect's output is discarded; the node re-runs with the new input. The transition is `running → stale → running` (or `running → stale → paused`).
- **Multiple writes to the same node coalesce.** (TASK-M) The most recent value wins. The runner processes a node at most once per step. A second write while the node is `pending` / `running` / `paused` just updates the input.
- **The consumer's `Effect.gen` program gets a `WorkflowRuntime` service.** (TASK-B, TASK-T) `publish` / `write` / `writeHumanInput` are methods on the service, not free functions. The lib provides the service as a layer for the duration of the workflow's run.
- **`findReadyNodes` returns in dependency order.** (TASK-R) Kahn's algorithm using `edgesByFrom`. Iteration order is the contract. `paused` is NOT in the result. (TASK-O)

## Plan files that touch this package

- [`.cns/plans/TASK-A.md`](../../.cns/plans/TASK-A.md) — `writeHumanInput` race; `Fiber.interrupt` for mid-execution writes.
- [`.cns/plans/TASK-B.md`](../../.cns/plans/TASK-B.md) — `runWorkflow` (primary API), `stepInternal` (internal), `WorkflowRuntime` service.
- [`.cns/plans/TASK-H.md`](../../.cns/plans/TASK-H.md) — the `Edge.bridge` function is applied at edge resolution (in `mutations.ts` and `step-internal.ts`).
- [`.cns/plans/TASK-M.md`](../../.cns/plans/TASK-M.md) — re-execution coalescing rule.
- [`.cns/plans/TASK-O.md`](../../.cns/plans/TASK-O.md) — `findReadyNodes` returns `pending` OR `stale`; `paused` is NOT.
- [`.cns/plans/TASK-R.md`](../../.cns/plans/TASK-R.md) — `findReadyNodes` returns in dependency order.
- [`.cns/plans/TASK-T.md`](../../.cns/plans/TASK-T.md) — folded into TASK-B (`WorkflowRuntime` service is the only way for the consumer's program to mutate state).

## For the implementation phase

When Phase 2 starts, the agent reads this file, opens `.cns/architecture/index.md` and `.cns/architecture/node.md` for the state machine and per-status semantics, and implements the runner.

The runner is the most non-trivial piece of the lib. The state machine has seven statuses, six valid transitions, and the mid-execution interrupt. The composition is: `findReadyNodes` → `stepInternal` (run a single ready node's Effect, handle transitions) → loop until no ready nodes → re-run on stale/paused-closed.

The implementation is ~300-500 lines, mostly Effect plumbing. The state machine itself is the design (see `.cns/architecture/index.md` § "Statuses" — that's the source of truth for what each status means and what transitions are valid).
