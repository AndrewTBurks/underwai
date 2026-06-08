// The three example workflows.
//
// Each example is a small composition + a set of programs. The
// composition API is the consumer-facing surface; this file
// shows the three patterns: linear pipeline with a bridge,
// human-in-the-loop, and live subscription for a wall display.

import { Effect } from "effect";
import { z } from "zod";
import {
  chain,
  compose,
  init,
  run,
  WorkflowId,
  type CompositionTree,
  type NodeDefinition,
  type WorkflowState,
} from "@underwai/core";

// A "loose" def: input is unknown, output is unknown. The
// composition API uses the loose type for cross-type
// compatibility. The example programs cast at the boundary.

function def(kind: string): NodeDefinition<unknown, unknown> {
  return {
    kind,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    program: ((_input: unknown) => Effect.succeed(undefined)) as never,
  };
}

// Example 1: linear pipeline with a bridge transform.
//
// parse(raw: string) -> (bridge: trim+uppercase) -> display(s: string)
//
// The bridge is the load-bearing concern from TASK-35. The
// runtime applies the bridge at edge resolution.

export const linearPipeline = {
  compose: (): CompositionTree => {
    const { tree } = compose(() => {
      const root = run(def("parse"));
      return chain(root, (out: unknown) => (out as string).trim().toUpperCase(), def("display"));
    });
    return tree;
  },
  programs: {
    root: (input: unknown) => Effect.succeed(input),
    "root.display": (input: unknown) => Effect.succeed(input),
  } as Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>,
  id: () => WorkflowId("wf-linear"),
  setup: (): {
    state: WorkflowState;
    programs: Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>;
  } => {
    const tree = linearPipeline.compose();
    return {
      state: init(tree, linearPipeline.id()),
      programs: linearPipeline.programs,
    };
  },
};

// Example 2: human-in-the-loop.
//
// ask(name: string) -> process -> display
// The ask node has a human-marked field. The consumer injects
// the value via the WorkflowRuntime service's writeHumanInput
// method (the resolved shape from TASK-37).

export const humanInTheLoop = {
  compose: (): CompositionTree => {
    const { tree } = compose(() => {
      const a = run(def("ask"));
      const p = chain(a, (out: unknown) => out, def("process"));
      return chain(p, (out: unknown) => out, def("display"));
    });
    return tree;
  },
  programs: {
    root: (input: unknown) => Effect.succeed(input),
    "root.process": (input: unknown) =>
      Effect.succeed(
        (input as { name?: string }).name
          ? `Hello, ${(input as { name?: string }).name}!`
          : "(no name)",
      ),
    "root.process.display": (input: unknown) => Effect.succeed(input),
  } as Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>,
  id: () => WorkflowId("wf-human"),
  setup: () => {
    const tree = humanInTheLoop.compose();
    return {
      state: init(tree, humanInTheLoop.id()),
      programs: humanInTheLoop.programs,
    };
  },
};

// Example 3: wall display.
//
// A "slow" workflow that produces output over time. The renderer
// subscribes via transport.subscribeSet(registry, "*", onUpdate)
// and updates the wall display on every state change.
//
// This example exercises the live-subscription contract from
// TASK-32 + TASK-36.

export const wallDisplay = {
  compose: (): CompositionTree => {
    const { tree } = compose(() => {
      const tick = run(def("tick"));
      return chain(tick, (n: unknown) => n, def("render"));
    });
    return tree;
  },
  programs: {
    root: (input: unknown) => Effect.succeed((((input as number) ?? 0) + 1) % 100),
    "root.render": (input: unknown) => Effect.succeed(`tick=${input as number}`),
  } as Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>,
  id: () => WorkflowId("wf-wall"),
  setup: () => {
    const tree = wallDisplay.compose();
    return {
      state: init(tree, wallDisplay.id()),
      programs: wallDisplay.programs,
    };
  },
};
