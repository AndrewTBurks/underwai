import { describe, expect, it } from "vitest";
import { subscribe, subscribeSet } from "./subscribe.js";
import type { Node } from "@underwai/core";
import { LiveSubscriptionRegistry, NodeKey, WorkflowId, init, node, workflow } from "@underwai/core";
import { z } from "zod";
import { Effect } from "effect";

function makeState() {
  // Build a real composition and run init() to get a
  // WorkflowState with defs attached. The transport
  // tests don't run the workflow — they just need a
  // valid state shape with the right node set.
  //
  // Composition: root -> a -> x, plus a separate
  // root -> b (joined onto the same root).
  // State nodes: root, root.a, root.a.x, root.b.
  const root = workflow()
    .run(
      node({
        kind: "root",
        schema: z.unknown(),
        program: () => Effect.succeed(undefined) as never,
      }),
    );
  const aChain = root
    .chain(
      node({
        kind: "a",
        schema: z.unknown(),
        program: () => Effect.succeed(undefined) as never,
      }),
    )
    .chain(
      node({
        kind: "x",
        schema: z.unknown(),
        program: () => Effect.succeed(undefined) as never,
      }),
    );
  // Transport tests don't need a real composition. Hand-build
  // a state with the right node set in Map form.
  const make = (k: string): Node => ({
    id: NodeKey(k),
    kind: k,
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  });
  const nodes = new Map<NodeKey, Node>();
  nodes.set(NodeKey("root"), make("root"));
  nodes.set(NodeKey("root.a"), make("root.a"));
  nodes.set(NodeKey("root.b"), make("root.b"));
  nodes.set(NodeKey("root.a.x"), make("root.a.x"));
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running" as const,
    nodes,
    edges: [],
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    defs: new Map(),
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("subscribe()", () => {
  it("invokes the callback with the matching node on notify", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let captured: Node | undefined;
    subscribe(registry, NodeKey("root.a"), (n) => {
      captured = n;
    });
    registry.notify(state);
    expect(captured?.kind).toBe("root.a");
  });

  it("does not invoke the callback when the key is missing", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let called = false;
    subscribe(registry, NodeKey("missing"), () => {
      called = true;
    });
    registry.notify(state);
    expect(called).toBe(false);
  });

  it("unsubscribe stops further notifications", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let count = 0;
    const sub = subscribe(registry, NodeKey("root.a"), () => {
      count += 1;
    });
    registry.notify(state);
    sub.unsubscribe();
    registry.notify(state);
    expect(count).toBe(1);
  });
});

describe("subscribeSet()", () => {
  it("'*' matches every node keyed by full key", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let captured: Record<string, Node> = {};
    subscribeSet(registry, "*", (n) => {
      captured = n;
    });
    registry.notify(state);
    expect(Object.keys(captured).length).toBe(4);
    expect(captured["root.a"]?.kind).toBe("root.a");
  });

  it("'prefix.*' matches direct children keyed by relative path", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let captured: Record<string, Node> = {};
    subscribeSet(registry, "root.*", (n) => {
      captured = n;
    });
    registry.notify(state);
    expect(Object.keys(captured).toSorted()).toEqual(["a", "b"]);
    expect(captured["a"]?.kind).toBe("root.a");
    expect(captured["a.x"]).toBeUndefined();
  });

  it("'prefix.' (no wildcard) matches direct children keyed by relative path", () => {
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let captured: Record<string, Node> = {};
    subscribeSet(registry, "root.", (n) => {
      captured = n;
    });
    registry.notify(state);
    expect(Object.keys(captured).toSorted()).toEqual(["a", "b"]);
    expect(captured["a.x"]).toBeUndefined();
  });

  it("an exact-key pattern returns a single entry keyed by the full key", () => {
    // TASK-41: the exact-key path was a no-op before; it's
    // now a single-entry record. The relative key is the full
    // pattern (no trimming). Consumers asking for a specific
    // node get that node, not an empty object.
    const registry = new LiveSubscriptionRegistry();
    const state = makeState();
    let captured: Record<string, Node> = {};
    subscribeSet(registry, "root.a", (n) => {
      captured = n;
    });
    registry.notify(state);
    expect(Object.keys(captured)).toEqual(["root.a"]);
    expect(captured["root.a"]?.kind).toBe("root.a");
  });
});
