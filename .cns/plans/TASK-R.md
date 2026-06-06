---
task: TASK-R
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [D6]
decision_required: false
---

# TASK-R: topologicalOrder derived field

## Source finding

> **D6. [warning] The `Record<string, Node>` is hard to iterate in render order**
>
> *Location*: `docs/design.md` `WorkflowState.nodes`
>
> *Finding*: nodes are in a `Record<string, Node>`. When the renderer wants to render nodes in topological order (for a wall display that needs to show "this comes before that"), it has to topologically sort on every render. The data structure has no notion of "render order."
>
> *Evidence*: `state.edges` is `ReadonlyArray<Edge>`, but the consumer has to walk it to compute a topological order. There's no cached `topologicalOrder: ReadonlyArray<NodeKey>` or equivalent.
>
> *Suggestion*: add a derived field `topologicalOrder: ReadonlyArray<NodeKey>` to the workflow state, computed at `init()` and updated when the topology changes (i.e., never, since the topology is set at init). The wall-display renderer iterates this list to render in order. (Or, the renderer can use a library like dagre for layout. But the lib should provide the *order*, not the *position*.)

## Problem statement

Nodes are in `Record<string, Node>`. Rendering them in topological order (so the wall-display shows the workflow's progression) requires the renderer to topologically sort on every render. The lib should provide the order, not the position.

## Recommendation

**Add a derived `topologicalOrder: ReadonlyArray<NodeKey>` field to the workflow state. Computed at `init()`.**

The order is a topologically-sorted list of node keys. The wall-display renderer iterates this list to render in order. The lib provides the *order*, not the *position* — positioning is the renderer's job (dagre, manual layout, etc.).

```ts
type WorkflowState = {
  // ... existing fields ...
  topologicalOrder: ReadonlyArray<NodeKey>  // computed at init()
}
```

The order is computed once at `init()` and never changes (the topology is set at init; new nodes are not added). On `deserialize`, the order is recomputed from the edges.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `WorkflowState` type. Add `topologicalOrder: ReadonlyArray<NodeKey>`. Note that it's derived at `init()` and recomputed on `deserialize`.

2. **`docs/design.md`** — operations section. Add a note: "the wall-display renderer iterates `state.topologicalOrder` to render in order. The lib provides the order, not the position."

3. **`src/stub.ts`** — add `topologicalOrder: ReadonlyArray<NodeKey>` to `WorkflowState`. The stub doesn't implement the derivation; that's Phase 2.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): `init(definition)` populates `topologicalOrder` correctly. `topologicalOrder.length === Object.keys(state.nodes).length`. The order respects the DAG (every node's parents come before it in the list).

## Session state

*(to be filled in during the design session)*
