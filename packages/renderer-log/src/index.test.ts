// @underwai/renderer-log tests. The contract: runLogRenderer
// subscribes to a registry; on every notify, it prints the
// current state. The consumer's getState is the source of truth.
import { describe, expect, it, beforeEach } from "vitest"
import { z } from "zod"
import { runLogRenderer, clearRegistry } from "./index.js"
import {
  LiveSubscriptionRegistry,
  NodeKey,
  WorkflowId,
} from "@underwai/core"
import type { Node, WorkflowState } from "@underwai/core"

function makeState(): WorkflowState {
  const make = (k: string): Node => ({
    id: NodeKey(k),
    kind: k,
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
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
      "root.a.b": make("root.a.b"),
    },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "T",
    updatedAt: "T",
  }
}

describe("renderer-log", () => {
  beforeEach(() => clearRegistry())

  it("runLogRenderer prints the initial state", () => {
    const registry = new LiveSubscriptionRegistry()
    const state = makeState()
    const lines: string[] = []
    runLogRenderer(registry, state, {
      print: (l) => lines.push(l),
      getState: () => state,
    })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("workflow wf-1 (running)")
    expect(lines[0]).toContain("root (pending)")
    expect(lines[0]).toContain("root.a (pending)")
    expect(lines[0]).toContain("root.a.b (pending)")
  })

  it("runLogRenderer prints indented output for nested nodes", () => {
    const registry = new LiveSubscriptionRegistry()
    const state = makeState()
    const lines: string[] = []
    runLogRenderer(registry, state, {
      print: (l) => lines.push(l),
      getState: () => state,
    })
    // root has 0 dots, root.a has 1 dot, root.a.b has 2 dots.
    const split = lines[0]!.split("\n")
    expect(split[1]).toMatch(/^root /)
    expect(split[2]).toMatch(/^  root\.a /)
    expect(split[3]).toMatch(/^    root\.a\.b /)
  })

  it("runLogRenderer re-renders on registry notify", () => {
    const registry = new LiveSubscriptionRegistry()
    const state = makeState()
    const lines: string[] = []
    runLogRenderer(registry, state, {
      print: (l) => lines.push(l),
      getState: () => state,
    })
    expect(lines.length).toBe(1)
    registry.notify(state)
    expect(lines.length).toBe(2)
  })
})
