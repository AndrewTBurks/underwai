---
task: TASK-T
status: merged
merged_into: TASK-B
source: interrogate-2026-06-06
severity: warning
finding_refs: [B5]
---

# TASK-T: WorkflowRuntime Effect service — MERGED INTO TASK-B

**This plan was merged into [`TASK-B.md`](./TASK-B.md) on 2026-06-06.** The combined plan covers both `runWorkflow` (the Effect-wrapped step that owns the single fiber) and the `WorkflowRuntime` service (the bridge from a consumer's `Effect.gen` program to `publish` / `write` / `writeHumanInput`).

The merge is one refactor because:
- The `WorkflowRuntime` service is only useful if the runner is a single fiber (TASK-B's `runWorkflow`). Without `runWorkflow`, the service has no privileged caller; consumers would still need a stateful runtime to drive the service.
- The single-fiber `runWorkflow` is useless to a consumer's `Effect.gen` program without a way to call `publish` / `write` / `writeHumanInput` from inside the program. The service is the bridge.
- Shipping them separately would leave v1 with two runners (imperative `step` and Effect-wrapped `runWorkflow`) and no clear contract for which one is the consumer-facing API.

## Why the original finding still matters

The original B5 finding identified a real gap: `publish(state, key, partial)` took a `state` argument, but a consumer's `Effect.gen` program has no path to `state`. The combined TASK-B plan closes the gap with the `WorkflowRuntime` service. The internal-state-taking methods (`_publish`, `_write`, `_writeHumanInput`) are the lib's own view; the consumer-facing methods (`publish`, `write`, `writeHumanInput`) are the Effect view. The service is the join.

## Source finding (preserved for the project log)

> **B5. [critical] Effect's `Effect.gen` and the consumer's `program` don't compose with the runner's `step` cleanly**
>
> *Location*: `docs/design.md` line ~414, `NodeDefinition.program`
>
> *Finding*: the consumer writes `program: (input) => Effect.Effect<TOutput, TError, TRequirements>`. The lib's runner calls this program when the node is `ready`. But how does the lib's `publish` (called from inside the program to stream partials) get back to the lib's state? The consumer's Effect program has no access to the runner's state machine.
>
> *Evidence*: the design says "the consumer's Effect program calls `publish(value)` to update the accumulator." But `publish(state, key, partial)` takes a `state` argument. How does the consumer's program get the state? Two options: (a) pass `state` as a `Context` service the lib provides; (b) `publish` is a *side-effect* on a runtime fiber the lib controls. The design doesn't say which.
>
> *Suggestion*: option (a) is cleaner. The lib provides a `WorkflowRuntime` service via Effect's `Context`, with methods `publish`, `write`, `writeHumanInput`. The consumer's program is `Effect.gen(function* () { const runtime = yield* WorkflowRuntime; yield* runtime.publish(...) })`. The runner intercepts the program's yield, runs the program, and the lib's services update the state. The design needs to specify the service interface.

## Session state

*(merged; design session held against the combined TASK-B plan)*
