// @underwai/core public entry point.
//
// Re-exports the data structure (types), keys, composition API,
// and operations. The pre-shard stub.ts is no longer needed; the
// real implementation is distributed across keys.ts, types.ts,
// composition.ts, and operations.ts.
//
// Per the design: the lib trusts its internal types and parses
// external data. Internal types are re-exported as-is; external
// data is parsed at the boundary (init, deserialize).

// Keys (value)
export { NodeKey, WorkflowId } from "./keys.js"
export type { FieldKey, WorkflowId as WorkflowIdT } from "./keys.js"

// Data structure (type-only). NodeKey is re-exported as a type from
// keys.ts (the canonical source) — types.ts imports it from there.
export type {
  Actor,
  Edge,
  HumanInputDisplay,
  Node,
  NodeStatus,
  ResolvedInput,
  SerializedError,
  WorkflowState,
  WorkflowStatus,
} from "./types.js"

// Composition API
export { all, chain, compose, run, thenLoop } from "./composition.js"
export type { CompositionTree, NodeDefinition, NodeRef } from "./composition.js"

// Operations
export {
  deserialize,
  findReadyNodes,
  findSubtree,
  getHumanFields,
  getHumanInputDisplay,
  getNode,
  init,
  resolveInput,
  serialize,
} from "./operations.js"

// Live subscription registry. The transport layer wraps this with
// pattern matching; renderers wrap it with React useSyncExternalStore.
export { LiveSubscriptionRegistry } from "./live.js"
export type { LiveCallback } from "./live.js"
