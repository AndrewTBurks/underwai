# Phase 4: App-level option wiring

[Back to overview](./overview.md)

## Goal

The `WorkflowRuntime` service's `run` method now accepts `maxConcurrent`. The example app (`packages/examples/src/ExampleShell.tsx`) calls `rt.run({ state, liveRegistry })` — after this phase it passes a `maxConcurrent` value too, and the join demo uses a higher cap than the other demos so the parallelism is observable in the UI.

## Changes

- **packages/examples/src/workflows.ts** — the `Demo` type (or whatever the per-demo options live in) gains an optional `maxConcurrent?: number` field. The `joinExampleTree` demo sets `maxConcurrent: 4` (enough to fan out the two parallel branches). The other demos omit the field and get the default of 1.
- **packages/examples/src/ExampleShell.tsx** — when calling `rt.run(...)`, pass `maxConcurrent: d.maxConcurrent`. One-line change in the `setupSub` block.
- **packages/runner/src/index.ts** — re-export `RunOptions` so consumers (the examples package) don't need to import from the internal path. It's already exported implicitly; verify the public surface is complete.
- **packages/runner/src/runtime.test.ts** — one more test that the `RunOptions` type accepts `maxConcurrent` and the layer reads it. This is a smoke test against the API contract, not a behavioral test (covered in Phase 3).

## Data structures

The `Demo` type gains one optional field. The join demo's value is documented in the demo's header comment: "concurrency: 4 — runs the avatar + profile branches in parallel after trigger resolves."

## Verification

- Static: `pnpm -r typecheck`, `pnpm test`, `pnpm lint` all 0.
- Visual: open the join demo, click Run, watch the event log. The two `running` events for `fetchAvatar` and `fetchProfile` should appear back-to-back (within 50ms of each other) before either `resolved`. The total wall-clock for the join demo should be noticeably less than 2× the single-node delay.
- Regression: open the linear pipeline, confirm its event log still shows nodes processing one at a time (maxConcurrent default of 1).

Phase is done when the join demo visibly runs its parallel branches concurrently, the other demos are unchanged, and `pnpm -r typecheck` + `pnpm test` + `pnpm lint` are clean.
