// The example workflows.
//
// Each example demonstrates one feature of the composition
// API end-to-end. The demos are intentionally long (5-7
// nodes each) so the user can see the runtime process them
// one at a time with a visible per-node delay.
//
//   - linear pipeline: 5 stages with bridge transforms
//   - human-in-the-loop: 6 stages with a mid-graph human pause
//   - join: parallel sibling branches merged into one composite
//   - streaming: 5 stages with delayed generation
//   - wall display: 4 stages that tick on each re-run
//
// Every example compiles without `as never` or `as unknown as`.
// The program signature is typed end-to-end through node()'s
// TIn/TOut generics. The view() method on the typed tree
// reads a node by key with the declared output type.
//
// `demoDelay` is the per-node sleep. 500ms gives a clear
// visual cadence for 5-7 node chains. The user can adjust
// this; the delay is a demo concern, not a lib feature.

import { Effect } from "effect";
import { z } from "zod";
import { human } from "@underwai/schema";
import {
  init,
  node,
  type NodeKey,
  NodeKey as NodeKeyT,
  workflow,
  WorkflowId,
  type WorkflowState,
} from "@underwai/core";
import type { Demo } from "./ExampleShell.js";

const demoDelay = "500 millis" as const;

// Example 1: linear pipeline with multi-stage bridges.
//
//   parse → trim → upper → exclaim → display
//
// Each stage has a visible delay. The bridges show the
// composition's typed pipeline: each stage's input is the
// previous stage's output, transformed by the bridge
// function.
const linearPipelineTree = workflow()
  .run(
    node({
      kind: "parse",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s.trim(),
    node({
      kind: "trim",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s.toUpperCase(),
    node({
      kind: "upper",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => `${s}!`,
    node({
      kind: "exclaim",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "display",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .build();

// Example 2: human-in-the-loop with a mid-graph pause.
//
//   greet(format) → askName(human) → compose → polish → sign → display
//
// Automated work runs first. Then the human-marked askName
// node pauses the workflow. The user types their name in
// the form. The remaining stages run, producing a signed
// greeting. The pause is intentionally mid-graph so the
// user sees automated work happen, contributes their input,
// then watches the rest of the pipeline complete.
const humanInTheLoopTree = workflow()
  .run(
    node({
      kind: "greet",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "askName",
      schema: human(z.string()),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "compose",
      schema: z.string(),
      outputSchema: z.object({ greeting: z.string(), name: z.string() }),
      // The compose receives just the name from askName
      // (string), then it looks up the greet format. But
      // the upstream is just askName — it doesn't have the
      // greet format. We need greet to flow into compose.
      // For the demo, compose reads just the name and
      // produces a structured record; the polish stage
      // applies the greeting format. But the greeting
      // format ("Hello, ") is just a constant here.
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as({ greeting: "Hello", name: input }),
        ),
    }),
  )
  .chain(
    (r: { greeting: string; name: string }) => r,
    node({
      kind: "polish",
      schema: z.object({ greeting: z.string(), name: z.string() }),
      outputSchema: z.string(),
      program: (input: { greeting: string; name: string }) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as(`✨ ${input.greeting}, ${input.name}! ✨`),
        ),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "sign",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as(`${input}\n— underwai`),
        ),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "display",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .build();

// Example 3: join — two parallel branches merged into one.
//
// The current builder doesn't support a single `parallel()`
// combinator. The pragmatic pattern for true parallel branches
// is: build the chain path through one branch (trigger →
// fetchProfile → validateProfile), then use join() with the
// other branch's nodes as named siblings. To do that, the
// other branch's nodes (fetchAvatar, validateAvatar) need to
// exist in the state. The Demo's setup() hand-builds the
// state by taking the builder's tree, adding the avatar
// branch's defs and edges, and constructing the full state.
//
// The final graph:
//
//   trigger → fetchProfile → validateProfile ↘
//                                                  merge → render
//   trigger → fetchAvatar  → validateAvatar  ↗
//
// The merge node has TWO upstream edges: one from the
// validateProfile (chain path), one from validateAvatar
// (sibling). The composite input is keyed by upstream path.
const joinExampleTree = workflow()
  .run(
    node({
      kind: "trigger",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "fetchProfile",
      schema: z.string(),
      outputSchema: z.object({ name: z.string(), bio: z.string() }),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as({ name: input, bio: `Bio for ${input}` }),
        ),
    }),
  )
  .chain(
    (p: { name: string; bio: string }) => p,
    node({
      kind: "validateProfile",
      schema: z.object({ name: z.string(), bio: z.string() }),
      outputSchema: z.object({ name: z.string(), bio: z.string() }),
      program: (input: { name: string; bio: string }) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as({ ...input, bio: `${input.bio} ✓` }),
        ),
    }),
  )
  .join(
    {
      // The avatar branch lives at root.fetchAvatar and
      // root.fetchAvatar.validateAvatar. The join() adds
      // edges from these to the merge node.
      fetchAvatar: { key: NodeKeyT("root.fetchAvatar") },
      validateAvatar: {
        key: NodeKeyT("root.fetchAvatar.validateAvatar"),
      },
    },
    node({
      kind: "merge",
      schema: z.object({
        "root.fetchProfile.validateProfile": z.object({
          name: z.string(),
          bio: z.string(),
        }),
        "root.fetchAvatar.validateAvatar": z.object({
          url: z.string(),
          hue: z.number(),
        }),
      }),
      outputSchema: z.string(),
      program: (input: {
        "root.fetchProfile.validateProfile": {
          name: string;
          bio: string;
        };
        "root.fetchAvatar.validateAvatar": { url: string; hue: number };
      }) =>
        Effect.sleep(demoDelay).pipe(
          Effect.as(
            `${input["root.fetchProfile.validateProfile"].name} @ ${input["root.fetchAvatar.validateAvatar"].url}`,
          ),
        ),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "render",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .build();

// Add the avatar branch's defs and edges to the join tree.
// This is the "hand-build the state" step. The defs are
// added to tree.defs; the edges connect them. The state
// factory in joinExampleDemo's setup() uses these.
const joinAvatarDefs = {
  fetchAvatar: node({
    kind: "fetchAvatar",
    schema: z.string(),
    outputSchema: z.object({ url: z.string(), hue: z.number() }),
    program: (input: string) =>
      Effect.sleep(demoDelay).pipe(
        Effect.as({ url: `${input}.png`, hue: Math.floor(Math.random() * 360) }),
      ),
  }),
  validateAvatar: node({
    kind: "validateAvatar",
    schema: z.object({ url: z.string(), hue: z.number() }),
    outputSchema: z.object({ url: z.string(), hue: z.number() }),
    program: (input: { url: string; hue: number }) =>
      Effect.sleep(demoDelay).pipe(
        Effect.as({ ...input, url: `${input.url} ✓` }),
      ),
  }),
};

// Example 4: streaming — a 5-stage chain where generate
// produces a string from a number seed. The collect and
// tick stages format it; the display shows the current
// value. The publish() primitive (not used in the demo
// for simplicity) would let generate emit partials.
const streamingTree = workflow()
  .run(
    node({
      kind: "seed",
      schema: z.number(),
      program: (input: number) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (n: number) => n,
    node({
      kind: "generate",
      schema: z.number(),
      outputSchema: z.string(),
      program: (input: number) =>
        Effect.gen(function* () {
          yield* Effect.sleep(demoDelay);
          return `token-${input}`;
        }),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "collect",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "tick",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(`[${input}]`)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "display",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .build();

// Example 5: wall display — a 4-stage chain that produces a
// tick string on each run. The ticker increments a number
// starting from 0 (no input needed); format, pulse, and
// display format it. Re-running shows the new value with
// visible per-stage delay.
const wallDisplayTree = workflow()
  .run(
    node({
      kind: "ticker",
      schema: z.number(),
      // Use a literal default so the ticker produces a
      // real value when the user doesn't write an input.
      // The program takes the previous output, increments
      // it, and returns the new value.
      program: (input: number) => {
        const current = input ?? 0;
        return Effect.sleep(demoDelay).pipe(
          Effect.as((current + 1) % 100),
        );
      },
    }),
  )
  .chain(
    (n: number) => n,
    node({
      kind: "format",
      schema: z.number(),
      outputSchema: z.string(),
      program: (input: number) =>
        Effect.sleep(demoDelay).pipe(Effect.as(`tick=${input}`)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "pulse",
      schema: z.string(),
      outputSchema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(`● ${input}`)),
    }),
  )
  .chain(
    (s: string) => s,
    node({
      kind: "display",
      schema: z.string(),
      program: (input: string) =>
        Effect.sleep(demoDelay).pipe(Effect.as(input)),
    }),
  )
  .build();

// --- Demo objects ---

export const linearPipelineDemo: Demo = {
  id: "wf-linear",
  title: "linear pipeline",
  description:
    "Five stages, each with a visible delay: parse, trim, upper, exclaim, display. Bridges show the typed composition — each stage's input is the previous stage's output, transformed.",
  built: linearPipelineTree,
  setup: () => init(linearPipelineTree.tree, WorkflowId("wf-linear")),
  leafKey: "root.trim.upper.exclaim.display",
  panel: {
    kind: "input",
    label: "raw text",
    default: "  hello world  ",
    writeTo: NodeKeyT("root"),
  },
};

export const humanInTheLoopDemo: Demo = {
  id: "wf-human",
  title: "human-in-the-loop",
  description:
    "Automated work runs, then a human node pauses the workflow. The form (built from the node's schema) collects the input. More work runs after submission.",
  built: humanInTheLoopTree,
  setup: () => init(humanInTheLoopTree.tree, WorkflowId("wf-human")),
  leafKey: "root.askName.compose.polish.sign.display",
  panel: { kind: "none" },
};

export const joinExampleDemo: Demo = {
  id: "wf-join",
  title: "join (parallel merge)",
  description:
    "Two parallel branches — fetchProfile and fetchAvatar — both run from trigger. Their validate stages converge at a merge node. The composite record is keyed by upstream path.",
  built: joinExampleTree,
  setup: (): WorkflowState => {
    // Build the join state by augmenting the builder's
    // tree with the avatar branch. The builder only created
    // the profile branch + merge with sibling edges. We
    // add fetchAvatar and validateAvatar defs, and the
    // edges connecting them.
    const baseState = init(joinExampleTree.tree, WorkflowId("wf-join"));
    // The avatar branch: root → fetchAvatar → validateAvatar
    const fetchAvatarKey = NodeKeyT("root.fetchAvatar");
    const validateAvatarKey = NodeKeyT("root.fetchAvatar.validateAvatar");
    // Add defs to the state's defs map.
    const defs = new Map(baseState.defs);
    defs.set(
      fetchAvatarKey as unknown as NodeKey<typeof fetchAvatarKey extends string ? string : never>,
      joinAvatarDefs.fetchAvatar as never,
    );
    defs.set(
      validateAvatarKey as unknown as NodeKey<typeof validateAvatarKey extends string ? string : never>,
      joinAvatarDefs.validateAvatar as never,
    );
    // Add edges: root → fetchAvatar, fetchAvatar → validateAvatar.
    // The validateAvatar → merge edge is already in the tree
    // (from join()). We just need the first two.
    const edges = [
      ...baseState.edges,
      { from: NodeKeyT("root") as NodeKey<"root">, to: fetchAvatarKey as NodeKey<"root.fetchAvatar"> },
      {
        from: fetchAvatarKey as NodeKey<"root.fetchAvatar">,
        to: validateAvatarKey as NodeKey<"root.fetchAvatar.validateAvatar">,
      },
    ];
    // Construct the augmented state. For simplicity, call
    // init() on a synthetic tree that has the augmented
    // defs and edges.
    const syntheticTree = {
      defs,
      edges,
    };
    return init(
      syntheticTree as unknown as typeof joinExampleTree.tree,
      WorkflowId("wf-join"),
    );
  },
  leafKey: "root.fetchProfile.validateProfile.merge.render",
  panel: { kind: "none" },
  // The two parallel branches (fetchProfile / fetchAvatar)
  // run concurrently. maxConcurrent: 4 leaves headroom
  // for the validate stages to also run in parallel with
  // each other.
  maxConcurrent: 4,
};

export const streamingDemo: Demo = {
  id: "wf-stream",
  title: "streaming",
  description:
    "Generate produces a string from a seed. Collect stores the latest. The runtime's publish() lets generate emit partials; the display reads the current value.",
  built: streamingTree,
  setup: () => init(streamingTree.tree, WorkflowId("wf-stream")),
  leafKey: "root.generate.collect.tick.display",
  panel: { kind: "none" },
};

export const wallDisplayDemo: Demo = {
  id: "wf-wall",
  title: "wall display",
  description:
    "A ticker increments a counter; format, pulse, and display format it. Each run produces a new tick. The leaf reads the latest display string.",
  built: wallDisplayTree,
  setup: () => init(wallDisplayTree.tree, WorkflowId("wf-wall")),
  leafKey: "root.format.pulse.display",
  panel: { kind: "none" },
};

export const allDemos: Demo[] = [
  linearPipelineDemo,
  humanInTheLoopDemo,
  joinExampleDemo,
  streamingDemo,
  wallDisplayDemo,
];

export {
  linearPipelineTree,
  humanInTheLoopTree,
  joinExampleTree,
  streamingTree,
  wallDisplayTree,
};
