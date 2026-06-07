---
task: TASK-B
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [B2, B5]
folded_in: TASK-T
decision_required: true
---

# TASK-B: Effect-wrapped step + WorkflowRuntime service (folded with TASK-T)

**This plan folds the original TASK-B (concurrent `step()` safety) and TASK-T (`WorkflowRuntime` Effect service) into one refactor.** The two were inseparable: TASK-T's service is only useful if the runner is a single fiber (TASK-B's `runWorkflow` Effect program), and TASK-B's fiber is useless to a consumer's `Effect.gen` program without a way to call `publish` / `write` / `writeHumanInput` from inside the program. Shipping them separately would leave v1 with two runtimes.

## Source findings

> **B2. [critical] The runner has no concept of "in-flight" execution; concurrent step() calls are unsafe**
>
> *Location*: `docs/design.md` line ~258-262, `src/stub.ts` `step`
>
> *Finding*: `step(state): state` is the runner's loop. But the design doesn't say what happens if two `step()` calls are running concurrently — e.g., one triggered by an upstream re-execution completing and another by a `writeHumanInput`. Both would find the same `ready` nodes, both would start Effect programs, both would `write` to the same nodes, and the second write would clobber the first.
>
> *Evidence*: the design's `step` is a synchronous state function (in-process). The lib doesn't say "step is single-threaded" or "the consumer must serialize step calls." ...
>
> *Suggestion*: the lib should *require* that `step` is called from a single fiber. ... a `Runtime` object ... or document clearly: "step is not re-entrant; the consumer must serialize step calls (which is the natural pattern in Effect, where you run the step inside a `Effect.gen` program)."

> **B5. [critical] Effect's `Effect.gen` and the consumer's `program` don't compose with the runner's `step` cleanly**
>
> *Location*: `docs/design.md` line ~414, `NodeDefinition.program`
>
> *Finding*: the consumer writes `program: (input) => Effect.Effect<TOutput, TError, TRequirements>`. The lib's runner calls this program when the node is `ready`. But how does the lib's `publish` (called from inside the program to stream partials) get back to the lib's state? The consumer's Effect program has no access to the runner's state machine.
>
> *Evidence*: the design says "the consumer's Effect program calls `publish(value)` to update the accumulator." But `publish(state, key, partial)` takes a `state` argument. How does the consumer's program get the state? Two options: (a) pass `state` as a `Context` service the lib provides; (b) `publish` is a *side-effect* on a runtime fiber the lib controls. The design doesn't say which.

## Problem statement

Two related gaps, one fix:

1. **`step(state): state` is unsafe under concurrency.** Two fibers calling `step` clobber state. Documenting "don't do that" is a footgun. The lib should make it impossible.

2. **A consumer's `Effect.gen` program has no path to `publish` / `write` / `writeHumanInput`.** These three operations need a bridge from inside a running Effect program back to the lib's state machine. The current design doesn't specify the bridge.

Both gaps close in one move: the lib exposes an Effect service called `WorkflowRuntime`, and the runner is an Effect program (`runWorkflow`) that owns the single fiber. The consumer's program yields `WorkflowRuntime` to interact with the lib. The lib's internal step uses the same service to update state.

## Combined API shape

```ts
import { Context, Effect, Layer } from "effect"

// 1. The service
type WorkflowRuntime = {
  publish(partial: unknown): Effect.Effect<void>
  write(finalOutput: unknown): Effect.Effect<void>
  writeHumanInput(fieldKey: FieldKey, value: unknown): Effect.Effect<void>
  // Internal: the runner uses these to drive the state machine.
  // Not part of the consumer-facing docs.
  _publish(state: WorkflowState, key: NodeKey, partial: unknown): WorkflowState
  _write(state: WorkflowState, key: NodeKey, finalOutput: unknown): WorkflowState
  _writeHumanInput(state: WorkflowState, key: NodeKey, field: FieldKey, value: unknown): WorkflowState
}

const WorkflowRuntime = Context.GenericTag<WorkflowRuntime>("@underwai/WorkflowRuntime")

// 2. The primary API: an Effect program that owns the single fiber.
function runWorkflow(
  definition: NodeDefinition,
  state?: WorkflowState
): Effect.Effect<WorkflowState, never, never>

// 3. The low-level primitive: only for tests and advanced use.
// Renamed from `step` to make the re-entrancy contract explicit.
function stepInternal(state: WorkflowState): WorkflowState
```

The consumer's program:

```ts
import { Effect } from "effect"
import { WorkflowRuntime } from "@underwai/core"

const program = (input: TInput) => Effect.gen(function* () {
  const runtime = yield* WorkflowRuntime
  yield* runtime.publish(partialValue)
  // ... do work ...
  yield* runtime.write(finalValue)
})
```

The `runWorkflow` Effect program provides `WorkflowRuntime` as part of its layer. The consumer's program yields the service and uses it. The lib's internal `stepInternal` uses the same service to update state.

## Why this shape

- **One runner, not two.** Shipping `runWorkflow` (Effect) *and* `step` (imperative) as primary APIs would let consumers pick the unsafe one. `stepInternal` exists for tests, named for what it is (internal, not safe to call from multiple fibers), and not documented as a consumer-facing API.

- **One bridge, not three.** `publish` / `write` / `writeHumanInput` all go through the same service. The consumer's program doesn't see `state`; it sees the three methods. The lib's internal step uses the same methods to update state. No path to state lives outside the service.

- **The runner is a single fiber.** The `runWorkflow` Effect program runs `stepInternal` once per cycle. Multiple `writeHumanInput` calls don't trigger concurrent steps; they're inputs to the running workflow.

- **Effect-idiomatic resource lifecycle.** The lib can use Effect's `Fiber` lifecycle for cancellation, timeouts, and resource cleanup. Free wins for v1.1+ durability work, no extra code now.

- **Reader load is bounded.** A consumer asks "how do I drive the workflow?" and gets one answer: `runWorkflow`. A consumer asks "how do I update state from inside my program?" and gets one answer: `yield* WorkflowRuntime`. Two questions, two answers, no flowchart.

## What "done" looks like

### Patches

1. **`docs/design.md`** — runtime section. Replace `step(state): state` as the primary API with `runWorkflow(definition, state?): Effect<WorkflowState, never, never>`. Add a "low-level primitive" subsection that names `stepInternal` and warns it's not re-entrant.

2. **`docs/design.md`** — runtime section. Add a "WorkflowRuntime service" subsection. Define the service interface (the `publish` / `write` / `writeHumanInput` consumer-facing methods, and the internal-state-taking methods used by `stepInternal`). Show the consumer's program using the service.

3. **`docs/design.md`** — `NodeDefinition` type. Add a note that the program can yield `WorkflowRuntime` from the Effect context.

4. **`docs/design.md`** — state machine section (from TASK-A's patches). The `running → running (record writeHumanInput)` transition's recording path now goes through the same `WorkflowRuntime.writeHumanInput` method, not a separate API. The "record and apply" rule still holds; the implementation is unified.

5. **`src/stub.ts`** — add `WorkflowRuntime` as a `Context.GenericTag` export. Add `runWorkflow` as the new primary API. Add `stepInternal` as the renamed low-level primitive. The bodies are `throw new Error("not implemented")`.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` runtime section describes the single-fiber pattern, the `WorkflowRuntime` service, and the consumer-facing program shape.
- A test case (post-Phase-2): start a workflow, fire 10 concurrent `writeHumanInput` calls through the service, assert that all 10 are processed in order and the final state is consistent.
- A test case (post-Phase-2): a streaming node's program calls `runtime.publish(partial)` multiple times, asserts the accumulator is updated. A human-update path calls `runtime.writeHumanInput(field, value)`, asserts the field is set and the downstream subtree is marked `stale`.
- The combined test suite for TASK-B and TASK-T is a single test file (or a single describe block) that exercises both the concurrency safety and the service-bridge paths.

## Session state

*(to be filled in during the design session)*
