// @underwai/runner public entry point.
//
// Phase 1 ships an empty package. Phase 2 implements:
//   - src/find-ready.ts    — findReadyNodes (Kahn's algorithm)
//   - src/mutations.ts     — publish, write, writeHumanInput
//   - src/step-internal.ts — internal step primitive
//   - src/runtime.ts       — WorkflowRuntime Effect service
//   - src/run-workflow.ts  — main Effect program (owns the fiber)
//
// See ../index.md for the design rationale.

export {}
