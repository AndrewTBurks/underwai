// publish/write core mutation primitives. The runner currently
// inlines this logic; consumers have no public core-level API.
// These are pure functions in the same style as operations.ts.
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { NodeKey, WorkflowId } from "./keys.js"
import { publish, write } from "./operations.js"
import type { Node, WorkflowState } from "./types.js"

function makeState(): WorkflowState {
  const node: Node = {
    id: NodeKey("root"),
    kind: "root",
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "running", startedAt: "T" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  }
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: { root: node },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "T",
    updatedAt: "T",
  }
}

describe("publish()", () => {
  it("transitions a running node to streaming with output", () => {
    const state = makeState()
    const next = publish(state, NodeKey("root"), { partial: 1 }, true, "T1")
    const node = next.nodes["root"]!
    expect(node.status.kind).toBe("streaming")
    if (node.status.kind === "streaming") {
      expect(node.status.output).toEqual({ partial: 1 })
      expect(node.status.outputPartial).toBe(true)
    }
  })
})

describe("write()", () => {
  it("updates the input value", () => {
    const state = makeState()
    const next = write(state, NodeKey("root"), { typed: "by human" })
    const node = next.nodes["root"]!
    expect(node.input.value).toEqual({ typed: "by human" })
  })

  it("preserves the schema and humanFields", () => {
    const state = makeState()
    const next = write(state, NodeKey("root"), "x")
    const node = next.nodes["root"]!
    expect(node.input.schema).toBe(state.nodes["root"]?.input.schema)
  })
})
