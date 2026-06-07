// Mutations tests. The contract: each mutation takes a state and
// returns a new state. Per-status data is preserved (or absent
// per the variant).
import { describe, expect, it } from "vitest"
import {
  markFailed,
  markPaused,
  markResolved,
  markRunning,
  markStale,
  markStreaming,
  writeHumanInput,
} from "./mutations.js"
import type { Node, NodeStatus, WorkflowState } from "@underwai/core"
import { NodeKey, WorkflowId } from "@underwai/core"

function makeState(status: NodeStatus = { kind: "pending" }): WorkflowState {
  const root: Node = {
    id: NodeKey("root"),
    kind: "root",
    inputSchema: undefined as never,
    input: { value: undefined, schema: undefined as never, humanFields: new Map() },
    outputSchema: undefined as never,
    status,
    actor: "system",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: { root: root },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
}

describe("markRunning()", () => {
  it("transitions pending to running with startedAt", () => {
    const state = makeState()
    const next = markRunning(state, NodeKey("root"), "T")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("running")
    if (node.status.kind === "running") {
      expect(node.status.startedAt).toBe("T")
    }
  })
})

describe("markStreaming()", () => {
  it("transitions running to streaming with output", () => {
    const state = makeState({ kind: "running", startedAt: "T" })
    const next = markStreaming(state, NodeKey("root"), { partial: 1 }, true, "T2")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("streaming")
    if (node.status.kind === "streaming") {
      expect(node.status.output).toEqual({ partial: 1 })
      expect(node.status.outputPartial).toBe(true)
    }
  })
})

describe("markResolved()", () => {
  it("transitions to resolved with finalOutput and resolvedAt", () => {
    const state = makeState({ kind: "running", startedAt: "T" })
    const next = markResolved(state, NodeKey("root"), { done: true }, "T3")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("resolved")
    if (node.status.kind === "resolved") {
      expect(node.status.finalOutput).toEqual({ done: true })
      expect(node.status.resolvedAt).toBe("T3")
    }
  })
})

describe("markFailed()", () => {
  it("transitions to failed and sets workflow error", () => {
    const state = makeState({ kind: "running", startedAt: "T" })
    const err = { nodeId: NodeKey("root"), message: "boom" }
    const next = markFailed(state, NodeKey("root"), err, "T4")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("failed")
    if (node.status.kind === "failed") {
      expect(node.status.error.message).toBe("boom")
    }
    expect(next.status).toBe("failed")
    expect(next.error).toEqual(err)
  })
})

describe("markPaused()", () => {
  it("transitions to paused and sets workflow status to paused", () => {
    const state = makeState({ kind: "pending" })
    const next = markPaused(state, NodeKey("root"), "T5")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("paused")
    if (node.status.kind === "paused") {
      expect(node.status.pausedAt).toBe("T5")
    }
    expect(next.status).toBe("paused")
  })
})

describe("markStale()", () => {
  it("captures the previous output for re-derivation UX", () => {
    const state = makeState({
      kind: "resolved",
      finalOutput: "previous",
      resolvedAt: "T",
    })
    const next = markStale(state, NodeKey("root"), "T6")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("stale")
    if (node.status.kind === "stale") {
      expect(node.status.previousOutput).toBe("previous")
    }
  })
})

describe("writeHumanInput()", () => {
  it("updates input and marks the node stale with previous output", () => {
    const state = makeState({
      kind: "resolved",
      finalOutput: "old",
      resolvedAt: "T",
    })
    const next = writeHumanInput(state, NodeKey("root"), "new", "T7")
    const node = next.nodes["root"]!
    expect(node.input.value).toBe("new")
    expect(node.status.kind).toBe("stale")
  })

  it("is a no-op when the node is not in the state", () => {
    const state = makeState()
    const next = writeHumanInput(state, NodeKey("missing"), "x", "T8")
    expect(next).toBe(state)
  })
})
