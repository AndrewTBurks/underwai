// Composition API tests. The contract: composition returns NodeRef<P>
// with the path-derived key. The init() path is operations.ts; here
// we test the path derivation.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { all, chain, run, thenLoop } from "./composition.js";
import type { NodeDefinition } from "./composition.js";

const passthrough = (_: unknown) => undefined as never;
const def = (kind: string): NodeDefinition<unknown, unknown> => ({
  kind,
  inputSchema: z.unknown(),
  outputSchema: z.unknown(),
  program: passthrough,
});

describe("run()", () => {
  it("returns a NodeRef with key 'root'", () => {
    const r = run(def("root"));
    expect(r.key).toBe("root");
  });
});

describe("chain() — direct match", () => {
  it("returns a NodeRef with key 'parent.child'", () => {
    const root = run(def("root"));
    const child = chain(root, def("fetch"));
    expect(child.key).toBe("root.fetch");
  });

  it("chains: root -> a -> b has key 'root.a.b'", () => {
    const root = run(def("root"));
    const a = chain(root, def("a"));
    const b = chain(a, def("b"));
    expect(b.key).toBe("root.a.b");
  });
});

describe("chain() — bridge overload", () => {
  it("returns the same path with a bridge function", () => {
    const root = run(def("root"));
    const child = chain(root, (x: unknown) => x, def("transform"));
    expect(child.key).toBe("root.transform");
  });
});

describe("all()", () => {
  it("object form returns a NodeRef with key 'parent.all'", () => {
    const root = run(def("root"));
    const a = chain(root, def("a"));
    const b = chain(root, def("b"));
    const merged = all(root, { a, b });
    expect(merged.key).toBe("root.all");
  });

  it("array form returns a NodeRef with key 'parent.all'", () => {
    const root = run(def("root"));
    const merged = all(root);
    expect(merged.key).toBe("root.all");
  });
});

describe("thenLoop()", () => {
  it("returns a NodeRef with key 'parent.<kind>'", () => {
    const root = run(def("root"));
    const family = thenLoop(
      root,
      (prev) => prev,
      (current) => current,
      "family",
    );
    expect(family.key).toBe("root.family");
  });
});
