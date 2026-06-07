---
task: TASK-F
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [A3]
decision_required: false
---

# TASK-F: Edge indexing

## Source finding

> **A3. [warning] `Edge[]` is a structural relic; keys should be on the edge too**
>
> *Location*: `docs/design.md` line ~159, `src/stub.ts` `Edge`
>
> *Finding*: `Edge = { from: NodeKey; to: NodeKey; toField: FieldKey }` — three string-typed fields. The whole point of the design is "everything addressable by deterministic key." But edges aren't keyed; they're a flat array iterated linearly. `findReadyNodes` has to scan every edge for `to === candidateNodeId`, and there's no index. The verbosity reduction targeted `Record<string, Node>` but left `ReadonlyArray<Edge>` as a linear scan.
>
> *Evidence*: `findReadyNodes(state)` in the design returns `Set<NodeKey>`. To find the inputs of a node, the runner has to filter `state.edges` for `edge.to === key` — O(E) per node. With 100 nodes and 200 edges, that's 200 comparisons per node per step. A `Record<NodeKey, ReadonlyArray<Edge>>` indexed by `to` would be O(1).
>
> *Suggestion*: change `edges: ReadonlyArray<Edge>` to `edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>` (or include both: `edges: ReadonlyArray<Edge>` for serialization round-trip, plus a derived `edgesByTarget` for runtime). Or: edges get a deterministic key too (`"${from}->${to}.${toField}"`) and live in `Record<string, Edge>` like nodes. Pick one and commit.

## Problem statement

Edges are `ReadonlyArray<Edge>`. Every node's input resolution is O(E) — the runner filters the array for `to === key`. With 100 nodes and 200 edges, that's 200 comparisons per node per step. The "address everything" promise was applied to nodes but not to edges.

## Recommendation

Add a derived index `edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>` to the workflow state. Computed at `init()` time. The serialized form is still the linear `edges` array; the index is derived and re-computed on every state update (or, more efficiently, computed once and never updated because edges are set at init).

```ts
type WorkflowState = {
  // ... existing fields ...
  edges: ReadonlyArray<Edge>
  edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>  // derived at init
}
```

The runner uses `state.edgesByTarget[key]` for O(1) edge lookup. Serialization round-trips the linear `edges` array; the index is rebuilt on `deserialize`.

This is enough for v1. `edgesByFrom` (the reverse index) is v1.1 if needed; `findSubtree` is the alternative for downstream queries.

## Serialization contract (named here, applies project-wide)

`WorkflowState` carries two kinds of fields: **source fields** (`nodes`, `edges`, `error`, `id`, `version`, `status`, `createdAt`, `updatedAt`) and **derived fields** (`edgesByTarget`, `topologicalOrder`, future derived fields). The contract is:

- `serialize(state)` is a pure projection of the source fields. Derived fields are *not* serialized.
- `deserialize(json)` recomputes all derived fields. The recompute is total: every derived field the lib defines is rebuilt from the source.
- The lib's mutation primitives (`init`, `write`, `publish`, `writeHumanInput`, `stepInternal`) do *not* invalidate derived fields, because derived fields are derived from the source fields and recomputed only on `deserialize`.
- Adding a new derived field to `WorkflowState` is not a breaking change. Adding a new source field is a breaking change (it changes the serialized shape).

This contract is named once, here, because TASK-R also adds a derived field and a future plan will add another. The pattern needs to be explicit, not implicit, or the lib will drift.

## What "done" looks like

### Patches

1. **`docs/design.md`** — data structure section. Add `edgesByTarget` to `WorkflowState`. Note that it's derived and recomputed on `deserialize`.

2. **`docs/design.md`** — operations section. Add a note that `findReadyNodes` and `findSubtree` use `edgesByTarget` for O(1) lookup.

3. **`src/stub.ts`** — add `edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>` to `WorkflowState`. The stub doesn't implement the derivation; that's Phase 2.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): `init(definition)` populates `edgesByTarget` correctly. `edgesByTarget[nodeKey].length === edges.filter(e => e.to === nodeKey).length` for every key.

## Session state

*(to be filled in during the design session)*
