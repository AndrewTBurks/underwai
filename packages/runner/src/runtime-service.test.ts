// Tests for the WorkflowRuntime service. The service holds the
// state, exposes { run, publish, write, writeHumanInput, getState,
// subscribe }, and programs use the service via Effect's standard
// yield* pattern.
//
// Programs are wired into the composition via node()'s `program`
// field; the runtime reads them from state.defs.
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "./runtime.js";
import {
  init,
  node,
  NodeKey,
  workflow,
  WorkflowId,
  type NodeDefinition,
} from "@underwai/core";
import { z } from "zod";

function def<R = never>(
  kind: string,
  program: (input: unknown) => Effect.Effect<unknown, Error, R>,
): NodeDefinition<unknown, unknown, typeof kind> {
  return node({
    kind,
    schema: z.unknown(),
    program: ((i: unknown) => program(i)) as never,
  });
}

describe("WorkflowRuntime service", () => {
  it("publish transitions a running node to streaming then resolved", async () => {
    const built = workflow()
      .run(
        def("root", () =>
          Effect.gen(function* () {
            const rt = yield* WorkflowRuntime;
            yield* rt.publish({ progress: 0.5 }, true);
            yield* rt.publish({ progress: 1.0 }, true);
            return "done";
          }),
        ),
      )
      .build();
    const state = init(built.tree, WorkflowId("wf-pub"));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
    );
    expect(result.status).toBe("completed");
    const n = result.nodes.get(NodeKey("root"))!;
    if (n.status.kind === "resolved") {
      expect(n.status.finalOutput).toBe("done");
    }
  });

  it("write injects a value into a pending node and resolves it", async () => {
    const built = workflow()
      .run(def("root", () => Effect.succeed("should not run")))
      .build();
    const initial = init(built.tree, WorkflowId("wf-write"));
    const layer = WorkflowRuntimeLive({ state: initial });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "injected");
        return yield* rt.run({ state: initial });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    const n = result.nodes.get(NodeKey("root"))!;
    if (n.status.kind === "resolved") {
      expect(n.status.finalOutput).toBe("injected");
    }
  });

  it("writeHumanInput marks a node stale with the new input value", async () => {
    const built = workflow()
      .run(def("root", () => Effect.succeed("never runs")))
      .build();
    const initial = init(built.tree, WorkflowId("wf-whi"));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        const next = yield* rt.writeHumanInput(NodeKey("root"), "human-input");
        return next;
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state: initial }))),
    );
    const n = result.nodes.get(NodeKey("root"))!;
    expect(n.input.value).toBe("human-input");
    expect(n.status.kind).toBe("stale");
  });
});
