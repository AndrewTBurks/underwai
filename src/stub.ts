// underwai — TS stub
// This file proves the v1 design compiles. Bodies are `throw new Error("not implemented")`.
// Implementation fills in body-by-body against this contract.
//
// Module map:
//   types.ts        -> WorkflowState, Node, Edge, ResolvedInput, InputSource
//   schemas.ts      -> Zod extensions
//   operations.ts   -> init, get, serialize, deserialize, findReadyNodes, findSubtree
//   events.ts       -> WorkflowEvent union
//   runner.ts       -> runWorkflow (publish, write, writeHumanInput operations)
//   subscribe.ts    -> subscribe() over the event stream
//   transports/     -> in-process, sse (v1.1), ws (v1.1)
//   renderers/      -> react (v1.1), no-op
//
// This stub puts everything in one file for compile-checking; the real
// implementation will split per the module map.

import { Effect } from "effect"
import type { ZodTypeAny } from "zod"

// =========================================================================
// types.ts
// =========================================================================

export type WorkflowId = string & { readonly __brand: "WorkflowId" }
export type NodeId = string & { readonly __brand: "NodeId" }
export type FieldKey = string

export type NodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "streaming"
  | "resolved"
  | "failed"
  | "paused"

export type Actor = "system" | "human" | (string & {})

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"

export type ResolvedInput = {
  fields: Readonly<Record<FieldKey, InputSource>>
}

export type InputSource =
  | { kind: "literal"; value: unknown }
  | { kind: "from_node"; nodeId: NodeId }
  | {
      kind: "human"
      fieldSchema: ZodTypeAny
      value?: unknown
      status: "pending" | "set"
    }

export type Node = {
  id: NodeId
  kind: string
  label?: string
  inputSchema: ZodTypeAny
  input: ResolvedInput
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
  from: NodeId
  to: NodeId
  toField: FieldKey
}

export type SerializedError = {
  nodeId: NodeId
  message: string
  cause?: SerializedError
}

export type WorkflowState = {
  id: WorkflowId
  version: number
  status: WorkflowStatus
  nodes: ReadonlyArray<Node>
  edges: ReadonlyArray<Edge>
  inputs: ReadonlyArray<NodeId>
  outputs: ReadonlyArray<NodeId>
  createdAt: string
  updatedAt: string
  error?: SerializedError
}

// =========================================================================
// schemas.ts — Zod extension
// =========================================================================

// Augmented in src/schemas.ts. The augmentation declaration is in a separate
// .d.ts file so consumers can import it once and get typing on all their
// Zod schemas.
//
// (The runtime implementation lives in src/schemas.ts and patches the
// ZodType prototype with `humanUpdatable()`. The declaration is here in the
// stub for compile-checking.)

declare module "zod" {
  interface ZodType {
    humanUpdatable(): ZodType
  }
}

// =========================================================================
// operations.ts — state-derivation functions
// =========================================================================

export function init(_definition: WorkflowDefinition): WorkflowState {
  throw new Error("not implemented")
}

export function getNode(_state: WorkflowState, _id: NodeId): Node {
  throw new Error("not implemented")
}

export function serialize(_state: WorkflowState): string {
  throw new Error("not implemented")
}

export function deserialize(_json: string): WorkflowState {
  throw new Error("not implemented")
}

export function findReadyNodes(
  _state: WorkflowState,
): ReadonlyArray<NodeId> {
  throw new Error("not implemented")
}

export function findSubtree(
  _state: WorkflowState,
  _root: NodeId,
): ReadonlyArray<NodeId> {
  throw new Error("not implemented")
}

// =========================================================================
// events.ts
// =========================================================================

export type WorkflowEvent =
  | { type: "node:ready"; nodeId: NodeId }
  | { type: "node:running"; nodeId: NodeId }
  | { type: "node:partial"; nodeId: NodeId; output: unknown }
  | { type: "node:resolved"; nodeId: NodeId; output: unknown }
  | { type: "node:failed"; nodeId: NodeId; error: SerializedError }
  | { type: "node:paused"; nodeId: NodeId; field: FieldKey }
  | { type: "workflow:completed"; output: unknown }
  | { type: "workflow:failed"; error: SerializedError }

// =========================================================================
// runner.ts — mutation operations
// =========================================================================

export function publish(
  _state: WorkflowState,
  _id: NodeId,
  _partial: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

export function write(
  _state: WorkflowState,
  _id: NodeId,
  _finalOutput: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

export function writeHumanInput(
  _state: WorkflowState,
  _nodeId: NodeId,
  _field: FieldKey,
  _value: unknown,
): WorkflowState {
  throw new Error("not implemented")
}

export function runWorkflow(
  _definition: WorkflowDefinition,
  _state?: WorkflowState,
): {
  state: WorkflowState
  events: AsyncIterable<WorkflowEvent>
} {
  throw new Error("not implemented")
}

// =========================================================================
// subscribe.ts
// =========================================================================

export type Subscription = {
  unsubscribe(): void
}

export function subscribe(
  _events: AsyncIterable<WorkflowEvent>,
  _target: NodeId | "root",
  _onEvent: (event: WorkflowEvent) => void,
): Subscription {
  throw new Error("not implemented")
}

// =========================================================================
// transports/in-process.ts — grafted from Candidate 2
// =========================================================================

export type WorkflowEventBus = {
  emit(event: WorkflowEvent): void
  on(handler: (event: WorkflowEvent) => void): () => void
}

export function createInProcessBus(): WorkflowEventBus {
  throw new Error("not implemented")
}

// =========================================================================
// types.ts (continued) — type inference from schemas
// =========================================================================

export type InferNodeInput<N extends Node> = N["inputSchema"] extends ZodTypeAny
  ? import("zod").infer<N["inputSchema"]>
  : never

export type InferNodeOutput<N extends Node> = N["outputSchema"] extends ZodTypeAny
  ? import("zod").infer<N["outputSchema"]>
  : never

// =========================================================================
// definition.ts — consumer-facing types
// =========================================================================

export type NodeDefinition = {
  id: NodeId
  kind: string
  inputSchema: ZodTypeAny
  outputSchema: ZodTypeAny
  program: (input: unknown) => Effect.Effect<unknown, Error, never>
}

export type WorkflowDefinition = {
  name: string
  version: number
  nodes: ReadonlyArray<NodeDefinition>
  edges: ReadonlyArray<Edge>
  inputs: ReadonlyArray<NodeId>
  outputs: ReadonlyArray<NodeId>
}

// =========================================================================
// Constructor helpers — branded ids
// =========================================================================

export const WorkflowId = (s: string): WorkflowId => s as WorkflowId
export const NodeId = (s: string): NodeId => s as NodeId
