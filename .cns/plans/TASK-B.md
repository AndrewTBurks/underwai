---
task: TASK-B
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [B2]
decision_required: true
---

# TASK-B: Concurrent step() safety

## Source finding

> **B2. [critical] The runner has no concept of "in-flight" execution; concurrent step() calls are unsafe**
>
> *Location*: `docs/design.md` line ~258-262, `src/stub.ts` `step`
>
> *Finding*: `step(state): state` is the runner's loop. But the design doesn't say what happens if two `step()` calls are running concurrently — e.g., one triggered by an upstream re-execution completing and another by a `writeHumanInput`. Both would find the same `ready` nodes, both would start Effect programs, both would `write` to the same nodes, and the second write would clobber the first.
>
> *Evidence*: the design's `step` is a synchronous state function (in-process). The lib doesn't say "step is single-threaded" or "the consumer must serialize step calls." The state machine implies ordering (you must be `ready` before `running`) but the lib has no enforcement.
>
> *Suggestion*: the lib should *require* that `step` is called from a single fiber. The simplest way: make `step` part of an internal `Runtime` object that's created by `init()`, and have the consumer drive it through a single channel. Alternatively, document clearly: "step is not re-entrant; the consumer must serialize step calls (which is the natural pattern in Effect, where you run the step inside a `Effect.gen` program)." Without one of these, the lib will deadlock or corrupt state on concurrent calls.

## Problem statement

`step()` is described as a synchronous state function. But the consumer's "natural pattern in Effect" is to have many fibers all driving the workflow forward (one for the main loop, one for each `writeHumanInput`, one for each effect completion). If multiple fibers all call `step()`, the runner corrupts state.

This isn't a hypothetical — any non-trivial consumer will have multiple fibers. The lib has to handle it.

## Options

### (a) Doc-only: "step must be called from a single Effect fiber"
The lib documents the constraint. The consumer wraps `step` in their own serialization if they need it. **No runtime change.**

**My read**: insufficient. "Just don't do that" is the kind of guidance that fails silently. Most consumers will hit the bug once, debug for hours, and add a workaround. Better to make it impossible.

### (b) Add a `Runtime` object
`init(definition) → { runtime }`. `runtime.step(state) → state`. The runtime holds an internal mutex; concurrent `step` calls are serialized. The consumer can call `runtime.step` from any fiber; the lib handles the ordering.

**My read**: works, but the lib's API changes shape. The consumer no longer has a free function `step(state)`; they have a stateful runtime. This is fine if the runtime is the *only* way to drive the workflow. But it complicates serialization (the state still has to be passed back and forth, which is a flow-control issue).

### (c) Effect-wrapped step
`step` is no longer a free function. Instead, the lib provides a `runWorkflow(definition, state?): Effect<state, ...>` Effect program. The consumer runs it inside a fiber; the lib's internal fiber drives `step` once per effect cycle. The consumer never sees `step` directly.

**My read**: the right answer. The consumer thinks in terms of "the workflow is running" (an Effect), not "I keep calling step" (a manual loop). The lib serializes internally. Multiple `writeHumanInput` calls don't trigger concurrent steps; they're just inputs to the running workflow.

This also has a nice side-effect: the lib can use Effect's `Fiber` lifecycle to manage cancellation, timeouts, and resource cleanup. Free wins.

### (d) Mutex around step
Add a `Mutex` (or equivalent) to the workflow state. Every `step` call acquires the mutex; concurrent calls block. **Heavy-handed.**

**My read**: solves the problem but fights Effect's concurrency model. The lib should compose with Effect, not work around it.

## Recommendation

**(c) Effect-wrapped step.**

The consumer-facing API is `runWorkflow(definition, state?): Effect<state, error, requirements>`. The lib's internal fiber drives `step` once per cycle. The consumer can still expose `step` for low-level use (e.g., for testing), but the default is the Effect-wrapped version.

This pairs with TASK-T (WorkflowRuntime Effect service): the consumer's Effect programs access `publish` / `write` / `writeHumanInput` via the service; the lib's internal step uses the same service to update state.

## What "done" looks like

### Patches

1. **`docs/design.md`** — runtime section. Replace "step(state): state" with "runWorkflow(definition, state?): Effect<state, ...>" as the primary API. Add a "low-level step" section for tests and advanced use.

2. **`docs/design.md`** — new "Runtime" section. Describe the internal lib loop: a single fiber drives `step` once per effect cycle; all state mutations go through the fiber; multiple writeHumanInputs are inputs to the fiber, not triggers for concurrent steps.

3. **`src/stub.ts`** — add `runWorkflow` as a new exported function. `step` stays as a low-level primitive (renamed if needed for clarity, e.g., `stepUnsafe` or `stepInternal`).

### Verification

- `tsc --noEmit` exit 0 (the stub's `step` signature is unchanged; new `runWorkflow` is added with `throw new Error("not implemented")` body).
- `docs/design.md` runtime section describes the single-fiber pattern.
- A test case (post-Phase-2): start a workflow, fire 10 concurrent `writeHumanInput` calls, assert that all 10 are processed in order and the final state is consistent.

## Session state

*(to be filled in during the design session)*
