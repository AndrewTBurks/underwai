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
