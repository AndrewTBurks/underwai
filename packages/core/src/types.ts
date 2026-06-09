// @underwai/core — types.ts
//
// The data structure. The shape is locked in the design phase; this
// file is the source of truth for the runtime types. The canonical
// per-status semantics live in .cns/architecture/node.md; see that
// file for the rationale and the valid state transitions.
//
// Per-status data lives on the variants that own it. There is no
// top-level `output` or `finalOutput`; both are on the `streaming`
// and `resolved` variants. This makes illegal states
// unrepresentable at the type level.
//
// Storage shape: Maps, not Records. The NodeKey brand is preserved
// end-to-end because Map keys accept any branded type. Records
// can't enforce branded keys and force `as unknown as string` casts
// everywhere (per principle-type-system-discipline, branded
// primitives that don't actually fire are lies to the compiler).

import type { Effect } from "effect";
import type { ZodTypeAny } from "zod";
import type { HumanMode } from "@underwai/schema";
import type { FieldKey, NodeKey, WorkflowId } from "./keys.js";

export type { FieldKey, HumanMode, NodeKey, WorkflowId };

export type Actor = string;

export type NodeStatus =
  | { kind: "pending" }
  | { kind: "running"; startedAt: string }
  | { kind: "streaming"; output: unknown; outputPartial: boolean }
  | { kind: "resolved"; finalOutput: unknown; resolvedAt: string }
  | { kind: "failed"; error: SerializedError; failedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "stale"; previousOutput?: unknown };

export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

export type HumanInputDisplay =
  | { source: "literal"; value: unknown; fieldSchema: ZodTypeAny }
  | { source: "from_node"; value: unknown; fieldSchema: ZodTypeAny; upstream: NodeKey }
  | { source: "human"; value: unknown; fieldSchema: ZodTypeAny; status: "pending" | "set" }
  | undefined;

export type ResolvedInput = {
  value: unknown;
  schema: ZodTypeAny;
  humanFields: ReadonlyMap<FieldKey, HumanMode>;
};

export type Node = {
  id: NodeKey;
  kind: string;
  label?: string;

  inputSchema: ZodTypeAny;
  input: ResolvedInput;

  outputSchema: ZodTypeAny;

  status: NodeStatus;

  actor: Actor;
  createdAt: string;
  updatedAt: string;
};

export type Edge = {
  from: NodeKey;
  to: NodeKey;
  bridge?: (parentOut: unknown) => unknown;
};

export type SerializedError = {
  nodeId: NodeKey;
  message: string;
  cause?: SerializedError;
};

// NodeDefinition is the composition's view of a node: the schema
// the runtime validates against, and the program that runs.
// TIn/TOut are derived from the Zod schemas at the `node()` call.
export type NodeDefinition<TIn = unknown, TOut = unknown, K extends string = string> = {
  kind: K;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  program: (input: TIn) => Effect.Effect<TOut, Error, never>;
};

// WorkflowState is the runtime's "loose" view: every node, edge,
// and def is stored under its NodeKey. The typed view (TypedNode)
// is what the consumer reads; see view() in composition.ts.
export type WorkflowState = {
  id: WorkflowId;
  version: number;
  status: WorkflowStatus;

  nodes: ReadonlyMap<NodeKey, Node>;
  edges: ReadonlyArray<Edge>;

  edgesByTarget: ReadonlyMap<NodeKey, ReadonlyArray<Edge>>;
  edgesByFrom: ReadonlyMap<NodeKey, ReadonlyArray<Edge>>;

  // Defs captured at compose time. The runtime reads
  // `state.defs.get(key).program` to invoke a node's program.
  // This is the single source of truth; the consumer does not
  // thread a separate programs record.
  defs: ReadonlyMap<NodeKey, NodeDefinition>;

  createdAt: string;
  updatedAt: string;
  error?: SerializedError;
};

export type NodeRef<Path extends string = string> = {
  readonly key: NodeKey<Path>;
};

// CompositionTree is the composition's "loose" view: a root ref,
// the defs (Map<NodeKey, NodeDefinition>), and the edges. This
// is the data the runtime needs to drive the workflow; the
// typed view (TypedTree) is what the consumer reads.
export type CompositionTree = {
  root: NodeRef;
  defs: Map<NodeKey, NodeDefinition>;
  edges: ReadonlyArray<Edge>;
};

// Serialized form of WorkflowState. Maps become arrays of
// [key, value] entries; reconstruct on deserialize.
export type SerializedState = {
  id: string;
  version: number;
  status: WorkflowStatus;
  nodes: Array<[string, SerializedNode]>;
  edges: Array<{ from: string; to: string; hasBridge: boolean }>;
  createdAt: string;
  updatedAt: string;
  error?: SerializedError;
};

export type SerializedNode = {
  id: string;
  kind: string;
  label?: string;
  inputSchemaJson: string;
  inputValue: unknown;
  outputSchemaJson: string;
  status: NodeStatus;
  actor: Actor;
  createdAt: string;
  updatedAt: string;
};
