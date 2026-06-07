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

export type WorkflowState = {
  id: WorkflowId;
  version: number;
  status: WorkflowStatus;

  nodes: Record<string, Node>;
  edges: ReadonlyArray<Edge>;

  edgesByTarget: Record<NodeKey, ReadonlyArray<Edge>>;
  edgesByFrom: Record<NodeKey, ReadonlyArray<Edge>>;

  createdAt: string;
  updatedAt: string;
  error?: SerializedError;
};
