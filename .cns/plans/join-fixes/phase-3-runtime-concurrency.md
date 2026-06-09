# Phase 3: Runtime concurrency + event-driven ready queue

[Back to overview](./overview.md)

## Goal

The runtime's `run()` loop in `packages/runner/src/runtime.ts` (lines 108–211) currently processes ready nodes strictly sequentially via `for (const key of ready) { yield* program(...) }`. After this phase the runtime is event-driven:

1. On any state change (a node resolves, fails, or is written to), the ready queue is recomputed.
2. If fewer than `maxConcurrent` programs are in-flight, the runtime pulls up to `(maxConcurrent - inFlight.size)` ready nodes from the queue and starts them as parallel fibers.
3. When an in-flight program completes, the cycle repeats.

The wall-clock for a fan-out branch becomes the slowest sibling rather than the sum.

## Changes

- **packages/runner/src/runtime.ts** — extend `RunOptions` (lines 44–48) with `maxConcurrent?: number` (default 1).
- **packages/runner/src/runtime.ts** — replace the outer `while (iter < maxIter)` wave loop and the inner `for (const key of ready)` sequential loop with an event-driven dispatch loop. The structure is a recursive `Effect.gen` that:
  - Reads the current state from `stateRef`.
  - Computes ready nodes via `findReadyNodesLocal`.
  - Filters out already-in-flight nodes.
  - Picks up to `(maxConcurrent - inFlight.size)` ready nodes and starts each as a `Effect.fork`'d fiber that runs the per-node program.
  - Waits for the next in-flight fiber to complete (via a `Deferred` or a polling yield).
  - Loops until all nodes are resolved/failed/paused and the ready set is empty.
- **packages/runner/src/runtime.ts** — `currentKey` (line 221) goes away. The `publish()` function takes the per-fiber key as a parameter from the fiber's scope. Each in-flight fiber carries its own `NodeKey` in a closure.
- **packages/runner/src/runtime.ts** — per-node transitions stay per-fiber: each fiber marks its own node `running` on start, then `resolved`/`failed` on completion, then notifies. A single notify per fiber is fine; the event-driven loop in the next iteration recomputes the ready set from the new state.
- **packages/runner/src/runtime.ts** — writeHumanInput / write still set downstream nodes `stale` synchronously, then notify. The event-driven loop sees the new state, recomputes ready, dispatches.

## Data structures

`RunOptions` gains one field:

```ts
readonly maxConcurrent?: number;  // default 1, must be a positive integer
```

The dispatch loop carries:
- `inFlight: Map<NodeKey, Fiber.RuntimeFiber<...>>` — the set of currently-running programs.
- `completed: Deferred<...>` — a barrier that resolves when any in-flight fiber completes. The dispatch loop awaits this barrier to wake up.

The per-fiber key is a closure variable inside the per-node effect builder.

## Why event-driven and not `Effect.forEach`

The plan originally said "use `Effect.forEach` with `concurrency: N`." That works for a single wave, but a wave only re-runs after the outer `while` loop. If a long-running program blocks the wave, no downstream node can start even if its other upstream has long since completed. The event-driven design wakes up the dispatch as soon as *any* fiber completes, so a fast sibling finishing unblocks its downstream without waiting for the slow sibling.

## Verification

- Static: `pnpm -r typecheck`, `pnpm test`, `pnpm lint` all 0.
- New tests in `packages/runner/src/runtime.test.ts`:
  - **"runs ready nodes in parallel when maxConcurrent > 1"** — 3-node workflow, two parallel-ready siblings plus a third that's blocked. With `maxConcurrent: 2`, the two parallel siblings should start within 50ms of each other.
  - **"default maxConcurrent is 1"** — 2-node chain runs in order with no observable overlap.
  - **"maxConcurrent does not affect final state"** — same workflow, `maxConcurrent: 1` vs `maxConcurrent: 4`, both produce the same final `WorkflowState`.
  - **"event-driven dispatch unblocks downstream on any sibling completion"** — three parallel siblings A, B, C. C is slow, A and B are fast. With `maxConcurrent: 2`, when A finishes, B is in-flight and C is ready. The dispatch loop starts C immediately, without waiting for B.
- Visual: run the join demo, confirm the event log shows `fetchAvatar` and `fetchProfile` both `running` before either `resolved`.

Phase is done when `pnpm -r typecheck` + `pnpm test` + `pnpm lint` are clean, the new tests pass, and the join demo's event log shows the two branches running concurrently.
