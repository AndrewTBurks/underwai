# Phase 1: Stable topological render order

[Back to overview](./overview.md)

## Goal

The consumer-view panel in `packages/examples/src/RenderedPanel.tsx` walks `state.nodes` in Map insertion order, which is the builder's DFS declaration order. For the join workflow this puts `render` at the top and `fetchAvatar` at the bottom. After this phase the panel renders in DAG-topological order: parallel siblings at the same level, with their parent above and their join child below.

## Changes

- **packages/examples/src/RenderedPanel.tsx** — replace the `for (const [key, node] of state.nodes)` loop in `useRows` (lines 139–170) with a loop over a derived `topologicalOrder: ReadonlyArray<NodeKey>` array. Compute the order once per render via a helper that does longest-path-from-root level assignment and sorts siblings by `node.id`. The level assignment mirrors the algorithm already in `Graph.tsx`'s `computeLayout` (lines 152–180) — extract a shared helper if the duplication exceeds 10 lines, otherwise duplicate.
- **packages/core/src/operations.ts** (optional) — if the helper is extracted, put it next to `findReadyNodes` so it lives with the other DAG utilities. Export it as `topologicalLevels`.
- **packages/examples/src/RenderedPanel.tsx** (tests) — add a test for the helper that covers: linear chain (one level at a time), diamond (root → two siblings → join), and disconnected nodes (each treated as level 0).

## Data structures

The helper returns `ReadonlyArray<ReadonlyArray<NodeKey>>` — an array of levels, each level an array of node keys in stable sort order. The renderer's `useRows` flattens this with a single `flatMap`, preserving level boundaries as the visual grouping.

The signature:

```ts
function topologicalLevels(state: WorkflowState): ReadonlyArray<ReadonlyArray<NodeKey>>
```

`WorkflowState` already carries `edges` and `edgesByTarget`/`edgesByFrom`. The helper uses `edges` directly (matches the existing `findReadyNodes` style) so it doesn't depend on the indexing being up to date.

## Verification

- Static: `pnpm -r typecheck`, `pnpm test`, `pnpm lint` all 0.
- Visual: open the join demo at `localhost:5173`, click Run, confirm the panel shows `trigger` first, then `fetchAvatar` and `fetchProfile` at the same vertical level, then `validateAvatar` and `validateProfile`, then `merge`, then `render`. The linear pipeline and human-in-the-loop demos should render in the same order as before (the algorithm produces insertion order for a chain).
- Test: the new unit test for `topologicalLevels` covers the three cases above.

Phase is done when the join panel reads top-to-bottom as `trigger → fetchAvatar, fetchProfile → validateAvatar, validateProfile → merge → render`, the linear pipeline still reads top-to-bottom in chain order, and `pnpm -r typecheck` + `pnpm test` + `pnpm lint` are clean.
