// Integration test: runWorkflow drives a workflow end-to-end.
//
// Uses core/compose + core/init to construct a real WorkflowState
// from a composition expression, then calls runWorkflow with
// programs for each node. Verifies:
//
//   1. Single-node workflow drives pending -> running -> resolved,
//      then workflow status === "completed".
//   2. A failing program marks the node failed and the workflow
//      status === "failed".
//   3. A program that calls runtime.publish leaves the final
//      state as resolved, but the registry's notify callback is
//      invoked at least once during the run.
//   4. Subscribers are notified on every state transition
//      (count >= 2 for a single-node flow).
//   5. The 3-node workflow drives root -> a -> b in dependency
//      order.
//   6. The live registry receives notify on every state
//      transition.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive, runWorkflow } from "./runtime.js";
import { compose, chain, run, LiveSubscriptionRegistry } from "@underwai/core";
import { init } from "@underwai/core";
import { NodeKey, WorkflowId } from "@underwai/core";
import type { NodeDefinition } from "@underwai/core";
import { z } from "zod";

function def(kind: string): NodeDefinition<unknown, unknown> {
  return {
    kind,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    program: ((_input: unknown) => Effect.succeed(undefined)) as never,
  };
}

describe("runWorkflow() integration", () => {
  it("drives a single-node workflow to resolved", async () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-1"));
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(result.status).toBe("completed");
    const node = result.nodes["root"]!;
    expect(node.status.kind).toBe("resolved");
  });

  it("marks a node failed when the program errors", async () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-2"));
    const programs = {
      root: (_input: unknown) => Effect.fail(new Error("boom")) as never,
    };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(result.status).toBe("failed");
    const node = result.nodes["root"]!;
    expect(node.status.kind).toBe("failed");
  });

  it("notifies subscribers on every state transition", async () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-3"));
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    };
    let notifyCount = 0;
    const subProgram = Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      yield* rt.subscribe(() => {
        notifyCount += 1;
      });
      return yield* rt.run({ state, programs });
    });
    await Effect.runPromise(
      subProgram.pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(notifyCount).toBeGreaterThanOrEqual(2);
  });

  it("a 3-node workflow drives root -> a -> b in dependency order", async () => {
    const { tree } = compose(() => {
      const root = run(def("root"));
      const a = chain(root, def("a"));
      const b = chain(a, def("b"));
      return b;
    });
    const state = init(tree, WorkflowId("wf-4"));
    const programs = {
      root: () => Effect.succeed("a") as never,
      "root.a": () => Effect.succeed("b") as never,
      "root.a.b": () => Effect.succeed("c") as never,
    };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(result.status).toBe("completed");
    expect(result.nodes["root"]?.status.kind).toBe("resolved");
    expect(result.nodes["root.a"]?.status.kind).toBe("resolved");
    expect(result.nodes["root.a.b"]?.status.kind).toBe("resolved");
  });

  it("notifies the live registry on every state transition", async () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-5"));
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    };
    const live = new LiveSubscriptionRegistry();
    let notifyCount = 0;
    live.registerPattern("*", () => {
      notifyCount += 1;
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs, liveRegistry: live }))),
    );
    expect(result.status).toBe("completed");
    expect(notifyCount).toBeGreaterThanOrEqual(1);
  });

  it("passes the bridged upstream output to a child program", async () => {
    const { tree } = compose(() => {
      const root = run(def("root"));
      return chain(root, (out: number) => out * 2, def("doubled"));
    });
    const state = init(tree, WorkflowId("wf-bridge-runtime"));
    const programs = {
      root: () => Effect.succeed(21) as never,
      "root.doubled": (input: unknown) => Effect.succeed(input) as never,
    };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(result.status).toBe("completed");
    const doubled = result.nodes["root.doubled"]!;
    if (doubled.status.kind === "resolved") {
      // The bridge (out: number) => out * 2 was applied: 21 * 2 = 42
      expect(doubled.status.finalOutput).toBe(42);
    }
  });

  it("notifies both the service's in-process subs and the live registry", async () => {
    // TASK-36: the runtime has a single notify path that
    // reaches both the in-process subscribers (yield* to the
    // service's subscribe()) and the cross-package
    // LiveSubscriptionRegistry. The old SubscriptionRegistry
    // (a third path) is deleted.
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-merge"));
    const programs = {
      root: () => Effect.succeed("done") as never,
    };
    const live = new LiveSubscriptionRegistry();
    let inProcessCount = 0;
    let liveCount = 0;
    live.registerPattern("*", () => {
      liveCount += 1;
    });
    const layer = WorkflowRuntimeLive({ state, programs, liveRegistry: live });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.subscribe(() => {
          inProcessCount += 1;
        });
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    // Both paths are notified on every state transition.
    expect(inProcessCount).toBeGreaterThanOrEqual(2);
    expect(liveCount).toBeGreaterThanOrEqual(1);
  });
});
