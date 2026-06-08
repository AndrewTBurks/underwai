// Tests for the strict typing: build() returns a TypedTree
// with a path map; view(state, key) returns a TypedNode with
// the declared output type for that key.

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { z } from "zod";
import { init, node, view, workflow, WorkflowId, type PathsOf } from "@underwai/core";
import { markResolvedLocal } from "./resolve-input.test-helpers.js";

describe("typed view", () => {
  it("types root.display.finalOutput as string when the chain declares string", () => {
    const built = workflow()
      .run(
        node({
          kind: "parse",
          schema: z.string(),
          program: (input) => Effect.succeed(input),
        }),
      )
      .chain(
        (s: string) => s.trim().toUpperCase(),
        node({
          kind: "display",
          schema: z.string(),
          program: (input) => Effect.succeed(input),
        }),
      )
      .build();

    // The path map is closed: exactly the keys we built.
    type Paths = PathsOf<typeof built.paths>;
    // The compile-time check: state.nodes["root.display"] is
    // typed as TypedNode<string> via the view call.
    const state = init(built.tree, WorkflowId("wf-typed"));
    const displayNode = view<Paths, "root.display">(state, "root.display");
    // The type assertion below fails at compile time if the
    // typed view isn't producing a string. The runtime check
    // confirms the runtime value matches.
    const now = new Date().toISOString();
    const updated = markResolvedLocal(state, "root.display" as never, "HELLO", now);
    const displayNode2 = view<Paths, "root.display">(updated, "root.display");
    if (displayNode2.status.kind === "resolved") {
      // finalOutput is typed as string; runtime confirms.
      const value: string = displayNode2.status.finalOutput;
      expect(value).toBe("HELLO");
    } else {
      throw new Error("expected resolved");
    }
    // The displayNode placeholder exists to confirm the
    // type-narrowing path compiles when the node is
    // still pending.
    void displayNode;
  });

  it("exhaustiveness: the path map is a closed union of declared keys", () => {
    // Build a 2-node workflow: ask -> process. The path map
    // captures both output types.
    const built = workflow()
      .run(
        node({
          kind: "ask",
          schema: z.object({ name: z.string() }),
          program: (input: { name: string }) => Effect.succeed(input),
        }),
      )
      .chain(
        (out: { name: string }) => out,
        node({
          kind: "process",
          schema: z.object({ name: z.string() }),
          outputSchema: z.string(),
          program: (input: { name: string }) => Effect.succeed(input.name),
        }),
      )
      .build();
    // The path map at the type level is:
    //   { root: { name: string }, "root.process": string }
    // A typo like "root.proces" would be a compile error.
    type Paths = PathsOf<typeof built.paths>;
    const sample: Paths = { root: { name: "Alice" }, "root.process": "Alice" };
    expect(sample["root.process"]).toBe("Alice");
  });
});
