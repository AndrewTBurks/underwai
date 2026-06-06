---
task: TASK-D
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [D3]
decision_required: true
---

# TASK-D: subscribeAll for the wall-display case

## Source finding

> **D3. [warning] The wall-display use case (ThreadWeaver) needs a "subscribe to all nodes" API; not explicit in the design**
>
> *Location*: `docs/design.md` Subscription section
>
> *Finding*: ThreadWeaver's wall display renders *all* nodes simultaneously, with their spatial positions. The consumer needs to subscribe to *every* node. The current design says "subscribe to a specific key" but doesn't have a "subscribe to all" API.
>
> *Evidence*: the design says `subscribe(state, key, onUpdate)` where `key: NodeKey`. There's no `subscribe(state, "*", onUpdate)` or `subscribeAll(state, onUpdate)`. The consumer would have to know all the keys up front (or iterate `Object.keys(state.nodes)`).
>
> *Suggestion*: add `subscribeAll(state, onUpdate): Subscription` that subscribes to *every* node, called whenever *any* node updates. The wall-display renderer can then iterate `Object.values(state.nodes)` and render.

## Problem statement

ThreadWeaver's wall display (and any "render the whole workflow" use case) needs to subscribe to *every* node, not a specific key. The current API forces the consumer to either:

- Know all the keys up front (impossible if the workflow is generated dynamically).
- Iterate `Object.keys(state.nodes)` and call `subscribe` for each (N subscriptions, hard to manage).
- Use a sentinel key like `"*"` (not specified; type system rejects it).

## Options

### (a) `subscribeAll(state, onUpdate, opts?)` — every node, no key argument
The consumer calls `subscribeAll(state, onUpdate)` and gets a callback for *every* node update. opts can include `{ batched?: boolean }` (TASK-P), `{ filter?: { status?: NodeStatus[] } }` (deferred to v1.1).

**My read**: the right v1 shape. One function, no key, opts for refinement later.

### (b) `subscribeAll(state, onUpdate, { filter, prefix })` — every node matching the filter
Same as (a) but with a richer filter. v1.1 consideration.

**My read**: defer. v1 ships with (a). If the wall-display needs filtering (e.g., "only show resolved nodes"), it can do the filter in its own callback.

### (c) `subscribe(state, "*", onUpdate)` — sentinel key
Trick the existing API into a "subscribe to all" by passing `"*"` as the key. Clever, but it requires the type system to allow `string` for the key argument, which we explicitly closed off.

**My read**: no. The whole point of branded `NodeKey` is to prevent stringly-typed key access. A sentinel breaks that.

## Recommendation

**(a) for v1, (b) as a v1.1 consideration.**

```ts
function subscribeAll(
  state: WorkflowState,
  onUpdate: (node: Node) => void,
  opts?: { batched?: boolean }
): Subscription
```

No key argument. No filter. Just "every node, on update, call me."

## What "done" looks like

### Patches

1. **`docs/design.md`** — subscription section. Add `subscribeAll` as a sibling to `subscribe`. Note that the wall-display case is the primary use case. Note that `subscribeAll` is *always* segment-prefix-of-everything; the prefix option doesn't apply.

2. **`src/stub.ts`** — add `subscribeAll` as a new exported function. `throw new Error("not implemented")` body. Same `Subscription` return type as `subscribe`.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` subscription section documents `subscribeAll`.
- A test case (post-Phase-2): a single `subscribeAll` callback fires for every node update across the workflow.

## Session state

*(to be filled in during the design session)*
