---
task: TASK-K
status: folded
source: interrogate-2026-06-06
severity: warning
finding_refs: [C2]
decision_required: false
---

# TASK-K: Drop humanFields cache

## Source finding

> **C2. [warning] `humanFields: ReadonlyMap<FieldKey, HumanMode>` is redundant with the input schema**
>
> *Location*: `docs/design.md` `Node.humanFields`, `src/stub.ts` `Node`
>
> *Finding*: `humanFields` is "computed from inputSchema at init()." The schema is the source of truth; `humanFields` is a cache. But why cache it? The lib has the schema at every status transition; it could re-walk the schema to find human fields. The cache is an optimization.
>
> *Evidence*: the design says "Computed from inputSchema at init(). Tells the runner which fields are human-writable and whether they require pre-run confirmation." The runner's `writeHumanInput` and the state-machine transitions need to know which fields are human-writable and in which mode. If the cache is wrong (out of sync with the schema), the runner's behavior is wrong.
>
> *Suggestion*: either (a) drop the cache, re-walk the schema every time (cheap if the schema is small), or (b) make `humanFields` a *derived* field (not stored on the node) and provide a `getHumanFields(node): ReadonlyMap<...>` accessor. (b) is the right call — it removes the redundancy and makes the schema the single source of truth.

## Problem statement

`humanFields` is a cache that's supposed to be derived from the input schema. But:
- The cache can go out of sync with the schema.
- Re-walking the schema is cheap (the schema is a tree of ZodTypeAny; typical workflow has <10 fields).
- The cache adds a stored field on `Node` that has to be kept in sync through every state transition.

The single source of truth should be the input schema, not the cache.

## Recommendation

**Drop the cache. Add a `getHumanFields(node): ReadonlyMap<FieldKey, HumanMode>` accessor that derives the map from the input schema on read.**

```ts
type Node = {
  // ... existing fields, minus humanFields ...
  // inputSchema is the source of truth
}

function getHumanFields(node: Node): ReadonlyMap<FieldKey, HumanMode> {
  // Walk node.inputSchema, find fields with _def.humanMode set
  // Return as ReadonlyMap
}
```

The lib's `init()` doesn't pre-compute; `getHumanFields` is called when needed (rare; the runner only needs it during the state-machine transitions for `paused`).

## What "done" looks like

### Patches

1. **`docs/design.md`** — `Node` type. Remove `humanFields`. Note that `getHumanFields` derives the map on read.

2. **`docs/design.md`** — operations section. Add `getHumanFields(node): ReadonlyMap<FieldKey, HumanMode>` to the operations.

3. **`src/stub.ts`** — remove `humanFields` from `Node`. Add `getHumanFields` as a new exported function with `throw new Error("not implemented")` body.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): `getHumanFields(nodeWithHumanFields)` returns the correct map. `getHumanFields(nodeWithoutHumanFields)` returns an empty map.

## Session state

**2026-06-06 — folded into TASK-G.** The `humanFields: ReadonlyMap<FieldKey, HumanMode>` cache on `Node` is gone. The lib reads the human-fields view on demand via `getHumanFields(node)`, which walks `node.inputSchema` via `getHumanMode`. Re-walking the schema is cheap for typical <10-field schemas; the cache was redundant and could drift from the schema.

The original C2 finding ("`humanFields` is redundant with the input schema") is closed by the structural move: the schema is now the only source of truth for human-editable fields, and `getHumanFields` is a derived view that reads the schema on each call. The cache pattern was a micro-optimization that introduced a sync burden; the lazy read is the right call.

See TASK-G.md for the full refactor and the patch list. The `getHumanFields` accessor is added to the operations section.
