// Linear pipeline example. Three nodes:
//   parse -> (bridge: trim+uppercase) -> display
//
// The composition API is exercised end-to-end. The runtime
// runs the workflow, the React component renders the result.

import { useEffect, useState } from "react";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import { NodeKey, type WorkflowState } from "@underwai/core";
import { linearPipeline } from "./workflows.js";

export function LinearPipeline() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [input, setInput] = useState("  hello world  ");

  useEffect(() => {
    const { state: initial, programs } = linearPipeline.setup();
    const layer = WorkflowRuntimeLive({ state: initial, programs });
    void Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.write(NodeKey("root"), input);
        return yield* rt.run({ state: initial, programs });
      }).pipe(Effect.provide(layer)),
    ).then(setState);
  }, [input]);

  const parseNode = state?.nodes["root"];
  const displayNode = state?.nodes["root.display"];

  return (
    <div className="example">
      <h1>linear pipeline (with bridge)</h1>
      <p>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
      </p>
      <p>
        parse:{" "}
        <code>{((parseNode?.input as { value?: unknown })?.value as string) ?? "(none)"}</code>{" "}
        {parseNode?.status.kind === "resolved" ? "✓" : "…"}
      </p>
      <p>
        parse.display (after bridge trim+uppercase):{" "}
        <code>
          {((displayNode?.status as { kind: string; finalOutput?: unknown })
            ?.finalOutput as string) ?? "(none)"}
        </code>{" "}
        {displayNode?.status.kind === "resolved" ? "✓" : "…"}
      </p>
      <p>workflow status: {state?.status ?? "…"}</p>
    </div>
  );
}
