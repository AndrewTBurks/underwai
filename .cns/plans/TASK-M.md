---
task: TASK-M
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [B4]
decision_required: false
---

# TASK-M: Stale re-execution coalescing

## Source finding

> **B4. [warning] The `stale` re-execution queue has no priority or ordering**
>
> *Location*: `docs/design.md` line ~285, `stale` propagation
>
> *Finding*: when a human updates a `writeable` field, the node goes `stale`, the downstream subtree is marked `stale`, and re-execution is "queued." But what's the order? If a human updates field F1 on node N, then 100ms later updates F2 on the same node N, does the runner process them as two separate re-executions (re-running the node twice), or as one (the latest value wins)?
>
> *Evidence*: the design says "re-execution is queued" but doesn't say what happens to multiple writes. If the runner re-executes on every write, the node runs N+1 times for N writes. If the runner debounces, "what's the debounce window?" is unanswerable.
>
> *Suggestion*: define the semantics: "multiple writes to the same node before re-execution completes coalesce; the most recent value wins." The runner's `findReadyNodes` returns `stale` nodes, but it processes a node at most once per step (the node's `stale` flag is cleared when it transitions to `pending → ready`). A second write while the node is `pending`/`ready`/`running` just updates the input; the runner picks it up on the next step.

## Problem statement

The state machine says "re-execution is queued" but doesn't say what happens with multiple writes. If a human updates the same node twice in quick succession, does the runner re-execute twice (wasteful) or once (most recent value wins)?

## Recommendation

**Coalesce. The most recent value wins.**

The rule:
- A write to a node sets the node to `stale`.
- Multiple writes to the same node before re-execution completes coalesce; the most recent value wins.
- The runner processes a node at most once per step. A second write while the node is `pending`/`ready`/`running` just updates the input; the runner picks it up on the next step.

This is the natural Effect semantics. The runner's `findReadyNodes` returns the set of `stale` + `pending` nodes; the runner processes them in topological order; the node's status flips to `running` when it's picked up, which prevents the runner from picking it up again until the next step.

```ts
// pseudo-code
function step(state) {
  const ready = findReadyNodes(state)  // pending or stale
  for (const key of topologicalOrder(ready)) {
    const node = state.nodes[key]
    if (node.status === "running" || node.status === "streaming") continue  // already in flight
    // ... resolve inputs, run program, etc.
  }
}
```

The "already in flight" check prevents double-execution.

## What "done" looks like

### Patches

1. **`docs/design.md`** — runtime section. Add a "re-execution coalescing" subsection. State the rule: "multiple writes to the same node before re-execution completes coalesce; the most recent value wins."

2. **`docs/design.md`** — state machine. Note that the `stale` state is "coalesced" — only the most recent input is used.

### Verification

- `tsc --noEmit` exit 0.
- A test case (post-Phase-2): write the same node 5 times in quick succession, assert it re-executes at most twice (once for the first write, once for any subsequent write that landed during the first re-execution).

## Session state

*(to be filled in during the design session)*
