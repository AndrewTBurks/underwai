// @underwai/runner — mutations.ts
//
// Pure state transitions on a WorkflowState. Each function takes a
// state and returns a new state (or the same state with a different
// node). No Effect, no async, no I/O. The runner calls these in
// sequence as the workflow progresses.
//
// All transitions on Node["status"] go through these functions.
// The transition rules are documented in .cns/architecture/node.md.

import type { Node, NodeStatus, SerializedError, WorkflowState } from "@underwai/core";

export function markRunning(state: WorkflowState, nodeId: Node["id"], now: string): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "running", startedAt: now },
      updatedAt: now,
    }),
  };
}

export function markStreaming(
  state: WorkflowState,
  nodeId: Node["id"],
  output: unknown,
  partial: boolean,
  now: string,
): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "streaming", output, outputPartial: partial },
      updatedAt: now,
    }),
  };
}

export function markResolved(
  state: WorkflowState,
  nodeId: Node["id"],
  finalOutput: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "resolved", finalOutput, resolvedAt: now },
      updatedAt: now,
    }),
  };
}

export function markFailed(
  state: WorkflowState,
  nodeId: Node["id"],
  error: Node["id"] extends never ? never : SerializedError,
  now: string,
): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  return {
    ...state,
    status: "failed",
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "failed", error, failedAt: now },
      updatedAt: now,
    }),
    error,
  };
}

export function markPaused(state: WorkflowState, nodeId: Node["id"], now: string): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "paused", pausedAt: now },
      updatedAt: now,
    }),
  };
}

// markStale: a node that needs to be re-derived. The "stale" status
// carries the previous output so the renderer can show "re-deriving".
// Per DEC-RUNNER-005, multiple writes coalesce: the most recent
// value wins.
export function markStale(state: WorkflowState, nodeId: Node["id"], now: string): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  const previousOutput = node.status.kind === "resolved" ? node.status.finalOutput : undefined;
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      status: { kind: "stale", previousOutput },
      updatedAt: now,
    }),
  };
}

// writeHumanInput: used by consumers to write a value into a
// human-paused node from outside the program. After a human
// clicks "send" in the UI, this is called to resume the node.
//
// Behavior:
// - If the node is paused (human waiting): mark it pending,
//   update the input.value, and return. The next rt.run() call
//   will dispatch it normally.
// - If the node is stale (downstream recomputation needed): mark
//   it stale with the new input. The downstream stale propagation
//   happens in the run loop when it re-derives from the changed
//   input.
// - If the node is resolved/streaming/running: mark it stale and
//   update the input.
//
// This replaces the prior single-behavior approach (always → stale).
// The paused → pending transition is the key one for the human
// "send to resume" use case. (TASK-46 follow-up.)
export function writeHumanInput(
  state: WorkflowState,
  nodeId: Node["id"],
  value: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;

  // Case 1: human node is paused — resume it directly.
  // This is the "send values to runtime" path: the human form
  // wrote a value, we update the input and flip the node back
  // to pending so the next run() dispatches it.
  if (node.status.kind === "paused") {
    return {
      ...state,
      nodes: new Map(state.nodes).set(nodeId, {
        ...node,
        input: { ...node.input, value },
        status: { kind: "pending" },
        updatedAt: now,
      }),
    };
  }

  // Case 2: node is stale — update input, keep stale.
  // Case 3: node is resolved/streaming/running — mark stale.
  const previousOutput = extractOutput(node.status);
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, {
      ...node,
      input: { ...node.input, value },
      status: { kind: "stale", previousOutput },
      updatedAt: now,
    }),
  };
}

function extractOutput(status: NodeStatus): unknown {
  if (status.kind === "resolved") return status.finalOutput;
  if (status.kind === "streaming") return status.output;
  return undefined;
}
