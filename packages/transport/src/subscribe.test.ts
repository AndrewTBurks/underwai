import { describe, expect, it } from "vitest";
import { subscribe, subscribeSet } from "./subscribe.js";
import type { Node, WorkflowState } from "@underwai/core";
import { LiveSubscriptionRegistry, NodeKey, WorkflowId } from "@underwai/core";

function makeState(): WorkflowState {
  const make = (k: string): Node => ({
    id: NodeKey(k),
    kind: k,
    inputSchema: undefined as never,
    input: { value: undefined, schema: undefined as never, humanFields: new Map() },
    outputSchema: undefined as never,
    status: { kind: "pending" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  });
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: {
      root: make("root"),
      "root.a": make("root.a"),
      "root.b": make("root.b"),
      "root.a.x": make("root.a.x"),
    },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
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
    expect(Object.keys(captured).sort()).toEqual(["a", "b"]);
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
    expect(Object.keys(captured).sort()).toEqual(["a", "b"]);
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
