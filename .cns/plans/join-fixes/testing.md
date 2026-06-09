# Testing & verification

[Back to overview](./overview.md)

## Per-phase gates

Each phase must pass all three static gates before moving to the next:

```
pnpm -r typecheck
pnpm test
pnpm lint
```

`pnpm lint` must report 0 errors. Warnings are acceptable (the baseline has ~274 warnings from the pre-existing codebase).

## Browser visual verification

The join demo at `http://localhost:5173/` is the canonical surface for all four fixes. After each phase, load the demo and confirm:

**Phase 1 (topological render order):**
- Panel reads top-to-bottom: `trigger`, then `fetchAvatar` and `fetchProfile` at the same vertical level, then `validateAvatar` and `validateProfile`, then `merge`, then `render`.
- Linear pipeline panel still reads in chain order (`parse → trim → upper → exclaim → display`).
- Human-in-the-loop panel still reads in its current order (chain, no branching).

**Phase 2 (curved fan-in edges):**
- Graph shows two distinct curves into `merge`, entering at different y-coordinates on the left edge.
- Graph for the linear pipeline still shows straight lines between adjacent nodes.
- Graph for the human-in-the-loop demo still shows straight lines (no fan-in).

**Phase 3 (runtime concurrency):**
- With the join demo, the event log shows `fetchAvatar` and `fetchProfile` both `running` before either `resolved`.
- The two `running` events have timestamps within 50ms of each other.
- The total wall-clock for the join demo is roughly equal to one branch's duration, not the sum.

**Phase 4 (app-level option):**
- Same as Phase 3, but confirms the value flows from the demo's `maxConcurrent: 4` through `ExampleShell.tsx` to the runtime.
- The other demos (linear, human, streaming, wall-display) still default to `maxConcurrent: 1` and show sequential execution in the event log.

## New tests

**packages/core/src/operations.test.ts** — add a `describe("topologicalLevels()")` block with three cases:
- Linear chain (each node on its own level).
- Diamond (root → two siblings → join, with siblings on the same level).
- Disconnected nodes (each on level 0).

**packages/runner/src/runtime.test.ts** — add a `describe("run() with maxConcurrent")` block with three cases:
- `maxConcurrent: 2` runs ready siblings in parallel (assert start times overlap).
- `maxConcurrent: undefined` (default) runs sequentially (assert start times are strictly ordered).
- `maxConcurrent: 4` on a 2-node chain produces the same final state as `maxConcurrent: 1`.

**packages/examples/src/RenderedPanel.tsx** — no new tests here; the topological helper is tested in core.

## Regression sweep

After all four phases, run the full test suite and confirm no previously-passing tests now fail. The likely regressions:
- `runtime.test.ts`'s three existing tests should still pass (they all use the default `maxConcurrent: 1`).
- `runtime-service.test.ts`'s three tests don't call `run()` at all and are unaffected.
- The streaming demo's event log timing assertions (if any) need to be relaxed if they were written assuming sequential execution.

## Final visual sweep

Open all five demos in sequence, click Run on each, confirm the event log shows the expected transitions. Take a screenshot of the join demo's graph for the PR description.
