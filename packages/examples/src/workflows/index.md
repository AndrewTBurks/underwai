---
title: "examples/workflows"
type: module
parent: ../../index.md
principles: [experience-first, type-system-discipline, exhaust-the-design-space]
decisions:
  - id: DEC-EXAMPLES-001
    date: 2026-06-07
    author: agent
    summary: "Single Vite app at packages/examples/ with three sub-routes: linear-pipeline, human-in-the-loop, wall-display. Each route is a React component that runs a real workflow and renders the result. The compositions are defined in src/workflows.ts and are the canonical examples for the rest of the docs (TASK-44)."
  - id: DEC-EXAMPLES-002
    date: 2026-06-07
    author: agent
    summary: "Example workflows use the loose NodeDefinition<unknown, unknown> pattern (with z.unknown() schemas) because the composition API does not yet support fully-typed NodeDefinition<TIn, TOut> overloads. The bridge function is `unknown => unknown` at the call site; consumer code casts at the boundary. Strong typing is a v1.1+ enhancement (TASK-44)."
  - id: DEC-EXAMPLES-003
    date: 2026-06-07
    author: agent
    summary: "A vitest suite in src/workflows.test.ts runs the three example workflows end-to-end. This replaces the runtime.test.ts fixture-based tests as the canonical \"real workflow\" integration test. The test count went from 104 -> 107 (3 new example tests)."
  - id: DEC-EXAMPLES-011
    date: 2026-06-08
    author: agent
    summary: 'Five example workflows ship in v1.0: linear-pipeline (5 stages with bridge transforms), human-in-the-loop (6 stages with a mid-graph human pause), join (parallel sibling branches merged into one composite), streaming (5 stages with delayed generation), wall-display (4 stages that tick on each re-run). Each demo is intentionally long (5-7 nodes) so the user can see the runtime process them one at a time with a visible per-node delay. (TASK-44.)'
  - id: DEC-EXAMPLES-011a
    date: 2026-06-08
    author: agent
    summary: '`demoDelay` is the per-node sleep (`"500 millis"` as const). 500ms gives a clear visual cadence for 5-7 node chains. The user can adjust this; the delay is a demo concern, not a lib feature.'
  - id: DEC-EXAMPLES-011b
    date: 2026-06-08
    author: agent
    summary: 'The join demo sets `maxConcurrent: 4` so the two parallel branches (fetchProfile / fetchAvatar) run concurrently. The other four demos default to 1 (sequential, original behavior). The runtime respects the value as a hard cap on parallel in-flight fibers (DEC-RUNNER-010). (TASK-JF-4.)'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/workflows

The five example workflows. Each one is a real composition that exercises a different surface of the underwai library.

## What lives here

The source is `workflows.ts` next to this directory.

- **`linearPipelineTree`** — 5 stages with bridge transforms. `parse → trim → upper → exclaim → display`.
- **`humanInTheLoopTree`** — 6 stages with a mid-graph human pause.
- **`joinTree`** — parallel sibling branches merged into one composite.
- **`streamingTree`** — 5 stages with delayed generation.
- **`wallDisplayTree`** — 4 stages that tick on each re-run.
- **`allDemos`** — the array of `Demo<PathMap>` objects, in display order. The shell's `demoIdx` is the index into this array.
- **`demoDelay`** — `"500 millis"` as const. The per-node sleep.

## Per-demo knobs

- The join demo sets `maxConcurrent: 4` (TASK-JF-4). The other four default to 1 (sequential, original behavior).
- The "input" demos (linear-pipeline) take a text input that writes to the root node before run.
- The "none" demos (join, streaming, wall-display) take no input from the panel — the workflow runs from defaults.
- The "human" demo (human-in-the-loop) takes a human form on a mid-graph paused node.

## Boundary

- Imports from: `effect` (peer, for `Effect.gen`, `Effect.sleep`), `zod` (peer), `@underwai/schema` (`human`), `@underwai/core` (`init`, `node`, `NodeKey`, `NodeKey` factory, `workflow`, `WorkflowId`, `WorkflowState`), `./demo-types.js` (`Demo` type).
- Exports to: `ExampleShell.tsx` (imports `allDemos`), `workflows.test.ts` (the integration test suite), and scenario/rendering modules that need demo metadata.
- **What does NOT live here:** the shell that drives these demos (in `ExampleShell.tsx`), the test suite (in `workflows.test.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
