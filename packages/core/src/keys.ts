// @underwai/core — keys.ts
//
// NodeKey is a branded string with a path type parameter. The path
// generic threads through the composition API (run, then, all,
// thenLoop) so the consumer's subscribe(state, ref.key, ...) call is
// type-checked against the ref's path. A wrong node ref at a
// subscribe call site is a compile error, not a runtime lookup miss.
//
// WorkflowId identifies a workflow instance. FieldKey is an
// unbranded string (the human mode vocabulary is "writeable" or
// "verified"; the path inside a node is opaque to the lib).

export type NodeKey<Path extends string = string> = string & {
  readonly __path: Path
  readonly __brand: "NodeKey"
}

export type WorkflowId = string & { readonly __brand: "WorkflowId" }

export type FieldKey = string

export const NodeKey = <Path extends string>(path: Path): NodeKey<Path> =>
  path as unknown as NodeKey<Path>

export const WorkflowId = (s: string): WorkflowId => s as WorkflowId
