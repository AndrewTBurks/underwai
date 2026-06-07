// @underwai/renderer-log — runner.ts
//
// runLogRenderer subscribes to a workflow via
// subscribeSet(registry, "*", onUpdate). On every notify, walks
// the DAG (state.nodes) and prints each node via the registered
// kind renderer. The output is captured by the consumer; the
// default is console.log.
//
// The runner takes a `getState` function so it can read the
// latest state from the consumer's source of truth. This is the
// v1.0 wire: the consumer owns the state, the runner subscribes
// to the registry for change notifications, and reads the state
// on each notify.
import { subscribeSet, type Subscription } from "@underwai/transport";
import type { LiveSubscriptionRegistry, WorkflowState } from "@underwai/core";
import { defaultRenderer, getKindRenderer } from "./registry.js";

export type RunOptions = {
  readonly print?: (line: string) => void;
  readonly getState: () => WorkflowState;
};

export function runLogRenderer(
  registry: LiveSubscriptionRegistry,
  initialState: WorkflowState,
  opts: RunOptions,
): Subscription {
  const print = opts.print ?? ((line: string) => console.log(line));

  const render = (state: WorkflowState) => {
    const lines: string[] = [];
    lines.push(`workflow ${state.id} (${state.status})`);
    for (const [_key, node] of Object.entries(state.nodes)) {
      const fn = getKindRenderer(node.kind) ?? defaultRenderer;
      const depth = ((node.id as unknown as string) ?? "").split(".").length - 1;
      lines.push(fn(node, depth));
    }
    print(lines.join("\n"));
  };

  // Fire once with the initial state, then subscribe for updates.
  render(initialState);
  return subscribeSet(registry, "*", () => {
    render(opts.getState());
  });
}
