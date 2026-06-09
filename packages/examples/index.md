---
title: "@underwai/examples"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
links:
  - id: ex-workflows
    path: packages/examples/src/workflows/index.md
  - id: ex-ExampleShell
    path: packages/examples/src/ExampleShell/index.md
  - id: ex-RenderedPanel
    path: packages/examples/src/RenderedPanel/index.md
  - id: ex-Graph
    path: packages/examples/src/Graph/index.md
  - id: ex-EventLog
    path: packages/examples/src/EventLog/index.md
  - id: ex-HumanForm
    path: packages/examples/src/HumanForm/index.md
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
    summary: 'A vitest suite in src/workflows.test.ts runs the three example workflows end-to-end. This replaces the runtime.test.ts fixture-based tests as the canonical "real workflow" integration test. The test count went from 104 -> 107 (3 new example tests).'
  - id: DEC-EXAMPLES-004
    date: 2026-06-08
    author: agent
    summary: '`Demo` type carries an optional `maxConcurrent?: number` that propagates from `ExampleShell` to `WorkflowRuntime.run`. The join demo opts in to `maxConcurrent: 4`; the others default to 1 (sequential, original behavior). The runtime respects the value as a hard cap on parallel in-flight fibers (DEC-RUNNER-010). Graph layout detects fan-in groups (≥2 incoming edges to the same target) and renders them as cubic Béziers with distinct y-coordinates; single-source edges stay straight. (TASK-JF-2, TASK-JF-4, .cns/plans/join-fixes/.)'
human_notes: |
status: dirty
last_reconciled: 2026-06-07
---

# @underwai/examples

Three deployable example workflows. Each one is a real composition that exercises a different surface of the underwai library.

- `linear-pipeline` — a 2-node pipeline with a bridge transform (trim + uppercase). Validates the bridge resolution from TASK-35.
- `human-in-the-loop` — a 3-node workflow where the consumer injects a value via `WorkflowRuntime.writeHumanInput`. Validates the consumer-injection API from TASK-37.
- `wall-display` — a 2-node workflow with a live subscription via `transport.subscribeSet`. Validates the live-subscription contract from TASK-32 + TASK-36.

Run `pnpm --filter @underwai/examples dev` to start the Vite dev server. Run `pnpm --filter @underwai/examples test` to run the integration tests.
