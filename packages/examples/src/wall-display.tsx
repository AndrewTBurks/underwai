// Wall display example. Two nodes:
//   tick -> render
//
// The runtime drives the workflow repeatedly, the live
// subscription fires on every state change, the wall display
// renders the latest value.

import { useEffect, useState } from "react";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import { LiveSubscriptionRegistry, type WorkflowState } from "@underwai/core";
import { subscribeSet } from "@underwai/transport";
import { wallDisplay } from "./workflows.js";

export function WallDisplay() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const { state: initial, programs } = wallDisplay.setup();
    const live = new LiveSubscriptionRegistry();
    const sub = subscribeSet(live, "*", (nodes) => {
      const renderNode = nodes["root.render"];
      if (renderNode?.status.kind === "resolved") {
        setTick((renderNode.status as { finalOutput: string }).finalOutput as unknown as number);
      }
    });
    const layer = WorkflowRuntimeLive({ state: initial, programs, liveRegistry: live });
    void Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        return yield* rt.run({ state: initial, programs });
      }).pipe(Effect.provide(layer)),
    ).then(setState);
    return () => sub.unsubscribe();
  }, []);

  return (
    <div className="example">
      <h1>wall display</h1>
      <p className="big">{tick}</p>
      <p>workflow status: {state?.status ?? "…"}</p>
    </div>
  );
}
