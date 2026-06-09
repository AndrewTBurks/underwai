// Composition API tests. The contract: workflow() returns a
// builder; run(node) creates the root and returns a
// ChainBuilder; chain() adds a child; build() returns a
// TypedTree with the path map; view() reads a typed node.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Effect } from "effect";
import { node, workflow } from "./composition.js";
import { init } from "./operations.js";
import { human } from "@underwai/schema";
import { NodeKey, WorkflowId } from "./keys.js";

const noop = ((_input: unknown) => Effect.succeed(undefined)) as never;

describe("workflow().run()", () => {
  it("build() returns a tree with root path", () => {
    const built = workflow()
      .run(node({ kind: "root", schema: z.string(), program: noop }))
      .build();
    const state = init(built.tree, WorkflowId("wf-1"));
    expect(state.nodes.get(NodeKey("root"))?.kind).toBe("root");
  });
});

describe("chain() — direct match", () => {
  it("chains root -> a -> b with paths root, root.a, root.a.b", () => {
    const built = workflow()
      .run(node({ kind: "root", schema: z.string(), program: noop }))
      .chain(node({ kind: "a", schema: z.string(), program: noop }))
      .chain(node({ kind: "b", schema: z.string(), program: noop }))
      .build();
    const state = init(built.tree, WorkflowId("wf-2"));
    expect([...state.nodes.keys()].sort()).toEqual([
      "root",
      "root.a",
      "root.a.b",
    ]);
  });
});

describe("chain() — bridge overload", () => {
  it("records the bridge on the edge for typed transform", () => {
    const bridge = (x: number): number => x;
    const built = workflow()
      .run(node({ kind: "root", schema: z.number(), program: noop }))
      .chain(
        bridge,
        node({ kind: "doubled", schema: z.number(), program: noop }),
      )
      .build();
    const state = init(built.tree, WorkflowId("wf-3"));
    expect(state.edges[0]?.bridge).toBe(bridge);
  });
});

describe("view() — typed access", () => {
  it("returns a typed view of a node by key", () => {
    const built = workflow()
      .run(
        node({
          kind: "parse",
          schema: z.string(),
          program: (s: string) => Effect.succeed(s),
        }),
      )
      .chain(
        (s: string) => s.trim().toUpperCase(),
        node({
          kind: "display",
          schema: z.string(),
          program: (s: string) => Effect.succeed(s),
        }),
      )
      .build();
    const state = init(built.tree, WorkflowId("wf-view"));
    const display = built.view(state, "root.display");
    expect(display.status.kind).toBe("pending");
  });
});

describe("node() — schema-driven", () => {
  it("infers T from a Zod schema (no casts needed)", () => {
    // The program is typed as (input: { name: string }) — no
    // cast. The return type is narrowed to string by the
    // outputSchema.
    const def = node({
      kind: "ask",
      schema: z.object({ name: z.string() }),
      outputSchema: z.string(),
      program: (input: { name: string }) => Effect.succeed(input.name),
    });
    expect(def.kind).toBe("ask");
  });

  it("accepts a human-marked schema (verified or writeable)", () => {
    const writeable = human(z.string());
    const def = node({
      kind: "name",
      schema: writeable,
      program: (s: string) => Effect.succeed(s),
    });
    expect(def.kind).toBe("name");
  });
});
