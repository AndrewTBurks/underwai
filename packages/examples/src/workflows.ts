// The three example workflows.
//
// Each example is a small composition + a set of programs. The
// composition API is the consumer-facing surface; this file
// shows the three patterns: linear pipeline with a bridge,
// human-in-the-loop, and live subscription for a wall display.

import { Effect } from "effect";
import { z } from "zod";
import { init, node, workflow, WorkflowId } from "@underwai/core";

// Example 1: linear pipeline with a bridge transform.
//
// parse(raw: string) -> (bridge: trim+uppercase) -> display(s: string)

export const linearPipeline = {
  compose: () =>
    workflow()
      .run(
        node({
          kind: "parse",
          schema: z.string(),
          program: (input) => Effect.succeed(input),
        }),
      )
      .chain(
        (s: string) => s.trim().toUpperCase(),
        node({
          kind: "display",
          schema: z.string(),
          program: (input) => Effect.succeed(input),
        }),
      )
      .build(),
  programs: {
    root: (input: unknown) => Effect.succeed(input),
    "root.display": (input: unknown) => Effect.succeed(input),
  } as Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>,
  setup: () => {
    const built = linearPipeline.compose();
    return {
      state: init(built.tree, WorkflowId("wf-linear")),
      programs: linearPipeline.programs,
      paths: built.paths,
    };
  },
};

// Example 2: human-in-the-loop.
//
// ask(name: string) -> process -> display

export const humanInTheLoop = {
  compose: () =>
    workflow()
      .run(
        node({
          kind: "ask",
          schema: z.object({ name: z.string() }),
          program: (input) => Effect.succeed(input),
        }),
      )
      .chain(
        (out: { name: string }) => out,
        node({
          kind: "process" as const,
          schema: z.object({ name: z.string() }),
          outputSchema: z.string(),
          program: (input: { name: string }) =>
            Effect.succeed(input.name ? `Hello, ${input.name}!` : "(no name)"),
        }),
      )
      .chain(
        (out: string) => out,
        node({
          kind: "display" as const,
          schema: z.string(),
          program: (input: string) => Effect.succeed(input),
        }),
      )
      .build(),
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
  setup: () => {
    const built = humanInTheLoop.compose();
    return {
      state: init(built.tree, WorkflowId("wf-human")),
      programs: humanInTheLoop.programs,
      paths: built.paths,
    };
  },
};

// Example 3: wall display.
//
// tick(n: number) -> render

export const wallDisplay = {
  compose: () =>
    workflow()
      .run(
        node({
          kind: "tick",
          schema: z.number(),
          program: (input) => Effect.succeed((input + 1) % 100),
        }),
      )
      .chain(
        (n: number) => n,
        node({
          kind: "render" as const,
          schema: z.number(),
          outputSchema: z.string(),
          program: (input: number) => Effect.succeed(`tick=${input}`),
        }),
      )
      .build(),
  programs: {
    root: (input: unknown) => Effect.succeed((((input as number) ?? 0) + 1) % 100),
    "root.render": (input: unknown) => Effect.succeed(`tick=${input as number}`),
  } as Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>,
  setup: () => {
    const built = wallDisplay.compose();
    return {
      state: init(built.tree, WorkflowId("wf-wall")),
      programs: wallDisplay.programs,
      paths: built.paths,
    };
  },
};
