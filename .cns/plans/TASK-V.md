---
task: TASK-V
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [A5]
decision_required: false
---

# TASK-V: Delta-based subscription callback

## Source finding

> **A5. [warning] `subscribe` callback receives the full Node, but the consumer can't tell *what changed***
>
> *Location*: `docs/design.md` line ~340, `src/stub.ts` `subscribe`
>
> *Finding*: `subscribe(state, key, onUpdate: (node: Node) => void)` calls back with the full `Node`. The consumer's renderer switches on `node.status`, but if a node goes `running → streaming` (status change) AND gets a partial `output` (data change), the consumer can't tell which dimension changed. The renderer is forced to re-render the whole node on every callback. For a wall-display rendering 50 nodes, that's 50 re-renders per status transition.
>
> *Evidence*: the design says "the consumer re-renders on every status change. For partial updates, the consumer can diff the previous and current `Node`, or use a `node.updatedAt` timestamp to skip renders." — this is a *workaround*, not a feature. The lib could provide a delta.
>
> *Suggestion*: provide a `SubscribeDelta` union: `{ kind: "status", from: NodeStatus, to: NodeStatus } | { kind: "output", value: unknown } | { kind: "finalOutput", value: unknown } | ...`. The callback receives `Node & { changes: SubscribeDelta[] }`. The renderer can short-circuit if no relevant changes occurred. Or, simpler: pass `(prev: Node | null, next: Node)` so the renderer can shallow-compare. The current design leaves this to the consumer.

## Problem statement

The current `subscribe` callback receives the full `Node` on every update. The consumer can't tell what changed without diffing. For a wall-display rendering 50 nodes, that's 50 unnecessary re-renders per status transition.

## Recommendation

**Add a delta option: `(prev: Node | null, next: Node) => void`. Default is `(node: Node) => void`.**

The simpler option (vs. a `SubscribeDelta` union) is to pass the previous and next Node. The renderer can shallow-compare fields it cares about.

```ts
type SubscribeOptions = {
  prefix?: boolean
  batched?: boolean
  delta?: boolean  // default: false
}

// Default: callback gets the next Node
function subscribe(state, key, onUpdate: (node: Node) => void, opts?: SubscribeOptions): Subscription

// With { delta: true }: callback gets prev and next
function subscribe(state, key, onUpdate: (prev: Node | null, next: Node) => void, opts?: SubscribeOptions & { delta: true }): Subscription
```

The first call (when the subscription is created) passes `prev: null` so the renderer knows it's the initial state.

This is a v1.1 addition; for v1, the simpler `(node: Node) => void` is the default and most consumers won't need deltas.

## What "done" looks like

### Patches

1. **`docs/design.md`** — subscription section. Add the `delta` option to `subscribe` and `subscribeAll`. Document the `prev: Node | null, next: Node` signature.

2. **`src/stub.ts`** — add `delta?: boolean` to `SubscribeOptions`. The stub doesn't implement the delta logic; that's Phase 2.

### Verification

- `tsc --noEmit` exit 0.
- A test case (post-Phase-2): a delta subscriber gets `(prev, next)` on every update. The renderer shallow-compares and skips the re-render if no relevant fields changed.

## Session state

*(to be filled in during the design session)*
