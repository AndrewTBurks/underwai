# Phase 2: Curved edges for graph fan-in

[Back to overview](./overview.md)

## Goal

The graph layout in `packages/examples/src/Graph.tsx` draws straight lines from each source's right edge to its target's left edge. For the join workflow, both `validateAvatar` and `validateProfile` send a straight line into the left side of `merge`. The two lines overlap on the same x-coordinate, making the diamond structure invisible. After this phase, edges that are part of a fan-in (multiple incoming edges to the same target) are curved so each source connects to a distinct point on the target's left edge.

## Changes

- **packages/examples/src/Graph.tsx** — in `computeLayout` (lines 223–240, the edge-routing block), detect fan-in groups (edges grouped by `e.to`), and for each group with more than one edge, route the lines along cubic Bézier curves with the control points offset vertically based on the source's row. The first source's edge enters at `y2 = target.y + NODE_H * 0.25`, the second at `y2 = target.y + NODE_H * 0.75`. Single-source edges stay straight.
- **packages/examples/src/Graph.tsx** — the `<line>` element becomes a `<path>` when the edge is curved. The arrowhead marker (`markerEnd="url(#arrowhead)"`) still works on paths.

## Data structures

The edge-routing helper takes the existing `LayoutEdge` array and the `Map<NodeKey, Point>` of computed positions, and returns an enriched array:

```ts
type RoutedEdge = {
  from: NodeKey;
  to: NodeKey;
  path: string;  // SVG path "d" attribute
  markerEnd: "url(#arrowhead)";
};
```

The fan-in detection groups by `to` and uses `Array.from(group.values()).indexOf(edge)` to pick the control-point offset.

## Verification

- Static: `pnpm -r typecheck`, `pnpm test`, `pnpm lint` all 0.
- Visual: open the join demo, confirm the two edges into `merge` enter at distinct y-coordinates on the left edge of the `merge` node. Open the linear pipeline and confirm the straight lines between `parse → trim → upper → exclaim → display` are unchanged (single-source edges stay straight).
- Test (optional): a small snapshot test for the path-d output for a known fan-in shape.

Phase is done when the join demo's graph clearly shows a diamond (two parallel branches converging at `merge`) and the linear pipeline graph looks the same as before.
