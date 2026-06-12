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
  - id: ex-demo-types
    path: packages/examples/src/demo-types/index.md
  - id: ex-useDemoRuntime
    path: packages/examples/src/useDemoRuntime/index.md
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
  - id: DEC-EXAMPLES-005
    date: 2026-06-12
    author: human
    summary: "The examples page differentiates underWAI from TanStack Workflow by rendering scenario-specific miniature target applications in the left panel, not a workflow-debug stage list. Each app region is backed by graph node state and renders real pending/running/failed/stale/resolved UI; status badges stay subtle because the product UI carries the state. Human verification stages stage local form edits and use an explicit send-values button to write into the runtime. The first wave covers data QA (including a real forced quality-check failure via !!bad and repair by rerun), research triage, and incident join scenarios. (TASK-56 through TASK-59.)"
  - id: DEC-EXAMPLES-006
    date: 2026-06-12
    author: agent
    summary: "The examples package is part of the root TypeScript build lane. Root tsconfig references packages/examples so pnpm build catches broken consumer examples; the examples package tsconfig excludes test files from the app/declaration emit while vitest still owns example integration tests. (TASK-47.)"
  - id: DEC-EXAMPLES-014
    date: 2026-06-12
    author: agent
    summary: "ExampleShell is layout/navigation glue. Demo metadata lives in demo-types.ts and runtime state/effects live in useDemoRuntime.ts, so workflow definitions do not import shell component types and the controller has one authoritative runtime state source. (TASK-50.)"
human_notes: |
status: clean
last_reconciled: 2026-06-07
---

# @underwai/examples

Three deployable example workflows. Each one is a real composition that exercises a different surface of the underwai library. The example page now treats the left panel as a miniature target application, not a generic stage list: scenario renderers project graph node state into product UI regions with subtle status badges and built-in loading/error/success/stale states.

- `data QA` — uses the linear pipeline to render an import-repair table. Validates that pending/running/resolved graph state can project into local product UI regions.
- `research triage` — uses the human-in-the-loop workflow to render a claim verification desk. Validates human graph edits and downstream recomputation.
- `incident join` — uses the join workflow to render evidence lanes and a typed severity aggregate. Validates branch fan-out/fan-in and graph topology as product UI.
- `streaming` and `wall display` remain lower-priority runtime examples for current state and subscription behavior.

The examples shell is split into neutral metadata (`demo-types.ts`), runtime control (`useDemoRuntime.ts`), and visual layout (`ExampleShell.tsx`).

Run `pnpm --filter @underwai/examples dev` to start the Vite dev server. Run `pnpm --filter @underwai/examples test` to run the integration tests. Root `pnpm build` also includes the examples package so the consumer-facing app stays in the normal verification lane.
