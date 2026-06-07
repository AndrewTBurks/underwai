---
task: TASK-A
status: resolved
source: interrogate-2026-06-06
severity: critical
finding_refs: [B1]
decision_required: true
---

# TASK-A: Resolve the running + writeHumanInput race

## Source finding

> **B1. [critical] The state machine doesn't specify what happens when a `running` node receives a `writeHumanInput`**
>
> *Location*: `docs/design.md` state machine diagram, line ~267
>
> *Finding*: the design covers the transitions `pending → ready → running → resolved` and the `stale` re-entry path. But it doesn't address: what if the human writes a value to a `writeable` field *while the node is `running`*? The node's input is mid-execution. The runner can't apply the change without either (a) ignoring it until the current execution completes, or (b) canceling the current execution and re-starting.
>
> *Evidence*: the design says "if the node was `running` or `streaming`, the input is now stale *during* execution — the lib could either ignore the update (the node is already running) or queue a re-execution after the current one. for v1, **the lib ignores the update** while the node is running." But this is buried in a code comment in `writeHumanInput`; it's not in the design doc's state machine.
>
> *Suggestion*: add `running → running (ignore writeHumanInput)` to the state machine, or `running → stale` (cancel and re-queue). The current "ignores the update" decision should be in the design doc, not just the code comment. And: ignoring means the human's write is lost. The runner should at least record the write and apply it when the next ready transition happens.

## Problem statement

The state machine's "ignore" default is unsafe. The human's `writeHumanInput` call is *lost* — the next `step()` will re-run the node with the *original* input, not the human's update. This violates the contract that "a writeHumanInput changes the input."

The contract violation is silent: no error, no warning. The consumer thinks the human updated the field, but the workflow re-ran with the old value. This is the worst kind of bug.

## Options

### (a) Ignore and apply on next ready
The runner records the write but doesn't act on it during `running`. When the current execution completes (success or fail), the runner checks for pending writes and applies them: the node re-runs with the new input. Cost: one wasted execution. Benefit: simple, no cancellation logic. **The human's update is preserved.**

**My read**: the simplest correct answer. The wasted execution is small cost for correctness. The consumer sees a brief delay but gets the right result.

### (b) Cancel the current Effect and re-run
The runner cancels the in-flight Effect (via Effect's `Fiber.interrupt`), transitions the node to `pending → ready → running` with the new input. Cost: cancellation logic, consumer's Effect programs must be cancellation-safe. Benefit: no wasted work.

**My read**: too aggressive. It forces every consumer to write cancellation-safe Effect programs, which is a much bigger constraint than v1 should impose. The cancellation story in Effect is *possible* but not the default.

### (c) Queue the write; the Effect sees it
The runner keeps the in-flight Effect running, and provides a `WorkflowRuntime.signalWrite` mechanism so the Effect can voluntarily check for pending writes and abort. Cost: requires the consumer's cooperation. Benefit: the most efficient — no wasted work, no forced cancellation.

**My read**: the cleanest *eventually*, but the cooperation requirement is a footgun in v1. Most consumers will forget to check, and we're back to the "human's write is lost" bug.

### (d) Effect program is given a signal
Same as (c) but the lib passes a `WorkflowRuntime` service the program can `yield*` to access. The program can listen for the signal explicitly. Cost: API commitment (the lib provides a service; the consumer uses it). Benefit: cooperative cancellation is the Effect-idiomatic pattern.

**My read**: this is the v1.1+ answer, paired with TASK-T (WorkflowRuntime service). For v1, it's overkill.

## Recommendation

**(a) Ignore and apply on next ready.**

It's the simplest correct answer. The wasted execution is acceptable cost for v1. (b) and (d) are real v1.1+ refinements; (c) is a footgun.

The state machine transition is:

```
running → running (record writeHumanInput, do not apply)
running → ready (when current effect completes, if writeHumanInput was recorded)
   ready → running (with the new input)
```

Or, equivalently, on effect completion: `running → stale → ready → running`. The `stale` flag captures "input changed, re-execute."

## What "done" looks like

### Patches

1. **`docs/design.md`** — state machine section. Add the `running → running` transition with the "record and apply" rule. Remove the "ignore" line from the buried code comment. The state machine should now read:

```
pending → ready → running → resolved
                       ↑         ↓ (input changed via writeHumanInput)
                       │       stale
                       │         ↓
                       │       ready ─→ paused (if input has verified fields)
                       │                          ↓ (writeHumanInput)
                       │                       ready
                       │                          ↓
                       │                       running → resolved
                       ↑                          ↑
                       │                          │ (mid-execution writeHumanInput
                       │                          │  is recorded; applied on
                       │                          │  effect completion; node
                       │                          │  re-runs with new input)
                       │ (upstream re-execution changes the input)
                       │ → stale → ready (or paused for verified)
```

2. **`docs/design.md`** — `writeHumanInput` semantics section. Add a "mid-execution writes" subsection that explains the rule: the write is recorded; on effect completion, the node re-runs.

3. **`src/stub.ts`** — `writeHumanInput` body. Currently `throw new Error("not implemented")`. Add a comment block describing the "record and apply" semantics, even though the body is still stub. Or: implement the recording logic in the stub.

### Verification

- `tsc --noEmit` exit 0 (the stub's `writeHumanInput` signature is unchanged; only the comment is added).
- The state machine in `docs/design.md` shows the `running → running` transition.
- A test case in `human-input.test.ts` (post-Phase-2): start a slow node, write human input mid-execution, assert that the node re-runs with the new input after the first effect completes.

## Session state

**2026-06-06 — resolved.** Andrew picked: interrupt the in-flight Effect fiber via Effect's standard `Fiber.interrupt`. Transition is `running → stale → running`. Implementation is gated on TASK-B's `runWorkflow` refactor (the runner must own the fiber to interrupt it). The state machine text in `docs/design.md` defines the policy now; the runtime lands with TASK-B.
