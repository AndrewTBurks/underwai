// init() tests. The contract: a CompositionTree (root + defs map
// + edges) becomes a WorkflowState with nodes, edgesByTarget,
// edgesByFrom, all nodes marked pending.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { z } from "zod";
import { chain, compose, run } from "./composition.js";
import type { NodeDefinition } from "./composition.js";
import { init } from "./operations.js";
import { WorkflowId } from "./keys.js";

function def(kind: string): NodeDefinition<unknown> {
  const program = ((_input: unknown) => Effect.succeed(undefined)) as never;
  return {
    kind,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    program,
  };
}

describe("init()", () => {
  it("builds a single-node WorkflowState from a tree with just the root", () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-1"));
    expect(state.id).toBe(WorkflowId("wf-1"));
    expect(Object.keys(state.nodes)).toEqual(["root"]);
    expect(state.nodes["root"]?.status.kind).toBe("pending");
    expect(state.nodes["root"]?.kind).toBe("root");
    expect(state.edges).toEqual([]);
  });

  it("builds a 3-node WorkflowState from a tree with root -> a -> b", () => {
    const { tree } = compose(() => {
      const root = run(def("root"));
      const a = chain(root, def("a"));
      const b = chain(a, def("b"));
      return b;
    });
    const state = init(tree, WorkflowId("wf-2"));
    expect(Object.keys(state.nodes).toSorted()).toEqual(["root", "root.a", "root.a.b"]);
    expect(state.nodes["root.a.b"]?.status.kind).toBe("pending");
  });

  it("records edges with bridges for the bridge-overload chain", () => {
    const bridge = (x: unknown) => x;
    const { tree } = compose(() => {
      const root = run(def("root"));
      const a = chain(root, bridge, def("a"));
      return a;
    });
    const state = init(tree, WorkflowId("wf-3"));
    expect(state.edges.length).toBe(1);
    expect(state.edges[0]?.bridge).toBe(bridge);
  });

  it("computes edgesByTarget and edgesByFrom", () => {
    const { tree } = compose(() => {
      const root = run(def("root"));
      const a = chain(root, def("a"));
      return a;
    });
    const state = init(tree, WorkflowId("wf-4"));
    expect(state.edgesByFrom["root" as never]?.length).toBe(1);
    expect(state.edgesByTarget["root.a" as never]?.length).toBe(1);
  });
});
