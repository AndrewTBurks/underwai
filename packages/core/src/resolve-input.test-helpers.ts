// Shared test helper: a copy of the runner's markResolved, used
// in core tests. The runner's version is internal; core has
// no mutation primitives per TASK-38.
import type { Node, NodeKey, WorkflowState } from "@underwai/core";

export function markResolvedLocal(
  state: WorkflowState,
  nodeId: NodeKey,
  finalOutput: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string];
  if (!node) return state;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "resolved", finalOutput, resolvedAt: now },
        updatedAt: now,
      } as Node,
    },
  };
}
