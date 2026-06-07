// underwai — TS stub (v1)
// This file proves the v1 design compiles. Bodies are `throw new Error("not implemented")`.
// Implementation fills in body-by-body against this contract.
//
// Module map:
//   keys.ts        -> NodeKey type
//   types.ts       -> WorkflowState, Node, Edge, ResolvedInput, InputSource, NodeStatus
//   composition.ts -> run, then, all, thenLoop
//   schemas.ts     -> z.human() + .verified() extension
//   operations.ts  -> init, get, serialize, deserialize, findReadyNodes, findSubtree
//   runner.ts      -> step, publish, write, writeHumanInput
//   subscribe.ts   -> subscribe(state, key, onUpdate)
//   events.ts      -> WorkflowEvent (wire format)
//
// This stub puts everything in one file for compile-checking; the real
// implementation will split per the module map.

import { Context, Effect } from "effect"
import type { ZodType, ZodTypeAny, z } from "zod"

// =========================================================================
// keys.ts
// =========================================================================

export type NodeKey<Path extends string = string> = string & {
  readonly __path: Path
  readonly __brand: "NodeKey"
}

export type WorkflowId = string & { readonly __brand: "WorkflowId" }

export type FieldKey = string

// Constructor (used internally by composition; not exposed to consumers).
// The `as unknown as` is required because TS can't see the brand through the
// generic — the constructor adds it.
export const NodeKey = <Path extends string>(path: Path): NodeKey<Path> =>
  path as unknown as NodeKey<Path>

export const WorkflowId = (s: string): WorkflowId => s as WorkflowId

// =========================================================================
// types.ts
// =========================================================================

export type NodeStatus =
  | "pending"
  | "running"
  | "streaming"
  | "resolved"
  | "failed"
  | "paused"
  | "stale"

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"

export type Actor = "system" | "human" | (string & {})

export type HumanMode = "writeable" | "verified"

export type ResolvedInput = {
  fields: Record<FieldKey, InputSource>
}

export type InputSource =
  | { kind: "literal"; value: unknown }
  | { kind: "from_node"; nodeId: NodeKey }
  | {
      kind: "human"
      fieldSchema: ZodTypeAny
      value?: unknown
      status: "pending" | "set"
    }

export type Node = {
  id: NodeKey
  kind: string
  label?: string

  inputSchema: ZodTypeAny
  input: ResolvedInput
  // Computed from inputSchema at init(). Tells the runner which fields are
  // human-writable and whether they require pre-run confirmation.
  humanFields: ReadonlyMap<FieldKey, HumanMode>

  outputSchema: ZodTypeAny
  output?: unknown
  outputPartial: boolean
  finalOutput?: unknown
  status: NodeStatus

  actor: Actor
  createdAt: string
  updatedAt: string
}

export type Edge = {
  from: NodeKey
  to: NodeKey
  toField: FieldKey
}

export type SerializedError = {
  nodeId: NodeKey
  message: string
  cause?: SerializedError
}

export type WorkflowState = {
  id: WorkflowId
  version: number
  status: WorkflowStatus

  // Key-addressable. O(1) lookup.
  nodes: Record<string, Node>
  // Edges are structural metadata; not directly addressed.
  edges: ReadonlyArray<Edge>

  createdAt: string
  updatedAt: string
  error?: SerializedError
}

// =========================================================================
// schemas.ts — z.human() + .verified() extension
// =========================================================================

export type HumanSchema<T extends ZodTypeAny> = T & {
  __humanMode: HumanMode
  verified(): HumanSchema<T>
}

declare module "zod" {
  namespace z {
    function human<T extends ZodTypeAny>(schema: T): HumanSchema<T>
  }
}

// =========================================================================
// composition.ts — the only ways to create nodes
// =========================================================================

export type NodeRef<Path extends string = string> = {
  readonly key: NodeKey<Path>
}

export type NodeDefinition<TInput = unknown, TOutput = unknown> = {
  kind: string
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  program: (input: TInput) => Effect.Effect<TOutput, Error, never>
}

export function run<S extends ZodTypeAny>(
  _def: NodeDefinition<z.infer<S>, unknown>,
): NodeRef<"root"> {
  throw new Error("not implemented")
}

export function then<S extends ZodTypeAny>(
  _parent: NodeRef,
  _def: NodeDefinition<z.infer<S>, unknown>,
): NodeRef<string> {
  throw new Error("not implemented")
}

// Overloaded: array form returns a discriminated union; object form returns a record.
// Implementation uses overload signatures, then a single implementation body.
export type AllRef = NodeRef<string> & {
  // Array form: discriminated union output. Object form: record output.
  // The output type is computed by the implementation from the input shape.
}

export interface All {
  (...args: ReadonlyArray<NodeRef>): NodeRef<string>
  (args: Readonly<Record<string, NodeRef>>): NodeRef<string>
}

export const all: All = ((..._args: unknown[]): NodeRef<string> => {
  throw new Error("not implemented")
}) as All

export function thenLoop<B, P>(
  _body: (prev: NodeRef) => NodeRef,
  _predicate: (current: NodeRef) => NodeRef,
): NodeRef<string> {
  throw new Error("not implemented")
}

// =========================================================================
// operations.ts
// =========================================================================

export function init(_root: NodeRef): WorkflowState {
  throw new Error("not implemented")
}

export function getNode(_state: WorkflowState, _key: NodeKey): Node {
  throw new Error("not implemented")
}

export function serialize(_state: WorkflowState): string {
  throw new Error("not implemented")
}

export function deserialize(_json: string): WorkflowState {
  throw new Error("not implemented")
}

export function findReadyNodes(_state: WorkflowState): Set<NodeKey> {
  throw new Error("not implemented")
}

export function findSubtree(
  _state: WorkflowState,
  _root: NodeKey,
): Set<NodeKey> {
  throw new Error("not implemented")
}

// =========================================================================
// runner.ts
// =========================================================================

export function stepInternal(_state: WorkflowState): WorkflowState {
  throw new Error("not implemented")
}

// Primary API: the lib owns the runner fiber. Consumers drive the
// workflow forward by running this Effect program. The
// `WorkflowRuntime` service is provided as a layer for the duration
// of the program; consumer Effect.gen programs that run inside
// `runWorkflow` yield the service to call publish / write /
// writeHumanInput.
//
// The class IS the value and the type (Effect's Context.Tag idiom).
// Consumers do `yield* WorkflowRuntime` in their Effect.gen program;
// `runWorkflow` provides the live implementation as a layer.
export class WorkflowRuntime extends Context.Tag(
  "@underwai/WorkflowRuntime",
)<
  WorkflowRuntime,
  {
    publish(partial: unknown): Effect.Effect<void>
    write(finalOutput: unknown): Effect.Effect<void>
    writeHumanInput(fieldKey: FieldKey, value: unknown): Effect.Effect<void>
  }
>() {}

export function runWorkflow(
  _definition: NodeDefinition,
  _state?: WorkflowState,
): Effect.Effect<WorkflowState, never, never> {
  throw new Error("not implemented")
}

export function publish(
  _state: WorkflowState,
  _key: NodeKey,
  _partial: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

export function write(
  _state: WorkflowState,
  _key: NodeKey,
  _finalOutput: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

export function writeHumanInput(
  _state: WorkflowState,
  _nodeKey: NodeKey,
  _fieldKey: FieldKey,
  _value: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

// =========================================================================
// subscribe.ts — two subscription methods, one for each job
// =========================================================================

export type Subscription = {
  unsubscribe(): void
}

// 1. Single node, exact match. The callback gets the full updated
// Node. Use this for: "I care about exactly this node."
export function subscribe(
  _state: WorkflowState,
  _key: NodeKey,
  _onUpdate: (node: Node) => void,
): Subscription {
  throw new Error("not implemented")
}

// 2. Wildcard pattern. The pattern is a string with three cases,
// all in one method:
//   - "root.x" — exact key, one-entry record in the callback
//   - "root.*" — path-segment prefix, matches every descendant of
//     "root." Prefix is stripped from the keys in the callback.
//   - "*" — every node, prefix is empty, keys are full original.
//
// The callback gets the matched set as a Record keyed by relative
// key. For the exact-key case, the record has one entry. For the
// path-segment case, the keys are the matched node's key with the
// pattern's prefix stripped. For "*", the keys are the full
// original keys. subscribeSet is a "namespace raise," not a
// filter.
export function subscribeSet(
  _state: WorkflowState,
  _pattern: string,
  _onUpdate: (nodes: Record<string, Node>) => void,
): Subscription {
  throw new Error("not implemented")
}

// =========================================================================
// events.ts — wire format (v1.1+; in-process uses Node-granularity)
// =========================================================================

export type WorkflowEvent =
  | { type: "node:status"; nodeId: NodeKey; status: NodeStatus }
  | { type: "node:partial"; nodeId: NodeKey; output: unknown }
  | { type: "node:resolved"; nodeId: NodeKey; output: unknown }
  | { type: "node:failed"; nodeId: NodeKey; error: SerializedError }
  | { type: "workflow:status"; status: WorkflowStatus }

// =========================================================================
// Type inference from schemas (helper for consumers)
// =========================================================================

export type InferNodeInput<N extends Node> = N["inputSchema"] extends ZodTypeAny
  ? z.infer<N["inputSchema"]>
  : never

export type InferNodeOutput<N extends Node> = N["outputSchema"] extends ZodTypeAny
  ? z.infer<N["outputSchema"]>
  : never
