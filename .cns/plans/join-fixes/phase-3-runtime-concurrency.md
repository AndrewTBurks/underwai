# Phase 3: Runtime concurrency knob + per-wave parallel execution

[Back to overview](./overview.md)

## Goal

The runtime's `run()` loop in `packages/runner/src/runtime.ts` (lines 108–211) processes ready nodes strictly sequentially via `for (const key of ready) { yield* program(...) }`. For the join workflow, `fetchAvatar` and `fetchProfile` are both ready after `trigger` resolves but they run one after the other. After this phase, ready nodes within a single wave run in parallel up to a configurable cap, and the wall-clock for a fan-out branch is the slowest sibling.

## Changes

- **packages/runner/src/runtime.ts** — extend `RunOptions` (lines 44–48) with `maxConcurrent?: number`. The inner `for (const key of ready)` loop (line 137) becomes `Effect.forEach(ready, (key) => runOne(key, ...), { concurrency: opts.maxConcurrent ?? 1, batching: false })`. Default 1 preserves the current sequential behavior. The outer `while` loop and `findReadyNodesLocal` call are unchanged.
- **packages/runner/src/runtime.ts** — `currentKey` (line 221) is a module-scoped `NodeKey | null` used by `publish()` to know which node is in-flight. With parallel fibers, multiple programs are in-flight at once. The fix: replace the global with a `WeakMap<FiberId, NodeKey>` or, simpler, pass the key into the per-node effect via a `Ref` local to the `forEach` callback. The per-fiber approach is cleaner because it doesn't leak across waves.
- **packages/runner/src/runtime.ts** — the per-program transition logic (mark `running`, set `currentKey`, `yield* program(...)`, mark `resolved`/`failed`, notify) moves into the `forEach` callback. The per-wave transitions (marking downstream nodes `stale` when an upstream is `written`) need to be batched: collect all completed state updates from this wave and apply them in a single `Ref.update` so a single `notify` fires per wave.

## Data structures

`RunOptions` gains one field:

```ts
readonly maxConcurrent?: number;  // default 1, must be a positive integer
```

The per-fiber key tracking uses a `Ref<Map<FiberId, NodeKey>>` scoped to the `forEach` callback. The wave-commit phase collects the per-fiber final states into a `Chunk<WorkflowState>` and applies them in one `Ref.update`.

The `Wave` type (internal, not exported) summarizes a single ready wave:

```ts
type Wave = {
  ready: ReadonlyArray<NodeKey>;
  results: ReadonlyMap<NodeKey, WorkflowState>;  // per-node final state
};
```

## Verification

- Static: `pnpm -r typecheck`, `pnpm test`, `pnpm lint` all 0.
- New tests in `packages/runner/src/runtime.test.ts`:
  - **"runs ready nodes in parallel when maxConcurrent > 1"** — build a 3-node workflow where each node's program records its start time. With `maxConcurrent: 2`, the two parallel-ready siblings' start times should be within 50ms of each other, and the third (blocked) should start after the first wave completes.
  - **"default maxConcurrent is 1"** — a 2-node chain runs in order with no observable overlap.
  - **"maxConcurrent does not affect final state"** — same workflow, `maxConcurrent: 1` vs `maxConcurrent: 4`, both produce the same final `WorkflowState`.
- Visual: run the join demo, confirm the event log shows `fetchAvatar` and `fetchProfile` both `running` before either `resolved`. With `maxConcurrent: 1` the log shows them sequential (current behavior).

Phase is done when `pnpm -r typecheck` + `pnpm test` + `pnpm lint` are clean, the three new tests pass, and the join demo's event log shows the two branches running concurrently.
