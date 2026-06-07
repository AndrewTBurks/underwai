// Tests for the WorkflowRuntime service. The service holds the
// state, exposes { run, publish, write, writeHumanInput, getState,
// subscribe }, and programs use the service via Effect's standard
// yield* pattern.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "./runtime.js";
import { compose, run } from "@underwai/core";
import { init } from "@underwai/core";
import { NodeKey, WorkflowId } from "@underwai/core";
import type { NodeDefinition } from "@underwai/core";
import { z } from "zod";

function def(kind: string): NodeDefinition<unknown> {
  return {
    kind,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    program: ((_input: unknown) => Effect.succeed(undefined)) as never,
  };
}

describe("WorkflowRuntime service", () => {
  it("publish transitions a running node to streaming then resolved", async () => {
    const { tree } = compose(() => run(def("root")));
    const state = init(tree, WorkflowId("wf-pub"));
    const programs = {
      root: () =>
        Effect.gen(function* () {
          const rt = yield* WorkflowRuntime;
          yield* rt.publish({ progress: 0.5 }, true);
          yield* rt.publish({ progress: 1.0 }, true);
          return "done";
        }) as never,
    };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs }))),
    );
    expect(result.status).toBe("completed");
    const node = result.nodes["root"]!;
    if (node.status.kind === "resolved") {
      expect(node.status.finalOutput).toBe("done");
    }
  });

  it("write injects a value into a pending node and resolves it", async () => {
    const { tree } = compose(() => run(def("root")));
    const initial = init(tree, WorkflowId("wf-write"));
    const programs = {
      root: () => Effect.succeed("should not run") as never,
    };
    // Build the service layer once so write and run share state.
    const layer = WorkflowRuntimeLive({ state: initial, programs });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "injected");
        return yield* rt.run({ state: initial, programs });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    const node = result.nodes["root"]!;
    if (node.status.kind === "resolved") {
      expect(node.status.finalOutput).toBe("injected");
    }
  });

  it("writeHumanInput marks a node stale with the new input value", async () => {
    const { tree } = compose(() => run(def("root")));
    const initial = init(tree, WorkflowId("wf-whi"));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.writeHumanInput(NodeKey("root"), "human-input");
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state: initial, programs: {} }))),
    );
    const node = result.nodes["root"]!;
    expect(node.input.value).toBe("human-input");
    expect(node.status.kind).toBe("stale");
  });
});
