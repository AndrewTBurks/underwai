// init() tests. The contract: a CompositionTree (root + defs map
// + edges) becomes a WorkflowState with nodes, edgesByTarget,
// edgesByFrom, all nodes marked pending. The composition builder
// is the only public way to build a tree.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { z } from "zod";
import { node, workflow } from "./composition.js";
import { init, resolveInput } from "./operations.js";
import { NodeKey, WorkflowId } from "./keys.js";

function def(kind: string) {
  return node({
    kind,
    schema: z.unknown(),
    program: ((_input: unknown) => Effect.succeed(undefined)) as never,
  });
}

describe("init()", () => {
  it("builds a single-node WorkflowState from a tree with just the root", () => {
    const { tree } = workflow().run(def("root")).build();
    const state = init(tree, WorkflowId("wf-1"));
    expect(state.id).toBe(WorkflowId("wf-1"));
    expect(state.nodes.size).toBe(1);
    expect(state.nodes.get(NodeKey("root"))?.status.kind).toBe("pending");
    expect(state.nodes.get(NodeKey("root"))?.kind).toBe("root");
    expect(state.edges.length).toBe(0);
  });

  it("builds a 3-node WorkflowState from a tree with root -> a -> b", () => {
    const { tree } = workflow()
      .run(def("root"))
      .chain(def("a"))
      .chain(def("b"))
      .build();
    const state = init(tree, WorkflowId("wf-2"));
    expect([...state.nodes.keys()].sort()).toEqual([
      "root",
      "root.a",
      "root.a.b",
    ]);
    expect(state.nodes.get(NodeKey("root.a.b"))?.status.kind).toBe("pending");
  });

  it("records edges with bridges for the bridge-overload chain", () => {
    const bridge = (x: unknown) => x;
    const { tree } = workflow()
      .run(def("root"))
      .chain(bridge, def("a"))
      .build();
    const state = init(tree, WorkflowId("wf-3"));
    expect(state.edges.length).toBe(1);
    expect(state.edges[0]?.bridge).toBe(bridge);
  });

  it("populates edgesByTarget and edgesByFrom as Maps", () => {
    const { tree } = workflow().run(def("root")).chain(def("a")).build();
    const state = init(tree, WorkflowId("wf-4"));
    expect(state.edgesByFrom.size).toBeGreaterThan(0);
    expect(state.edgesByTarget.size).toBeGreaterThan(0);
  });
});

describe("resolveInput()", () => {
  it("returns the upstream's resolved output through a bridge", () => {
    const { tree } = workflow()
      .run(
        node({
          kind: "root",
          schema: z.number(),
          program: ((n: number) => Effect.succeed(n)) as never,
        }),
      )
      .chain(
        (out: number) => out * 2,
        node({
          kind: "doubled",
          schema: z.number(),
          program: ((n: number) => Effect.succeed(n)) as never,
        }),
      )
      .build();
    const state = init(tree, WorkflowId("wf-bridge"));
    const withRoot = markRoot(state, 21);
    expect(resolveInput(withRoot, NodeKey("root.doubled"))).toBe(42);
  });
});

// Local helper: mark the root as resolved with a value. Replaces
// the test-helper that lived at resolve-input.test-helpers.ts.
function markRoot(state: ReturnType<typeof init>, value: number) {
  const now = new Date().toISOString();
  const root = state.nodes.get(NodeKey("root"));
  if (!root) return state;
  const updated: typeof state = {
    ...state,
    nodes: new Map(state.nodes).set(NodeKey("root"), {
      ...root,
      status: { kind: "resolved", finalOutput: value, resolvedAt: now },
      updatedAt: now,
    }),
  };
  return updated;
}
