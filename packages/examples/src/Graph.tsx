// Graph — SVG topology of the workflow DAG.
//
// Reads `state.nodes` (Map<NodeKey, Node>) and `state.edges`
// (ReadonlyArray<Edge>) and lays them out as a left-to-right
// graph. Each level is a column; nodes within a level are
// stacked. Edges are straight lines with a small arrowhead.
//
// Layout algorithm:
//   1. Topological sort by edges (Kahn's algorithm).
//   2. For each node, compute its "level" = the longest path
//      from any root node to it.
//   3. Within a level, stack nodes vertically with even
//      spacing.
//   4. Position by level (x) and stack index (y).
//
// The graph fits to its container; on resize the layout
// recalculates.

import { useMemo } from "react";
import type { Node, WorkflowState } from "@underwai/core";

const NODE_W = 130;
const NODE_H = 50;
const COL_GAP = 80;
const ROW_GAP = 24;
const PAD = 20;

type Layout = {
  readonly nodes: ReadonlyArray<{ node: Node; x: number; y: number }>;
  readonly edges: ReadonlyArray<{
    from: Node;
    to: Node;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    // SVG path "d" attribute. Present when this edge is
    // part of a fan-in (multiple incoming edges to the same
    // target) and gets a curved route so the parallel
    // branches don't overlap at the join. Undefined for
    // single-source edges, which stay as straight <line>s.
    path?: string;
  }>;
  readonly width: number;
  readonly height: number;
};

export function Graph({
  state,
  onNodeClick,
}: {
  state: WorkflowState | null;
  onNodeClick?: (key: string) => void;
}) {
  const layout = useMemo(() => (state ? computeLayout(state) : null), [state]);

  if (!state || !layout || layout.nodes.length === 0) {
    return (
      <div className="graph">
        <div className="graph__empty">no nodes</div>
      </div>
    );
  }

  return (
    <div className="graph">
      <svg
        className="graph__svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" className="graph__edge-arrow" />
          </marker>
        </defs>
        {layout.edges.map((e, i) =>
          e.path ? (
            <path
              key={i}
              className="graph__edge"
              d={e.path}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          ) : (
            <line
              key={i}
              className="graph__edge"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              markerEnd="url(#arrowhead)"
            />
          ),
        )}
        {layout.nodes.map(({ node, x, y }) => {
          const status = node.status.kind;
          const cls = `graph__node graph__node--${status}`;
          const key = node.id as unknown as string;
          const segments = key.split(".");
          const displayKey =
            segments.length > 1 ? segments[segments.length - 1] : key;
          return (
            <g
              key={key}
              className={cls}
              transform={`translate(${x}, ${y})`}
              onClick={onNodeClick ? () => onNodeClick(key) : undefined}
              style={onNodeClick ? { cursor: "pointer" } : undefined}
            >
              <rect
                className="graph__node-rect"
                width={NODE_W}
                height={NODE_H}
                rx={4}
              />
              <text
                className="graph__node-label"
                x={10}
                y={20}
                textAnchor="start"
              >
                {node.kind}
              </text>
              <text
                className="graph__node-key"
                x={10}
                y={34}
                textAnchor="start"
              >
                {displayKey}
              </text>
              <text
                className="graph__node-status"
                x={NODE_W - 10}
                y={20}
                textAnchor="end"
              >
                {status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function computeLayout(state: WorkflowState): Layout {
  // Build a level map: for each node, its level is the
  // longest path from any root.
  const nodes: Node[] = Array.from(state.nodes.values());
  const idToNode = new Map<string, Node>();
  for (const n of nodes) idToNode.set(n.id as unknown as string, n);

  // Build incoming edges map.
  const incoming = new Map<string, string[]>();
  for (const n of nodes) incoming.set(n.id as unknown as string, []);
  for (const e of state.edges) {
    const list = incoming.get(e.to as unknown as string) ?? [];
    list.push(e.from as unknown as string);
    incoming.set(e.to as unknown as string, list);
  }

  // Compute levels via BFS.
  const level = new Map<string, number>();
  for (const n of nodes) {
    const id = n.id as unknown as string;
    const ins = incoming.get(id) ?? [];
    if (ins.length === 0) {
      level.set(id, 0);
    }
  }
  // BFS: process levels in order.
  const queue: string[] = Array.from(level.keys());
  while (queue.length > 0) {
    const id = queue.shift()!;
    const lv = level.get(id) ?? 0;
    // Find outgoing edges.
    for (const e of state.edges) {
      if ((e.from as unknown as string) !== id) continue;
      const to = e.to as unknown as string;
      const cur = level.get(to);
      if (cur === undefined || cur < lv + 1) {
        level.set(to, lv + 1);
        queue.push(to);
      }
    }
  }
  // Any unreached node is level 0 (defensive).
  for (const n of nodes) {
    const id = n.id as unknown as string;
    if (!level.has(id)) level.set(id, 0);
  }

  // Group by level.
  const byLevel = new Map<number, Node[]>();
  for (const n of nodes) {
    const id = n.id as unknown as string;
    const lv = level.get(id) ?? 0;
    const arr = byLevel.get(lv) ?? [];
    arr.push(n);
    byLevel.set(lv, arr);
  }
  // Sort each level by kind then key for stability.
  for (const [lv, arr] of byLevel) {
    arr.sort((a, b) => {
      const ak = a.id as unknown as string;
      const bk = b.id as unknown as string;
      return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
    byLevel.set(lv, arr);
  }

  // Compute pixel positions.
  const levelCount = byLevel.size;
  const maxRows = Math.max(1, ...Array.from(byLevel.values()).map((a) => a.length));
  const width = levelCount * (NODE_W + COL_GAP) - COL_GAP + PAD * 2;
  const height = maxRows * (NODE_H + ROW_GAP) - ROW_GAP + PAD * 2;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [lv, arr] of byLevel) {
    arr.forEach((n, i) => {
      const x = PAD + lv * (NODE_W + COL_GAP);
      // Center the level vertically.
      const totalY = arr.length * (NODE_H + ROW_GAP) - ROW_GAP;
      const startY = (height - totalY) / 2;
      const y = startY + i * (NODE_H + ROW_GAP);
      positions.set(n.id as unknown as string, { x, y });
    });
  }

  const layoutNodes = nodes.map((n) => {
    const p = positions.get(n.id as unknown as string) ?? { x: 0, y: 0 };
    return { node: n, x: p.x, y: p.y };
  });
  // Group incoming edges per target. Targets with more
  // than one incoming edge are fan-in joins; their edges
  // get curved paths so the parallel branches don't overlap
  // at the left edge of the join node.
  const fanInCount = new Map<string, number>();
  for (const e of state.edges) {
    const to = e.to as unknown as string;
    fanInCount.set(to, (fanInCount.get(to) ?? 0) + 1);
  }
  // For each edge, the index of this edge within its target's
  // fan-in group (0-based). Edges without a fan-in group get
  // undefined.
  const edgeFanInSlot = new Map<number, number>();
  const slotByTarget = new Map<string, number>();
  state.edges.forEach((e, i) => {
    const toKey = e.to as unknown as string;
    if ((fanInCount.get(toKey) ?? 0) > 1) {
      const slot = slotByTarget.get(toKey) ?? 0;
      edgeFanInSlot.set(i, slot);
      slotByTarget.set(toKey, slot + 1);
    }
  });

  const layoutEdges = state.edges
    .map((e, i) => {
      const from = idToNode.get(e.from as unknown as string);
      const to = idToNode.get(e.to as unknown as string);
      if (!from || !to) return null;
      const fp = positions.get(e.from as unknown as string);
      const tp = positions.get(e.to as unknown as string);
      if (!fp || !tp) return null;
      const x1 = fp.x + NODE_W;
      const y1 = fp.y + NODE_H / 2;
      const x2 = tp.x;
      const y2 = tp.y + NODE_H / 2;
      const toKey = e.to as unknown as string;
      const N = fanInCount.get(toKey) ?? 0;
      const slot = edgeFanInSlot.get(i);
      if (N > 1 && slot !== undefined) {
        // Space the incoming edges across the left edge
        // of the target so they don't overlap. With N
        // incoming edges, the slot-th one lands at
        // (slot+1)/(N+1) of the height. Cubic Bezier with
        // control points at the midpoint x-coordinate, at
        // the respective y — the curve smooths the turn.
        const y2FanIn = tp.y + (NODE_H * (slot + 1)) / (N + 1);
        const midX = x1 + (x2 - x1) * 0.5;
        const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2FanIn}, ${x2} ${y2FanIn}`;
        return { from, to, x1, y1, x2, y2: y2FanIn, path };
      }
      return { from, to, x1, y1, x2, y2 };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}
