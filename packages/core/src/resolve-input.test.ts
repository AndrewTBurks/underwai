// Tests for resolveInput: walks the incoming edges for a node,
// applies each bridge to the upstream's resolved output, and
// returns the final input value.
import { describe, expect, it } from "vitest";
import {
  init,
  node,
  resolveInput,
  serialize,
  deserialize,
  workflow,
  WorkflowId,
  type Edge,
  type Node,
  type WorkflowState,
  NodeKey,
} from "@underwai/core";
import { z } from "zod";
import { Effect } from "effect";

const noop = (_input: unknown) => Effect.succeed(undefined as never);

function markResolvedLocal(
  state: WorkflowState,
  nodeId: NodeKey,
  finalOutput: unknown,
  now: string,
): WorkflowState {
  const node = state.nodes.get(nodeId);
  if (!node) return state;
  const updated: Node = {
    ...node,
    status: { kind: "resolved", finalOutput, resolvedAt: now },
    updatedAt: now,
  };
  return {
    ...state,
    nodes: new Map(state.nodes).set(nodeId, updated),
  };
}

describe("resolveInput", () => {
  it("returns the upstream's resolved output through a bridge", () => {
    const { tree } = workflow()
      .run(node({ kind: "root", schema: z.number(), program: noop }))
      .chain((out: number) => out * 2, node({ kind: "doubled", schema: z.number(), program: noop }))
      .build();
    const state = init(tree, WorkflowId("wf-bridge"));
    const withRoot = markResolvedLocal(state, NodeKey("root"), 21, new Date().toISOString());
    expect(resolveInput(withRoot, NodeKey("root.doubled"))).toBe(42);
  });

  it("returns undefined when the upstream is not resolved yet", () => {
    const { tree } = workflow()
      .run(node({ kind: "root", schema: z.number(), program: noop }))
      .chain((out: number) => out, node({ kind: "child", schema: z.number(), program: noop }))
      .build();
    const state = init(tree, WorkflowId("wf-pending"));
    expect(resolveInput(state, NodeKey("root.child"))).toBeUndefined();
  });

  it("returns the upstream's output directly when no bridge is set", () => {
    const { tree } = workflow()
      .run(node({ kind: "root", schema: z.string(), program: noop }))
      .chain(node({ kind: "child", schema: z.string(), program: noop }))
      .build();
    const state = init(tree, WorkflowId("wf-direct"));
    const withRoot = markResolvedLocal(state, NodeKey("root"), "hello", new Date().toISOString());
    expect(resolveInput(withRoot, NodeKey("root.child"))).toBe("hello");
  });

  it("joins multiple upstreams into an object input", () => {
    // Hand-build a state with two upstreams and a join node.
    const { tree } = workflow()
      .run(node({ kind: "a", schema: z.number(), program: noop }))
      .chain(node({ kind: "join", schema: z.unknown(), program: noop }))
      .build();
    const state = init(tree, WorkflowId("wf-join"));
    const joinKey = NodeKey("root.join");
    const extraEdge: Edge = {
      from: NodeKey("root.b"),
      to: joinKey,
    };
    const withB: WorkflowState = {
      ...state,
      nodes: new Map(state.nodes).set(NodeKey("root.b"), {
        id: NodeKey("root.b"),
        kind: "b",
        inputSchema: z.unknown(),
        input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
        outputSchema: z.unknown(),
        status: {
          kind: "resolved",
          finalOutput: 20,
          resolvedAt: new Date().toISOString(),
        },
        actor: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      edges: [...state.edges, extraEdge],
      edgesByTarget: new Map(state.edgesByTarget).set(joinKey, [
        ...(state.edgesByTarget.get(joinKey) ?? []),
        extraEdge,
      ]),
    };
    const withA = markResolvedLocal(withB, NodeKey("root"), 1, new Date().toISOString());
    const result = resolveInput(withA, joinKey) as Record<string, unknown>;
    expect(result[NodeKey("root.b") as unknown as string]).toBe(20);
  });
});

describe("serialize()/deserialize()", () => {
  it("roundtrips a workflow state through JSON", () => {
    const { tree } = workflow()
      .run(node({ kind: "root", schema: z.string(), program: noop }))
      .chain(node({ kind: "child", schema: z.string(), program: noop }))
      .build();
    const state = init(tree, WorkflowId("wf-roundtrip"));
    const json = serialize(state);
    const restored = deserialize(json);
    expect(restored.id).toBe(state.id);
    expect(restored.nodes.get(NodeKey("root"))?.kind).toBe("root");
    expect(restored.nodes.get(NodeKey("root.child"))?.kind).toBe("child");
  });
});
