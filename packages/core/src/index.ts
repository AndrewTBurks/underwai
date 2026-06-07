// @underwai/core public entry point.
//
// Phase 1 (design) ships a single stub file with all the type
// definitions stubbed out. Phase 2 distributes the stub's contents
// across:
//   - src/keys.ts        — NodeKey<Path> brand + path template
//   - src/types.ts       — WorkflowState, Node, Edge, ResolvedInput, etc.
//   - src/composition.ts — run, then, all, thenLoop
//   - src/operations.ts  — init, findReadyNodes, publish, write, etc.
//   - src/index.ts       — this file (re-exports)
//
// See ../index.md for the full design rationale and the plan files
// that govern each piece.

export * from "./stub.js"
