// Operations tests. The contract: state derivations and mutations.
// `init` is exercised through composition, not in isolation, so
// those tests live in a separate init.test.ts once composition's
// tree-walking is wired.
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { human } from "@underwai/schema"
import {
  deserialize,
  findReadyNodes,
  findSubtree,
  getHumanFields,
  getNode,
  serialize,
} from "./operations.js"
import type { Edge, Node, WorkflowState } from "./types.js"
import { NodeKey, WorkflowId } from "./keys.js"

function makeState(): WorkflowState {
  const root: Node = {
    id: NodeKey("root"),
    kind: "root",
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
    actor: "system",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
  const a: Node = {
    id: NodeKey("root.a"),
    kind: "a",
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
    actor: "system",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
  const b: Node = {
    id: NodeKey("root.b"),
    kind: "b",
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "paused", pausedAt: "2026-06-07T00:00:00.000Z" },
    actor: "system",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
  const edges: Edge[] = [
    { from: NodeKey("root"), to: NodeKey("root.a") },
    { from: NodeKey("root"), to: NodeKey("root.b") },
  ]
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: { root: root, "root.a": a, "root.b": b },
    edges,
    edgesByTarget: {
      [NodeKey("root.a")]: [edges[0]!],
      [NodeKey("root.b")]: [edges[1]!],
    },
    edgesByFrom: {
      [NodeKey("root")]: edges,
    },
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }
}

describe("getNode()", () => {
  it("returns the node with the given key", () => {
    const state = makeState()
    const n = getNode(state, NodeKey("root.a"))
    expect(n.kind).toBe("a")
  })

  it("throws if the key is not in the state", () => {
    const state = makeState()
    expect(() => getNode(state, NodeKey("missing"))).toThrow()
  })
})

describe("serialize()/deserialize()", () => {
  it("roundtrips the workflow state", () => {
    const state = makeState()
    const json = serialize(state)
    const restored = deserialize(json)
    expect(restored.id).toBe(state.id)
    expect(restored.nodes["root.a"]?.kind).toBe("a")
    expect(restored.edges.length).toBe(2)
  })

  it("recomputes edgesByTarget and edgesByFrom on deserialize", () => {
    const state = makeState()
    // Strip the derived fields from the serialized form.
    const json = serialize(state)
    const restored = deserialize(json)
    const aTarget = (restored.edgesByTarget as Record<string, ReadonlyArray<Edge>>)[
      "root.a"
    ]
    const fromRoot = (restored.edgesByFrom as Record<string, ReadonlyArray<Edge>>)[
      "root"
    ]
    expect(aTarget).toBeDefined()
    expect(aTarget?.length).toBe(1)
    expect(fromRoot).toBeDefined()
    expect(fromRoot?.length).toBe(2)
  })
})

describe("findReadyNodes()", () => {
  it("returns the root when its upstream is empty (always ready if pending/stale)", () => {
    const state = makeState()
    const ready = findReadyNodes(state)
    expect(ready).toContain(NodeKey("root"))
  })

  it("excludes paused nodes", () => {
    const state = makeState()
    const ready = findReadyNodes(state)
    expect(ready).not.toContain(NodeKey("root.b"))
  })

  it("returns ready nodes in dependency order", () => {
    const state = makeState()
    // root is upstream of both a and b; root is ready.
    // a is pending with one upstream (root) — once root is "resolved" it would be ready,
    // but root is pending here too, so a is NOT ready.
    const ready = findReadyNodes(state)
    expect(ready).toEqual([NodeKey("root")])
  })

  it("includes stale nodes", () => {
    const state = makeState()
    const root = state.nodes[NodeKey("root") as unknown as string]!
    root.status = { kind: "stale" }
    const ready = findReadyNodes(state)
    expect(ready).toContain(NodeKey("root"))
  })

  it("returns multiple ready nodes when upstream is satisfied", () => {
    const state = makeState()
    const root = state.nodes[NodeKey("root") as unknown as string]!
    root.status = {
      kind: "resolved",
      finalOutput: undefined,
      resolvedAt: "2026-06-07T00:00:00.000Z",
    }
    const ready = findReadyNodes(state)
    // a is now ready (its upstream, root, is resolved). b is paused, excluded.
    expect(ready).toContain(NodeKey("root.a"))
    expect(ready).not.toContain(NodeKey("root.b"))
  })
})

describe("findSubtree()", () => {
  it("returns the root and all its descendants", () => {
    const state = makeState()
    const subtree = findSubtree(state, NodeKey("root"))
    expect(subtree.has(NodeKey("root"))).toBe(true)
    expect(subtree.has(NodeKey("root.a"))).toBe(true)
    expect(subtree.has(NodeKey("root.b"))).toBe(true)
  })

  it("returns just the root when it has no descendants", () => {
    const state = makeState()
    const subtree = findSubtree(state, NodeKey("root.a"))
    expect(subtree.size).toBe(1)
    expect(subtree.has(NodeKey("root.a"))).toBe(true)
  })
})

describe("getHumanFields()", () => {
  it("returns an empty map for a plain schema", () => {
    const state = makeState()
    const node: Node = { ...state.nodes["root"]!, inputSchema: z.object({ x: z.string() }) }
    const fields = getHumanFields(node)
    expect(fields.size).toBe(0)
  })

  it("returns the human-mode map for a schema with human-marked fields", () => {
    const state = makeState()
    const schema = z.object({
      name: human(z.string()),
      age: z.number(),
      email: human(z.string()).verified(),
    })
    const node: Node = { ...state.nodes["root"]!, inputSchema: schema }
    const fields = getHumanFields(node)
    expect(fields.get("name")).toBe("writeable")
    expect(fields.get("email")).toBe("verified")
    expect(fields.has("age")).toBe(false)
  })

  it("handles a top-level human-marked primitive", () => {
    const state = makeState()
    const node: Node = {
      ...state.nodes["root"]!,
      inputSchema: human(z.string()),
    }
    const fields = getHumanFields(node)
    expect(fields.get("(root)")).toBe("writeable")
  })
})
