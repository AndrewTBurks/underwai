import { describe, expect, expectTypeOf, it } from "vitest";
import { NodeKey, WorkflowId } from "./keys.js";

describe("NodeKey", () => {
  it("returns a branded string at the type level", () => {
    const k = NodeKey("root.x.y");
    expectTypeOf(k).toEqualTypeOf<NodeKey<"root.x.y">>();
  });

  it("preserves the path as a literal type parameter", () => {
    const a = NodeKey("a");
    const b = NodeKey("b.c");
    expectTypeOf(a).not.toEqualTypeOf<typeof b>();
  });

  it("is a string at runtime", () => {
    const k = NodeKey("root");
    expect(typeof k).toBe("string");
    expect(k).toBe("root");
  });
});

describe("WorkflowId", () => {
  it("is a string at runtime", () => {
    const id = WorkflowId("wf-1");
    expect(id).toBe("wf-1");
  });
});
