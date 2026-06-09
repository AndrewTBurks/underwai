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
  type Node,
  type WorkflowState,
} from "@underwai/core";
import { WorkflowRuntime, WorkflowRuntimeLive } from "./runtime.js";

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
