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

// Node lifecycle. The discriminator is `status.kind`. Each variant
// carries only the data that variant owns — there is no `output` on
// `pending`, no `error` on `running`, no `outputPartial` on
// `resolved`. The type system enforces "illegal states are
// unrepresentable" at the node level. Shared fields (id, kind,
// inputSchema, etc.) live on `Node`; the per-status data lives
// here. See the `Node` type for the full shape.
export type NodeStatus =
  | { kind: "pending" }
  | { kind: "running"; startedAt: string }
  | { kind: "streaming"; output: unknown; outputPartial: boolean }
  | { kind: "resolved"; finalOutput: unknown; resolvedAt: string }
  | { kind: "failed"; error: SerializedError; failedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "stale"; previousOutput?: unknown }

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"       // at least one node is paused on verified input
  | "completed"
  | "failed"

export type Actor = string
// Convention (not enforced by the type system): "system" for
// the lib's own operations, "human" for human-driven operations
// (writeHumanInput, etc.), any other string for consumer-defined
// roles ("orchestrator", "reviewer", "agent-1", etc.). The lib
// doesn't validate the actor; the consumer is responsible for
// using meaningful values.

export type HumanMode = "writeable" | "verified"

// Node input. Direct match: parent's output IS child's input, same
// shape. The composition API has two overloads of .then():
// `parent.then(child)` for direct match, and
// `parent.then((out) => in_, child)` for a bridge function. The
// bridge is composition metadata (stored on the Edge as
// `Edge.bridge`), not a node. The runner applies the bridge at
// edge resolution. ResolvedInput is a single value, not a
// per-field bundle, because the composition API enforces shape
// match.
export type ResolvedInput = {
  value: unknown
  schema: ZodTypeAny
  humanFields: ReadonlyMap<FieldKey, HumanMode>
}

// Node. Shared fields are on the type once. Per-status data lives
// in `node.status` (a discriminated union). The lib derives the
// human-fields view on read via `getHumanFields(node)` — no
// `humanFields` cache on the node. Output/error/etc. live on the
// status variants that own them.
export type Node = {
  id: NodeKey
  kind: string
  label?: string

  inputSchema: ZodTypeAny
  input: ResolvedInput

  outputSchema: ZodTypeAny

  // The current node status. The kind discriminator tells you
  // which fields are present (output, error, etc.).
  status: NodeStatus

  actor: Actor
  createdAt: string
  updatedAt: string
}

export type Edge = {
  from: NodeKey
  to: NodeKey
  // Optional bridge: transforms `from`'s output to `to`'s input
  // shape. The composition API's `parent.then((out) => in_, child)`
  // overload provides this. Direct match (no bridge) is the
  // default. Bridges are composition metadata, not nodes.
  bridge?: (parentOut: unknown) => unknown
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

  // Derived fields. Computed at init() and on deserialize().
  // NOT serialized — recomputed from `edges` on every deserialize.
  // See the "Serialization contract" section in design.md.
  edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>
  edgesByFrom: Record<NodeKey, ReadonlyArray<Edge>>

  createdAt: string
  updatedAt: string
  error?: SerializedError
}

// =========================================================================
// schemas.ts — z.human() + .verified() extension
// =========================================================================

export type HumanSchema<T extends ZodTypeAny> = T & {
  readonly __humanMode: HumanMode
  verified(): HumanSchema<T>
}

// Runtime implementation: clone the schema, mutate the clone's
// _def.humanMode. Target: Zod 3.x. Zod 4.x's .meta() API is the
// principled answer for a future version.
export function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
  const wrapped = ((schema as unknown as { clone?: () => T }).clone?.() ?? schema) as HumanSchema<T>
  ;(wrapped._def as { humanMode?: HumanMode }).humanMode = "writeable"
  ;(wrapped as { verified?: () => HumanSchema<T> }).verified = function(
    this: HumanSchema<T>,
  ) {
    ;(this._def as { humanMode?: HumanMode }).humanMode = "verified"
    return this
  }
  return wrapped
}

// Helper the lib uses at init() to walk an input schema and
// populate the human-fields view (post-TASK-K: derived on read).
export function getHumanMode(schema: ZodTypeAny): HumanMode | undefined {
  return (schema._def as { humanMode?: HumanMode } | undefined)?.humanMode
}

// Derive the human-fields map for a node by walking its
// inputSchema. Replaces the cached `node.humanFields` that used
// to live on the Node type. Read-only; the lib never mutates
// the schema, so the derived map is stable for the node's
// lifetime. Cheap to compute for the typical <10-field schema.
export function getHumanFields(
  node: Node,
): ReadonlyMap<FieldKey, HumanMode> {
  // Stub: Phase 2 implements the schema walk. The lib reads the
  // mode via getHumanMode(schema) at every level of the schema
  // tree and returns a map from field key to mode. The shape is
  // read-only; consumers don't mutate.
  void node
  throw new Error("not implemented")
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

// Composition API — the only ways to create nodes. The path is
// type-checked end-to-end: `parent.then(child)` returns
// `NodeRef<`${P}.${K}`>` where P is the parent's path and K is
// the child's kind. The consumer's `subscribe(state, ref.key, ...)`
// call is then type-checked against the ref's path.
//
// Two overloads of `.then()`:
//   - Direct match: `parent.then(child)` — parent.output shape === child.input shape.
//   - Bridge:       `parent.then((out) => in_, child)` — bridge function transforms
//                   parent's output to child's input shape. The bridge is
//                   composition metadata (stored on the Edge as `Edge.bridge`),
//                   not a node.
export function then<P extends string, K extends string, S extends ZodTypeAny>(
  _parent: NodeRef<P>,
  _def: NodeDefinition<z.infer<S>, unknown> & { kind: K },
): NodeRef<`${P}.${K}`>
export function then<P extends string, TOut, TIn, K extends string>(
  _parent: NodeRef<P>,
  _bridge: (parentOut: TOut) => TIn,
  _def: NodeDefinition<TIn, unknown> & { kind: K },
): NodeRef<`${P}.${K}`>
export function then(
  _parent: NodeRef<string>,
  _arg2:
    | (NodeDefinition<unknown, unknown> & { kind: string })
    | ((parentOut: unknown) => unknown),
  _arg3?: NodeDefinition<unknown, unknown> & { kind: string },
): NodeRef<string> {
  throw new Error("not implemented")
}

// `all` produces a node whose path is parent's path + ".all" (array
// form) or parent's path + ".all." + key (object form). The array
// form's "N" is a wildcard; subscribeSet enumerates the family.
export function all<P extends string>(
  _parent: NodeRef<P>,
  ..._refs: [...NodeRef[]]
): NodeRef<`${P}.all`>
export function all<P extends string>(
  _parent: NodeRef<P>,
  _refs: Record<string, NodeRef>,
): NodeRef<`${P}.all.${string}`>
export function all(
  _parent: NodeRef<string>,
  ..._args: unknown[]
): NodeRef<string> {
  throw new Error("not implemented")
}

// `thenLoop` produces a family of nodes whose path is parent's
// path + "." + the body's kind. The family enumeration (N, final)
// is the runner's job; subscribeSet is the consumer's path to
// addressing individual iterations.
export function thenLoop<P extends string, K extends string>(
  _parent: NodeRef<P>,
  _body: (prev: NodeRef<`${P}.${K}`>) => NodeRef<`${P}.${K}`>,
  _predicate: (current: NodeRef<`${P}.${K}`>) => NodeRef,
): NodeRef<`${P}.${K}`> {
  throw new Error("not implemented")
}

// =========================================================================
// operations.ts
// =========================================================================

// Helper the renderer uses to render a human-editable field. The
// return type is a discriminated union on source kind: the lib
// exposes the source (literal / from_node / human); the renderer
// decides the UX (proposal prefix, confirmation step, etc.).
// TASK-S reshaped: this is not a `proposed: boolean` flag. The
// renderer reads the source kind and renders accordingly.
export type HumanInputDisplay =
  | { source: "literal"; value: unknown; fieldSchema: ZodTypeAny }
  | { source: "from_node"; value: unknown; fieldSchema: ZodTypeAny; upstream: NodeKey }
  | { source: "human"; value: unknown; fieldSchema: ZodTypeAny; status: "pending" | "set" }
  | undefined

export function getHumanInputDisplay(
  _node: Node,
  _fieldKey: FieldKey,
): HumanInputDisplay {
  throw new Error("not implemented")
}

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
