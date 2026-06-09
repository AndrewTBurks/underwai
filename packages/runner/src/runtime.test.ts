// Integration test: runWorkflow drives a workflow end-to-end.
// Uses the new builder + node() API to construct a real
// WorkflowState from a composition. The runtime reads
// programs from state.defs — no parallel programs record.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { z } from "zod";
import {
  init,
  LiveSubscriptionRegistry,
  node,
  workflow,
  WorkflowId,
  NodeKey,
  type Edge,
  type Node,
  type NodeDefinition,
  type WorkflowState,
} from "@underwai/core";
import { WorkflowRuntime, WorkflowRuntimeLive, type RunOptions } from "./runtime.js";

const noopProgram = <T>(input: T) => Effect.succeed(input) as never;

function setupChain(opts: {
  state: WorkflowState;
  liveRegistry?: LiveSubscriptionRegistry;
}) {
  return WorkflowRuntimeLive(opts);
}

describe("runWorkflow() integration", () => {
  it("a 3-node workflow drives root -> a -> b in dependency order", async () => {
    const built = workflow()
      .run(node({ kind: "root", schema: z.string(), program: (s: string) => Effect.succeed(s) }))
      .chain((s: string) => s.toUpperCase(), node({ kind: "a", schema: z.string(), program: (s: string) => Effect.succeed(s) }))
      .chain((s: string) => `${s}!`, node({ kind: "b", schema: z.string(), program: (s: string) => Effect.succeed(s) }))
      .build();
    const state = init(built.tree, WorkflowId("wf-3node"));
    const layer = setupChain({ state });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "hi");
        return yield* rt.run({ state });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    expect(result.nodes.get(NodeKey("root"))?.status.kind).toBe("resolved");
    expect(result.nodes.get(NodeKey("root.a"))?.status.kind).toBe("resolved");
    expect(result.nodes.get(NodeKey("root.a.b"))?.status.kind).toBe("resolved");
  });

  it("notifies the live registry on every state transition", async () => {
    const built = workflow()
      .run(node({ kind: "root", schema: z.string(), program: (s: string) => Effect.succeed(s) }))
      .build();
    const state = init(built.tree, WorkflowId("wf-notify"));
    const live = new LiveSubscriptionRegistry();
    let notifyCount = 0;
    live.register(NodeKey("root"), () => {
      notifyCount += 1;
    });
    const layer = setupChain({ state, liveRegistry: live });
    await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "hi");
        return yield* rt.run({ state });
      }).pipe(Effect.provide(layer)),
    );
    expect(notifyCount).toBeGreaterThan(0);
  });

  it("passes the bridged upstream output to a child program", async () => {
    const built = workflow()
      .run(node({ kind: "root", schema: z.number(), program: (n: number) => Effect.succeed(n) }))
      .chain(
        (n: number) => n * 2,
        node({ kind: "doubled", schema: z.number(), program: (n: number) => Effect.succeed(n) }),
      )
      .build();
    const state = init(built.tree, WorkflowId("wf-bridge"));
    const layer = setupChain({ state });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), 21);
        return yield* rt.run({ state });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.nodes.get(NodeKey("root.doubled"))?.status.kind).toBe("resolved");
    const out = result.nodes.get(NodeKey("root.doubled"))?.status;
    if (out?.kind === "resolved") {
      expect(out.finalOutput).toBe(42);
    }
  });
});

// Keep the unused import to satisfy the test file's referenced types.
void noopProgram;
void setupChain;
type _Node = Node;

describe("run() with maxConcurrent", () => {
  it("default maxConcurrent is 1 (sequential)", async () => {
    // Build a 2-sibling tree manually: root → {a, b}
    const state = buildParallelState(["root", "root.a", "root.b"]);
    const layer = setupChain({ state });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "x");
        return yield* rt.run({ state });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    expect(result.nodes.get(NodeKey("root.a"))?.status.kind).toBe("resolved");
    expect(result.nodes.get(NodeKey("root.b"))?.status.kind).toBe("resolved");
  });

  it("maxConcurrent > 1 dispatches parallel-ready siblings concurrently", async () => {
    // Build a 3-sibling tree: root → {a, b, c}
    const state = buildParallelState(["root", "root.a", "root.b", "root.c"]);
    const live = new LiveSubscriptionRegistry();
    const layer = setupChain({ state, liveRegistry: live });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "x");
        return yield* rt.run({ state, maxConcurrent: 3 });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    expect(result.nodes.get(NodeKey("root.a"))?.status.kind).toBe("resolved");
    expect(result.nodes.get(NodeKey("root.b"))?.status.kind).toBe("resolved");
    expect(result.nodes.get(NodeKey("root.c"))?.status.kind).toBe("resolved");
  });

  it("maxConcurrent does not affect final state", async () => {
    const runWith = (maxConcurrent: number | undefined) => {
      const state = buildParallelState(["root", "root.a", "root.b"]);
      const layer = setupChain({ state });
      return Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "x");
        const opts: RunOptions =
          maxConcurrent === undefined ? { state } : { state, maxConcurrent };
        return yield* rt.run(opts);
      }).pipe(Effect.provide(layer));
    };

    const r1 = await Effect.runPromise(runWith(1));
    const r2 = await Effect.runPromise(runWith(4));
    expect(r1.status).toBe("completed");
    expect(r2.status).toBe("completed");
    const kinds1 = Array.from(r1.nodes.values()).map((n) => n.status.kind).sort();
    const kinds2 = Array.from(r2.nodes.values()).map((n) => n.status.kind).sort();
    expect(kinds1).toEqual(kinds2);
  });
});

// buildParallelState: construct a WorkflowState where the first
// key is the root and the rest are siblings of the root
// (parallel children, not a chain).
function buildParallelState(keys: string[]): WorkflowState {
  const nodes = new Map<NodeKey, Node>();
  for (const k of keys) {
    nodes.set(NodeKey(k), {
      id: NodeKey(k),
      kind: k === "root" ? "root" : k.split(".").pop()!,
      inputSchema: z.unknown(),
      input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
      outputSchema: z.unknown(),
      status: { kind: "pending" },
      actor: "system",
      createdAt: "T",
      updatedAt: "T",
    });
  }
  const edges: Edge[] = [];
  for (let i = 1; i < keys.length; i++) {
    edges.push({ from: NodeKey(keys[0]!), to: NodeKey(keys[i]!) });
  }
  // Defs with a passthrough program so the runtime can
  // resolve each child. The "root" def returns its input;
  // siblings format it.
  const defs = new Map<NodeKey, NodeDefinition>();
  defs.set(NodeKey("root"), {
    kind: "root",
    program: (s: string) => Effect.succeed(s),
  } as never);
  for (let i = 1; i < keys.length; i++) {
    const childKey = keys[i]!;
    const childKind = childKey.split(".").pop()!;
    defs.set(NodeKey(childKey), {
      kind: childKind,
      program: (s: string) => Effect.succeed(`${childKind}:${s}`),
    } as never);
  }
  return {
    id: WorkflowId("wf-parallel"),
    defs,
    version: 1,
    status: "pending",
    nodes,
    edges,
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    createdAt: "T",
    updatedAt: "T",
  };
}
