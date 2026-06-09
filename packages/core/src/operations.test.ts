// Operations tests. The contract: state derivations and mutations
// on a Map-keyed WorkflowState.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { human } from "@underwai/schema";
import {
  deserialize,
  findReadyNodes,
  findSubtree,
  getHumanFields,
  getNode,
  serialize,
  topologicalLevels,
} from "./operations.js";
import type { Edge, Node, WorkflowState } from "./types.js";
import { NodeKey, WorkflowId } from "./keys.js";

function makeState(): WorkflowState {
  const make = (kind: string, status: Node["status"] = { kind: "pending" }): Node => ({
    id: NodeKey(kind === "root" ? "root" : `root.${kind === "a" ? "a" : "b"}`),
    kind: kind === "root" ? "root" : kind,
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status,
    actor: "system",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  });
  const root = make("root");
  const a = make("a");
  const b = make("b", { kind: "paused", pausedAt: "2026-06-07T00:00:00.000Z" });
  const edges: Edge[] = [
    { from: NodeKey("root"), to: NodeKey("root.a") },
    { from: NodeKey("root"), to: NodeKey("root.b") },
  ];
  const nodes = new Map<NodeKey, Node>();
  nodes.set(NodeKey("root"), root);
  nodes.set(NodeKey("root.a"), a);
  nodes.set(NodeKey("root.b"), b);
  const edgesByTarget = new Map<NodeKey, ReadonlyArray<Edge>>();
  edgesByTarget.set(NodeKey("root.a"), [edges[0]!]);
  edgesByTarget.set(NodeKey("root.b"), [edges[1]!]);
  const edgesByFrom = new Map<NodeKey, ReadonlyArray<Edge>>();
  edgesByFrom.set(NodeKey("root"), edges);
  return {
    id: WorkflowId("wf-1"),
    defs: new Map(),
    version: 1,
    status: "running",
    nodes,
    edges,
    edgesByTarget,
    edgesByFrom,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  };
}

describe("getNode()", () => {
  it("returns the node with the given key", () => {
    const state = makeState();
    const n = getNode(state, NodeKey("root.a"));
    expect(n.kind).toBe("a");
  });

  it("throws if the key is not in the state", () => {
    const state = makeState();
    expect(() => getNode(state, NodeKey("missing"))).toThrow();
  });
});

describe("serialize()/deserialize()", () => {
  it("roundtrips the workflow state", () => {
    const state = makeState();
    const json = serialize(state);
    const restored = deserialize(json);
    expect(restored.id).toBe(state.id);
    expect(restored.nodes.get(NodeKey("root.a"))?.kind).toBe("a");
    expect(restored.edges.length).toBe(2);
  });
});

describe("findReadyNodes()", () => {
  it("returns the root when its upstream is empty (always ready if pending/stale)", () => {
    const state = makeState();
    const ready = findReadyNodes(state);
    expect(ready).toContain(NodeKey("root"));
  });

  it("excludes paused nodes", () => {
    const state = makeState();
    const ready = findReadyNodes(state);
    expect(ready).not.toContain(NodeKey("root.b"));
  });

  it("returns ready nodes in dependency order", () => {
    const state = makeState();
    const ready = findReadyNodes(state);
    expect(ready).toEqual([NodeKey("root")]);
  });

  it("includes stale nodes", () => {
    const state = makeState();
    const root = state.nodes.get(NodeKey("root"))!;
    root.status = { kind: "stale" };
    const ready = findReadyNodes(state);
    expect(ready).toContain(NodeKey("root"));
  });

  it("returns multiple ready nodes when upstream is satisfied", () => {
    const state = makeState();
    const root = state.nodes.get(NodeKey("root"))!;
    root.status = {
      kind: "resolved",
      finalOutput: undefined,
      resolvedAt: "2026-06-07T00:00:00.000Z",
    };
    const ready = findReadyNodes(state);
    expect(ready).toContain(NodeKey("root.a"));
    expect(ready).not.toContain(NodeKey("root.b"));
  });
});

describe("topologicalLevels()", () => {
  it("places each node of a linear chain on its own level", () => {
    // root → a → b → c
    const state = makeChain(["root", "root.a", "root.a.b", "root.a.b.c"]);
    const levels = topologicalLevels(state);
    expect(levels.length).toBe(4);
    expect(levels[0]).toEqual([NodeKey("root")]);
    expect(levels[1]).toEqual([NodeKey("root.a")]);
    expect(levels[2]).toEqual([NodeKey("root.a.b")]);
    expect(levels[3]).toEqual([NodeKey("root.a.b.c")]);
  });

  it("groups diamond siblings on the same level", () => {
    // root → left, right → join
    const state = makeDiamond();
    const levels = topologicalLevels(state);
    expect(levels.length).toBe(3);
    expect(levels[0]).toEqual([NodeKey("root")]);
    // siblings sorted by id (string compare): "root.left" < "root.right"
    expect(levels[1]).toEqual([NodeKey("root.left"), NodeKey("root.right")]);
    expect(levels[2]).toEqual([NodeKey("root.join")]);
  });

  it("treats disconnected nodes as level 0", () => {
    // island1 → island1.child, with island2 having no edges
    const state = makeDisconnected();
    const levels = topologicalLevels(state);
    // Two roots at level 0 (sorted by id), child at level 1.
    const lvl0 = levels[0]!;
    expect(lvl0).toContain(NodeKey("island1"));
    expect(lvl0).toContain(NodeKey("island2"));
    expect(lvl0.length).toBe(2);
    expect(levels[1]).toEqual([NodeKey("island1.child")]);
  });
});

function makeChain(keys: string[]): WorkflowState {
  const nodes = new Map<NodeKey, Node>();
  for (const k of keys) {
    nodes.set(NodeKey(k), {
      id: NodeKey(k),
      kind: "x",
      inputSchema: z.unknown(),
      input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
      outputSchema: z.unknown(),
      status: { kind: "pending" },
      actor: "system",
      createdAt: "T",
      updatedAt: "T",
    });
  }
  const edges: Edge[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    edges.push({ from: NodeKey(keys[i]!), to: NodeKey(keys[i + 1]!) });
  }
  return {
    id: WorkflowId("wf-chain"),
    defs: new Map(),
    version: 1,
    status: "pending",
    nodes,
    edges,
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    createdAt: "T",
    updatedAt: "T",
  };
}

function makeDiamond(): WorkflowState {
  return makeChainLike([
    ["root"],
    ["root.left", "root.right"],
    ["root.join"],
  ], [
    { from: "root", to: "root.left" },
    { from: "root", to: "root.right" },
    { from: "root.left", to: "root.join" },
    { from: "root.right", to: "root.join" },
  ]);
}

function makeDisconnected(): WorkflowState {
  return makeChainLike([
    ["island1", "island2"],
    ["island1.child"],
  ], [
    { from: "island1", to: "island1.child" },
  ], ["island2"]);
}

function makeChainLike(
  _byLevel: string[][],
  edges: Array<{ from: string; to: string }>,
  extraNodes: string[] = [],
): WorkflowState {
  const allKeys = new Set<string>();
  for (const e of edges) {
    allKeys.add(e.from);
    allKeys.add(e.to);
  }
  for (const k of extraNodes) allKeys.add(k);
  const nodes = new Map<NodeKey, Node>();
  for (const k of allKeys) {
    nodes.set(NodeKey(k), {
      id: NodeKey(k),
      kind: "x",
      inputSchema: z.unknown(),
      input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
      outputSchema: z.unknown(),
      status: { kind: "pending" },
      actor: "system",
      createdAt: "T",
      updatedAt: "T",
    });
  }
  return {
    id: WorkflowId("wf"),
    defs: new Map(),
    version: 1,
    status: "pending",
    nodes,
    edges: edges.map((e) => ({ from: NodeKey(e.from), to: NodeKey(e.to) })),
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("findSubtree()", () => {
  it("returns the root and all its descendants", () => {
    const state = makeState();
    const subtree = findSubtree(state, NodeKey("root"));
    expect(subtree.has(NodeKey("root"))).toBe(true);
    expect(subtree.has(NodeKey("root.a"))).toBe(true);
    expect(subtree.has(NodeKey("root.b"))).toBe(true);
  });

  it("returns just the root when it has no descendants", () => {
    const state = makeState();
    const subtree = findSubtree(state, NodeKey("root.a"));
    expect(subtree.size).toBe(1);
    expect(subtree.has(NodeKey("root.a"))).toBe(true);
  });
});

describe("getHumanFields()", () => {
  it("returns an empty map for a plain schema", () => {
    const state = makeState();
    const node: Node = { ...state.nodes.get(NodeKey("root"))!, inputSchema: z.object({ x: z.string() }) };
    const fields = getHumanFields(node);
    expect(fields.size).toBe(0);
  });

  it("returns the human-mode map for a schema with human-marked fields", () => {
    const state = makeState();
    const schema = z.object({
      name: human(z.string()),
      age: z.number(),
      email: human(z.string()).verified(),
    });
    const node: Node = { ...state.nodes.get(NodeKey("root"))!, inputSchema: schema };
    const fields = getHumanFields(node);
    expect(fields.get("name")).toBe("writeable");
    expect(fields.get("email")).toBe("verified");
    expect(fields.has("age")).toBe(false);
  });

  it("handles a top-level human-marked primitive", () => {
    const state = makeState();
    const node: Node = {
      ...state.nodes.get(NodeKey("root"))!,
      inputSchema: human(z.string()),
    };
    const fields = getHumanFields(node);
    expect(fields.get("(root)")).toBe("writeable");
  });
});
