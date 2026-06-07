import { describe, expect, it } from "vitest"
import { subscribe, subscribeSet } from "./subscribe.js"
import type { Node, WorkflowState } from "@underwai/core"
import { NodeKey, WorkflowId } from "@underwai/core"

function makeState(): WorkflowState {
  const make = (k: string): Node => ({
    id: NodeKey(k),
    kind: k,
    inputSchema: undefined as never,
    input: { value: undefined, schema: undefined as never, humanFields: new Map() },
    outputSchema: undefined as never,
    status: { kind: "pending" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  })
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: {
      root: make("root"),
      "root.a": make("root.a"),
      "root.b": make("root.b"),
      "root.a.x": make("root.a.x"),
    },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "T",
    updatedAt: "T",
  }
}

describe("subscribe()", () => {
  it("invokes the callback with the matching node", () => {
    const state = makeState()
    let captured: Node | undefined
    subscribe(state, NodeKey("root.a"), (n) => {
      captured = n
    })
    expect(captured?.kind).toBe("root.a")
  })

  it("does not invoke the callback when the key is missing", () => {
    const state = makeState()
    let called = false
    subscribe(state, NodeKey("missing"), () => {
      called = true
    })
    expect(called).toBe(false)
  })
})

describe("subscribeSet()", () => {
  it("'*' matches every node keyed by full key", () => {
    const state = makeState()
    let captured: Record<string, Node> = {}
    subscribeSet(state, "*", (n) => {
      captured = n
    })
    expect(Object.keys(captured).length).toBe(4)
    expect(captured["root.a"]?.kind).toBe("root.a")
  })

  it("'prefix.*' matches direct children keyed by relative path", () => {
    const state = makeState()
    let captured: Record<string, Node> = {}
    subscribeSet(state, "root.*", (n) => {
      captured = n
    })
    expect(Object.keys(captured).sort()).toEqual(["a", "b"])
    expect(captured["a"]?.kind).toBe("root.a")
    // "root.a.x" is not a direct child of "root" — has to match a
    // deeper pattern.
    expect(captured["a.x"]).toBeUndefined()
  })

  it("'prefix.' (no wildcard) matches direct children keyed by relative path", () => {
    const state = makeState()
    let captured: Record<string, Node> = {}
    subscribeSet(state, "root.", (n) => {
      captured = n
    })
    expect(Object.keys(captured).sort()).toEqual(["a", "b"])
    expect(captured["a.x"]).toBeUndefined()
  })
})
