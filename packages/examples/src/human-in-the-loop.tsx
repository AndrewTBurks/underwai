// Human-in-the-loop example. Three nodes:
//   ask -> process -> display
//
// The `ask` node has a human-marked field. The consumer
// injects a value via WorkflowRuntime.writeHumanInput.

import { useState } from "react";
import { Effect } from "effect";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import { NodeKey, type WorkflowState } from "@underwai/core";
import { humanInTheLoop } from "./workflows.js";

export function HumanInTheLoop() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [name, setName] = useState("");

  const submit = () => {
    const { state: initial, programs } = humanInTheLoop.setup();
    const layer = WorkflowRuntimeLive({ state: initial, programs });
    void Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* WorkflowRuntime;
        yield* rt.writeHumanInput(NodeKey("root"), { name });
        return yield* rt.run({ state: initial, programs });
      }).pipe(Effect.provide(layer)),
    ).then(setState);
  };

  const askNode = state?.nodes["root"];
  const displayNode = state?.nodes["root.process.display"];

  return (
    <div className="example">
      <h1>human-in-the-loop</h1>
      <p>
        <input placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={submit}>submit</button>
      </p>
      <p>
        ask.input:{" "}
        <code>
          {askNode && (askNode.input as { value?: unknown }).value
            ? JSON.stringify((askNode.input as { value?: unknown }).value)
            : "(none)"}
        </code>
      </p>
      <p>
        ask.process.display:{" "}
        <code>
          {displayNode && displayNode.status.kind === "resolved"
            ? ((displayNode.status as { kind: string; finalOutput?: unknown })
                .finalOutput as string)
            : "(none)"}
        </code>{" "}
        {displayNode?.status.kind === "resolved" ? "✓" : "…"}
      </p>
      <p>workflow status: {state?.status ?? "…"}</p>
    </div>
  );
}
