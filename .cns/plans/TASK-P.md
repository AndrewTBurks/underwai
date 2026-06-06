---
task: TASK-P
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [D2]
decision_required: false
---

# TASK-P: Batched subscription

## Source finding

> **D2. [warning] The `subscribe` callback gets called once per node update, but a render frame might want batched updates**
>
> *Location*: `docs/design.md` line ~340
>
> *Finding*: if 50 nodes all transition from `ready` to `running` to `resolved` in the same step (a parallel `all`), the `onUpdate` callback fires 150 times. The renderer's `setState` is called 150 times in a tight loop. React would batch these, but a different framework might not.
>
> *Evidence*: the design says "the consumer re-renders on every status change." For a parallel fan-out, this is 3× the work per node.
>
> *Suggestion*: provide a batched subscription option: `subscribe(state, key, onUpdate, { batched: true })` where the callback receives a list of updated nodes and is called once per *frame* (the lib's notion of "frame" is "between two `step()` calls"). The default is "unbatched" (one call per update) for low-latency cases. The renderer's choice.

## Problem statement

For a parallel `all` with 50 nodes, the `onUpdate` callback fires 150 times per step (each node's status transition fires once). For a wall-display renderer that wants to update once per frame, this is wasteful.

## Recommendation

**Add `{ batched: true }` option to `subscribe` and `subscribeAll`.**

The default is unbatched (one callback per node update). The `batched: true` option means "fire the callback once per step, with a list of updated nodes."

```ts
type SubscribeOptions = {
  prefix?: boolean
  batched?: boolean
}

// Unbatched (default)
function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (node: Node) => void,
  opts?: SubscribeOptions
): Subscription

// Batched
function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (nodes: ReadonlyArray<Node>) => void,
  opts?: SubscribeOptions & { batched: true }
): Subscription
```

The lib's notion of "frame" is "between two `step()` calls." A batched subscriber gets the list of nodes that updated in the most recent frame.

For v1.1, consider an explicit `batched: { windowMs: number }` option for time-based batching. For v1, the batch size is just "everything in this step."

## What "done" looks like

### Patches

1. **`docs/design.md`** — subscription section. Add the `batched` option to `subscribe` and `subscribeAll`. Document the "frame" notion (between two `step()` calls).

2. **`src/stub.ts`** — add `batched?: boolean` to `SubscribeOptions`. The stub doesn't implement the batching; that's Phase 2.

### Verification

- `tsc --noEmit` exit 0.
- A test case (post-Phase-2): a batched subscriber to a parallel `all` with 50 nodes gets one callback per step with 50 nodes, not 150 callbacks.

## Session state

*(to be filled in during the design session)*
