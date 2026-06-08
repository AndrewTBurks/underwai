// getHumanInputDisplay() tests. The contract: a discriminated union
// on source kind — literal / from_node / human. The lib exposes
// the source; the renderer decides the UX.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getHumanInputDisplay } from "./operations.js";
import { human } from "@underwai/schema";
import { NodeKey, WorkflowId } from "./keys.js";
import type { Node, WorkflowState } from "./types.js";

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
  nodes: Record<string, Node>,
  edges: Array<{ from: string; to: string }> = [],
): WorkflowState {
  const es: Array<{ from: NodeKey; to: NodeKey }> = edges.map((e) => ({
    from: NodeKey(e.from),
    to: NodeKey(e.to),
  }));
  const edgesByTarget: Record<string, Array<(typeof es)[number]>> = {};
  const edgesByFrom: Record<string, Array<(typeof es)[number]>> = {};
  for (const e of es) {
    const t = e.to as unknown as string;
    const f = e.from as unknown as string;
    (edgesByTarget[t] ??= []).push(e);
    (edgesByFrom[f] ??= []).push(e);
  }
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes,
    edges: es,
    edgesByTarget: edgesByTarget as never,
    edgesByFrom: edgesByFrom as never,
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("getHumanInputDisplay()", () => {
  it("returns 'literal' for a node with no incoming edges", () => {
    const node = makeNode(z.string(), "hello");
    const state = makeState({ root: node });
    const display = getHumanInputDisplay(state, node, "root");
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
    const state = makeState({ "root.upstream": upstream, root: downstream }, [
      { from: "root.upstream", to: "root" },
    ]);
    const display = getHumanInputDisplay(state, downstream, "root");
    expect(display?.source).toBe("from_node");
    if (display?.source === "from_node") {
      expect(display.value).toBe("upstream value");
      expect(display.upstream).toBe(NodeKey("root.upstream"));
    }
  });

  it("returns 'human' for a node whose schema is human-marked and input is pending", () => {
    const node = makeNode(human(z.string()), undefined);
    const state = makeState({ root: node });
    const display = getHumanInputDisplay(state, node, "root");
    expect(display?.source).toBe("human");
    if (display?.source === "human") {
      expect(display.status).toBe("pending");
    }
  });

  it("returns 'human' with status 'set' for a human-marked schema with a value", () => {
    const node = makeNode(human(z.string()), "user typed this");
    const state = makeState({ root: node });
    const display = getHumanInputDisplay(state, node, "root");
    expect(display?.source).toBe("human");
    if (display?.source === "human") {
      expect(display.status).toBe("set");
      expect(display.value).toBe("user typed this");
    }
  });

  it("returns 'literal' for a verified human-marked schema (the value is locked in)", () => {
    const node = makeNode(human(z.string()).verified(), "verified value");
    const state = makeState({ root: node });
    const display = getHumanInputDisplay(state, node, "root");
    expect(display?.source).toBe("literal");
  });
});
