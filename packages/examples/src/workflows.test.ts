// Integration test: the linear-pipeline example runs end-to-end.
// This replaces the runtime.test.ts fixture-based tests with
// real workflow compositions that exercise every underwai
// surface.

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import { linearPipeline, humanInTheLoop, wallDisplay } from "./workflows.js";
import { LiveSubscriptionRegistry, NodeKey } from "@underwai/core";
import { subscribeSet } from "@underwai/transport";

describe("linear pipeline example", () => {
  it("applies the bridge (trim+uppercase) end-to-end", async () => {
    const { state, programs } = linearPipeline.setup();
    const layer = WorkflowRuntimeLive({ state, programs });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "  hello world  ");
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    const display = result.nodes["root.display"];
    expect(display?.status.kind).toBe("resolved");
    if (display?.status.kind === "resolved") {
      // The bridge (out) => out.trim().toUpperCase() applied.
      expect(display.status.finalOutput).toBe("HELLO WORLD");
    }
  });
});

describe("human-in-the-loop example", () => {
  it("uses writeHumanInput to inject the value", async () => {
    const { state, programs } = humanInTheLoop.setup();
    const layer = WorkflowRuntimeLive({ state, programs });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.writeHumanInput(NodeKey("root"), { name: "Alice" });
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    const display = result.nodes["root.process.display"];
    expect(display?.status.kind).toBe("resolved");
    if (display?.status.kind === "resolved") {
      expect(display.status.finalOutput).toBe("Hello, Alice!");
    }
  });
});

describe("wall display example", () => {
  it("notifies the live subscription on every state change", async () => {
    const { state, programs } = wallDisplay.setup();
    const live = new LiveSubscriptionRegistry();
    let lastValue: string | undefined;
    const sub = subscribeSet(live, "*", (nodes) => {
      const renderNode = nodes["root.render"];
      if (renderNode?.status.kind === "resolved") {
        lastValue = (renderNode.status as { finalOutput: string }).finalOutput;
      }
    });
    const layer = WorkflowRuntimeLive({ state, programs, liveRegistry: live });
    await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state, programs });
      }).pipe(Effect.provide(layer)),
    );
    sub.unsubscribe();
    expect(lastValue).toBeDefined();
    expect(lastValue).toMatch(/^tick=\d+$/);
  });
});
