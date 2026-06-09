// getHumanInputDisplay() tests. The contract: a discriminated union
// on source kind — literal / from_node / human. The lib exposes
// the source; the renderer decides the UX.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getHumanInputDisplay } from "./operations.js";
import { human } from "@underwai/schema";
import { NodeKey, WorkflowId } from "./keys.js";
import type { Edge, Node, WorkflowState } from "./types.js";

function makeNode(inputSchema: z.ZodTypeAny, input: unknown): Node {
  return {
    id: NodeKey("root"),
    kind: "root",
    inputSchema,
    input: { value: input, schema: inputSchema, humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  };
}

function makeState(
  nodes: Array<[NodeKey, Node]>,
  edges: Array<{ from: NodeKey; to: NodeKey }> = [],
): WorkflowState {
  const nodesMap = new Map<NodeKey, Node>();
  for (const [k, n] of nodes) nodesMap.set(k, n);
  const edgesArray: Edge[] = edges.map((e) => ({ from: e.from, to: e.to }));
  const edgesByTarget = new Map<NodeKey, ReadonlyArray<Edge>>();
  const edgesByFrom = new Map<NodeKey, ReadonlyArray<Edge>>();
  for (const e of edgesArray) {
    edgesByTarget.set(e.to, [...(edgesByTarget.get(e.to) ?? []), e]);
    edgesByFrom.set(e.from, [...(edgesByFrom.get(e.from) ?? []), e]);
  }
  return {
    id: WorkflowId("wf-1"),
    defs: new Map(),
    version: 1,
    status: "running",
    nodes: nodesMap,
    edges: edgesArray,
    edgesByTarget,
    edgesByFrom,
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("getHumanInputDisplay()", () => {
  it("returns 'literal' for a node with no incoming edges", () => {
    const node = makeNode(z.string(), "hello");
    const state = makeState([[NodeKey("root"), node]]);
    const display = getHumanInputDisplay(state, node);
    expect(display?.source).toBe("literal");
    if (display?.source === "literal") {
      expect(display.value).toBe("hello");
    }
  });

  it("returns 'from_node' for a node whose input came from an upstream node", () => {
    const upstream: Node = {
      ...makeNode(z.string(), "upstream value"),
      id: NodeKey("root.upstream"),
      status: { kind: "resolved", finalOutput: "upstream value", resolvedAt: "T" },
    };
    const downstream = makeNode(z.string(), "upstream value");
    const state = makeState(
      [
        [NodeKey("root.upstream"), upstream],
        [NodeKey("root"), downstream],
      ],
      [{ from: NodeKey("root.upstream"), to: NodeKey("root") }],
    );
    const display = getHumanInputDisplay(state, downstream);
    expect(display?.source).toBe("from_node");
    if (display?.source === "from_node") {
      expect(display.value).toBe("upstream value");
      expect(display.upstream).toBe(NodeKey("root.upstream"));
    }
  });

  it("returns 'human' for a node whose schema is human-marked and input is pending", () => {
    const node = makeNode(human(z.string()), undefined);
    const state = makeState([[NodeKey("root"), node]]);
    const display = getHumanInputDisplay(state, node);
    expect(display?.source).toBe("human");
    if (display?.source === "human") {
      expect(display.status).toBe("pending");
    }
  });

  it("returns 'human' with status 'set' for a human-marked schema with a value", () => {
    const node = makeNode(human(z.string()), "user typed this");
    const state = makeState([[NodeKey("root"), node]]);
    const display = getHumanInputDisplay(state, node);
    expect(display?.source).toBe("human");
    if (display?.source === "human") {
      expect(display.status).toBe("set");
      expect(display.value).toBe("user typed this");
    }
  });

  it("returns 'literal' for a verified human-marked schema (the value is locked in)", () => {
    const node = makeNode(human(z.string()).verified(), "verified value");
    const state = makeState([[NodeKey("root"), node]]);
    const display = getHumanInputDisplay(state, node);
    expect(display?.source).toBe("literal");
  });
});
