// @underwai/runner — mutations.ts
//
// Pure state transitions on a WorkflowState. Each function takes a
// state and returns a new state (or the same state with a different
// node). No Effect, no async, no I/O. The runner calls these in
// sequence as the workflow progresses.
//
// All transitions on Node["status"] go through these functions.
// The transition rules are documented in .cns/architecture/node.md.

import type { Node, NodeStatus, WorkflowState } from "@underwai/core"

export function markRunning(
  state: WorkflowState,
  nodeId: Node["id"],
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "running", startedAt: now },
        updatedAt: now,
      },
    },
  }
}

export function markStreaming(
  state: WorkflowState,
  nodeId: Node["id"],
  output: unknown,
  partial: boolean,
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "streaming", output, outputPartial: partial },
        updatedAt: now,
      },
    },
  }
}

export function markResolved(
  state: WorkflowState,
  nodeId: Node["id"],
  finalOutput: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "resolved", finalOutput, resolvedAt: now },
        updatedAt: now,
      },
    },
  }
}

export function markFailed(
  state: WorkflowState,
  nodeId: Node["id"],
  error: Node["id"] extends never ? never : import("@underwai/core").SerializedError,
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  return {
    ...state,
    status: "failed",
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "failed", error, failedAt: now },
        updatedAt: now,
      },
    },
    error,
  }
}

export function markPaused(
  state: WorkflowState,
  nodeId: Node["id"],
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  // Per-node "paused" only. The workflow-level "paused" status
  // is a phantom slot (no transition into it) and was removed
  // in TASK-37. The workflow's own status stays as-is.
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "paused", pausedAt: now },
        updatedAt: now,
      },
    },
  }
}

// markStale: a node that needs to be re-derived. The "stale" status
// carries the previous output so the renderer can show "re-deriving".
// Per DEC-RUNNER-005, multiple writes coalesce: the most recent
// value wins.
export function markStale(
  state: WorkflowState,
  nodeId: Node["id"],
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  const previousOutput =
    node.status.kind === "resolved" ? node.status.finalOutput : undefined
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        status: { kind: "stale", previousOutput },
        updatedAt: now,
      },
    },
  }
}

// writeHumanInput: per TASK-A, mid-execution writeHumanInput marks
// the node stale, interrupts the in-flight Effect fiber, then
// re-runs with the new input. Here we mark stale; the runtime
// (runtime.ts) handles the fiber interrupt.
export function writeHumanInput(
  state: WorkflowState,
  nodeId: Node["id"],
  value: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes[nodeId as unknown as string]
  if (!node) return state
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId as unknown as string]: {
        ...node,
        input: { ...node.input, value },
        status: { kind: "stale", previousOutput: extractOutput(node.status) },
        updatedAt: now,
      },
    },
  }
}

function extractOutput(status: NodeStatus): unknown {
  if (status.kind === "resolved") return status.finalOutput
  if (status.kind === "streaming") return status.output
  return undefined
}
