---
task: TASK-T
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [B5]
decision_required: false
---

# TASK-T: WorkflowRuntime Effect service

## Source finding

> **B5. [critical] Effect's `Effect.gen` and the consumer's `program` don't compose with the runner's `step` cleanly**
>
> *Location*: `docs/design.md` line ~414, `NodeDefinition.program`
>
> *Finding*: the consumer writes `program: (input) => Effect.Effect<TOutput, TError, TRequirements>`. The lib's runner calls this program when the node is `ready`. But how does the lib's `publish` (called from inside the program to stream partials) get back to the lib's state? The consumer's Effect program has no access to the runner's state machine.
>
> *Evidence*: the design says "the consumer's Effect program calls `publish(value)` to update the accumulator." But `publish(state, key, partial)` takes a `state` argument. How does the consumer's program get the state? Two options: (a) pass `state` as a `Context` service the lib provides; (b) `publish` is a *side-effect* on a runtime fiber the lib controls. The design doesn't say which.
>
> *Suggestion*: option (a) is cleaner. The lib provides a `WorkflowRuntime` service via Effect's `Context`, with methods `publish`, `write`, `writeHumanInput`. The consumer's program is `Effect.gen(function* () { const runtime = yield* WorkflowRuntime; yield* runtime.publish(...) })`. The runner intercepts the program's yield, runs the program, and the lib's services update the state. The design needs to specify the service interface.

## Problem statement

The consumer's Effect program needs to call `publish` / `write` / `writeHumanInput` to interact with the lib's state machine. The current design doesn't say how the program gets access to these. The program can't take a `state` argument because the state is the runner's; passing it explicitly would require the consumer to thread it through every node.

## Recommendation

**Provide a `WorkflowRuntime` Effect service via `Context`. The consumer's program yields the service to access `publish` / `write` / `writeHumanInput`.**

```ts
import { Context, Effect } from "effect"

type WorkflowRuntime = {
  publish(partial: unknown): Effect.Effect<void>
  write(finalOutput: unknown): Effect.Effect<void>
  writeHumanInput(fieldKey: FieldKey, value: unknown): Effect.Effect<void>
}

const WorkflowRuntime = Context.GenericTag<WorkflowRuntime>("@underwai/WorkflowRuntime")

// Consumer's program:
const program = (input: TInput) => Effect.gen(function* () {
  const runtime = yield* WorkflowRuntime
  yield* runtime.publish(partialValue)
  // ... do work ...
  yield* runtime.write(finalValue)
})

// The lib provides WorkflowRuntime as part of its runWorkflow layer:
export const WorkflowRuntimeLive = Layer.succeed(WorkflowRuntime, {
  publish: (partial) => Effect.sync(() => /* update state */),
  write: (finalOutput) => Effect.sync(() => /* update state */),
  writeHumanInput: (fieldKey, value) => Effect.sync(() => /* update state */),
})
```

The lib's `runWorkflow` Effect program provides `WorkflowRuntimeLive` as a layer. The consumer's program yields the service and uses it. The lib's internal `step` uses the same service to update state.

This pairs with TASK-B (Effect-wrapped step): the runner is a single fiber, the consumer's programs run in child fibers of the runner, and the lib's `WorkflowRuntime` service is the bridge between them.

## What "done" looks like

### Patches

1. **`docs/design.md`** — runtime section. Add a "WorkflowRuntime service" subsection. Define the service interface. Show the consumer's program using the service.

2. **`docs/design.md`** — `NodeDefinition` type. Update to mention that the program can yield `WorkflowRuntime` from the Effect context.

3. **`src/stub.ts`** — add a stub for `WorkflowRuntime` and `WorkflowRuntimeLive`. (Implementation in Phase 2.)

### Verification

- `tsc --noEmit` exit 0.
- A test case (post-Phase-2): a streaming node's program calls `runtime.publish(partial)` multiple times, asserts the accumulator is updated. A human-update path calls `runtime.writeHumanInput(field, value)`, asserts the field is set and the downstream subtree is marked `stale`.

## Session state

*(to be filled in during the design session)*
