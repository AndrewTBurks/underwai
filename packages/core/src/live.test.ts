// LiveSubscriptionRegistry tests. The contract: register/notify
// fans out to subscribers. Pattern registration gets the full
// state and computes the matched set internally.
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { LiveSubscriptionRegistry } from "./live.js"
import { NodeKey, WorkflowId } from "./keys.js"
import type { Node, WorkflowState } from "./types.js"

function makeState(): WorkflowState {
  const node: Node = {
    id: NodeKey("root"),
    kind: "root",
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
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

describe("LiveSubscriptionRegistry", () => {
  it("calls the registered callback on every notify", () => {
    const r = new LiveSubscriptionRegistry()
    let count = 0
    r.register(NodeKey("root"), () => {
      count += 1
    })
    r.notify(makeState())
    r.notify(makeState())
    expect(count).toBe(2)
  })

  it("unsubscribe stops further notifications", () => {
    const r = new LiveSubscriptionRegistry()
    let count = 0
    const unsub = r.register(NodeKey("root"), () => {
      count += 1
    })
    r.notify(makeState())
    unsub()
    r.notify(makeState())
    expect(count).toBe(1)
  })

  it("registerPattern fans out to all pattern subscribers", () => {
    const r = new LiveSubscriptionRegistry()
    let count = 0
    r.registerPattern("*", (_s, _m) => {
      count += 1
    })
    r.notify(makeState())
    expect(count).toBe(1)
  })
})
