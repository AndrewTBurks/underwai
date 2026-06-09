// Integration test: the example workflows run end-to-end
// through the same code path the shell uses. The runtime
// reads programs from state.defs (no parallel programs
// record). The typed view method reads a node by key with
// the declared output type — no `as` or `as unknown as`.
//
// The shell's event capture logic (EventLog.capture) is
// tested here too, since it is the contract the wire
// format derives from.
//
// Note: with the new demoDelay (500ms per node), full
// runs take 2-3 seconds. We use a shorter "0 millis"
// delay by mutating the state defs, or accept the timing.

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive, type RunOptions } from "@underwai/runner";
import { NodeKey, type WorkflowState } from "@underwai/core";
import { capture } from "./EventLog.js";
import {
  linearPipelineDemo,
  humanInTheLoopDemo,
  wallDisplayDemo,
  joinExampleDemo,
  streamingDemo,
} from "./workflows.js";

describe("linear pipeline example", () => {
  it("applies the bridges (trim+upper+exclaim) end-to-end", async () => {
    const state = linearPipelineDemo.setup();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "  hello world  ");
        return yield* rt.run({ state });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
    );
    expect(result.status).toBe("completed");
    const display = linearPipelineDemo.built.view(result, "root.trim.upper.exclaim.display");
    if (display.status.kind === "resolved") {
      expect(display.status.finalOutput).toBe("HELLO WORLD!");
    } else {
      throw new Error("expected display to be resolved");
    }
  }, 15000);
});

describe("human-in-the-loop example", () => {
  it("pauses at askName until writeHumanInput is called", async () => {
    const state = humanInTheLoopDemo.setup();
    const layer = WorkflowRuntimeLive({ state });
    // First run: hits the human-marked askName node, pauses.
    const paused = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state });
      }).pipe(Effect.provide(layer)),
    );
    const askView = humanInTheLoopDemo.built.view(paused, "root.askName");
    expect(askView.status.kind).toBe("paused");
    // Submit the human value; the runtime un-pauses and
    // the rest of the pipeline runs.
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.writeHumanInput(NodeKey("root.askName"), "Alice");
        return yield* rt.run({ state: paused });
      }).pipe(Effect.provide(layer)),
    );
    expect(result.status).toBe("completed");
    const display = humanInTheLoopDemo.built.view(
      result,
      "root.askName.compose.polish.sign.display",
    );
    if (display.status.kind === "resolved") {
      expect(display.status.finalOutput).toMatch(/Alice/);
    } else {
      throw new Error("expected display to be resolved");
    }
  }, 15000);
});

describe("wall display example", () => {
  it("resolves the leaf with the tick format", async () => {
    const state = wallDisplayDemo.setup();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
    );
    expect(result.status).toBe("completed");
    // eslint-disable-next-line no-console
    console.log("[wall] final state:", JSON.stringify(
      Object.fromEntries(
        Array.from(result.nodes.entries()).map(([k, n]) => [
          k,
          { kind: n.status.kind, out: n.status.kind === "resolved" ? n.status.finalOutput : undefined },
        ]),
      ),
      null,
      2,
    ));
    const render = wallDisplayDemo.built.view(result, "root.format.pulse.display");
    if (render.status.kind === "resolved") {
      expect(render.status.finalOutput).toMatch(/tick=1/);
    } else {
      throw new Error("expected render to be resolved");
    }
  }, 15000);
});

describe("join example", () => {
  it("resolves the merge from the composite record", async () => {
    const state = joinExampleDemo.setup();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), "Alice");
        return yield* rt.run({ state });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
    );
    expect(result.status).toBe("completed");
    const render = joinExampleDemo.built.view(
      result,
      "root.fetchProfile.validateProfile.merge.render",
    );
    if (render.status.kind === "resolved") {
      expect(render.status.finalOutput).toMatch(/Alice/);
    } else {
      throw new Error("expected render to be resolved");
    }
  }, 15000);

  it("resolves faster with maxConcurrent: 4 (parallel branches)", async () => {
    // The join demo has two parallel branches at the top
    // (fetchProfile and fetchAvatar) plus a chain (validate
    // stages) and a merge. With maxConcurrent: 4, the
    // top-level branches run concurrently, halving the
    // wall-clock time of that tier. With the artificial
    // Effect.sleep("500 millis") per node, sequential
    // takes ~5s; parallel takes ~2.5s.
    const sequential = await runJoinWith(1);
    const parallel = await runJoinWith(4);
    const seqMs = Date.now() - sequential.start;
    const parMs = Date.now() - parallel.start;
    expect(sequential.result.status).toBe("completed");
    expect(parallel.result.status).toBe("completed");
    // Parallel should be meaningfully faster. The minimum
    // node count at the top tier is 2 (fetchProfile,
    // fetchAvatar); sequential = ~1s extra, parallel =
    // ~0s. We allow some slack.
    expect(parMs).toBeLessThan(seqMs * 0.85);
  }, 30000);
});

// Helper for the parallel-vs-sequential timing assertion.
async function runJoinWith(maxConcurrent: number | undefined) {
  const state = joinExampleDemo.setup();
  const start = Date.now();
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      yield* rt.write(NodeKey("root"), "Bob");
      const opts: RunOptions =
        maxConcurrent === undefined ? { state } : { state, maxConcurrent };
      return yield* rt.run(opts);
    }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
  );
  return { result, start };
}

describe("streaming example", () => {
  it("resolves the display with the generated token", async () => {
    const state = streamingDemo.setup();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), 7);
        return yield* rt.run({ state });
      }).pipe(Effect.provide(WorkflowRuntimeLive({ state }))),
    );
    expect(result.status).toBe("completed");
    const display = streamingDemo.built.view(result, "root.generate.collect.tick.display");
    if (display.status.kind === "resolved") {
      expect(display.status.finalOutput).toMatch(/token-7/);
    } else {
      throw new Error("expected display to be resolved");
    }
  }, 15000);
});

describe("EventLog.capture()", () => {
  it("emits workflow-status on a status change", () => {
    const a = linearPipelineDemo.setup();
    const next: WorkflowState = { ...a, status: "running" };
    const events = capture([], next, a);
    expect(events.some((e) => e.kind === "workflow-status")).toBe(true);
  });
  it("prepends new events (newest first)", () => {
    const a = linearPipelineDemo.setup();
    const e1 = capture([], a, null);
    const b: WorkflowState = { ...a, status: "completed" };
    const e2 = capture(e1, b, a);
    expect(e2.length).toBeGreaterThan(e1.length);
    expect(e2[0]?.kind).toBe("workflow-status");
  });
});
