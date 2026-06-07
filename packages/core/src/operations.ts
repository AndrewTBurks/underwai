// @underwai/core — operations.ts
//
// State derivations and mutations on a WorkflowState. The composition
// API (composition.ts) describes the DAG shape; operations.ts acts
// on a constructed WorkflowState.
//
// init: build a WorkflowState from a composition. (Stub for now;
// the runner uses these primitives directly.)
//
// getHumanFields: derive the human-mode map by walking a node's
// inputSchema. Replaces the cached `node.humanFields` field that
// used to live on the Node type. (TASK-K, folded into TASK-G.)
//
// getHumanInputDisplay: helper for renderers. Returns a discriminated
// union on source kind: literal / from_node / human. (TASK-S.)
//
// findReadyNodes: returns ReadonlyArray<NodeKey> in dependency order
// (Kahn's algorithm using edgesByFrom). paused is NOT in the result.
// (TASK-O, TASK-R.)
//
// A node is ready iff:
//   1. status.kind === "pending" or "stale" (not paused/running/etc.)
//   2. all upstream nodes are status.kind === "resolved"

import type { ZodTypeAny } from "zod";
import { NodeKey, WorkflowId, type FieldKey } from "./keys.js";
import { getHumanMode } from "@underwai/schema";
import type {
  Edge,
  HumanInputDisplay,
  Node,
  NodeKey as NodeKeyT,
  ResolvedInput,
  SerializedError,
  WorkflowState,
} from "./types.js";
import { z } from "zod";

// init: build a WorkflowState from a CompositionTree. Walks the
// tree's defs, creates a Node for each, applies edges with bridges,
// and builds the derived indices.
export function init(
  tree: import("./composition.js").CompositionTree,
  id: WorkflowId,
): WorkflowState {
  const now = new Date().toISOString();
  const nodes: Record<string, Node> = {};
  for (const [key, def] of tree.defs.entries()) {
    nodes[key] = {
      id: key as never,
      kind: def.kind,
      inputSchema: def.inputSchema as ZodTypeAny,
      input: {
        value: undefined,
        schema: def.inputSchema as ZodTypeAny,
        humanFields: new Map(),
      },
      outputSchema: def.outputSchema as ZodTypeAny,
      status: { kind: "pending" },
      actor: "system",
      createdAt: now,
      updatedAt: now,
    };
  }
  // Build derived fields.
  const edgesByTarget: Record<NodeKeyT, ReadonlyArray<Edge>> = {};
  const edgesByFrom: Record<NodeKeyT, ReadonlyArray<Edge>> = {};
  for (const e of tree.edges) {
    const t = e.to as unknown as string;
    const f = e.from as unknown as string;
    const tgts = (edgesByTarget[t as unknown as NodeKeyT] ?? []) as Edge[];
    tgts.push(e);
    edgesByTarget[t as unknown as NodeKeyT] = tgts;
    const srcs = (edgesByFrom[f as unknown as NodeKeyT] ?? []) as Edge[];
    srcs.push(e);
    edgesByFrom[f as unknown as NodeKeyT] = srcs;
  }
  return {
    id,
    version: 1,
    status: "pending",
    nodes,
    edges: tree.edges,
    edgesByTarget,
    edgesByFrom,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNode(state: WorkflowState, key: NodeKeyT): Node {
  const node = state.nodes[key as unknown as string];
  if (!node) throw new Error(`node not found: ${key as unknown as string}`);
  return node;
}

export function serialize(state: WorkflowState): string {
  // Serialized form: id, version, status, nodes, edges, createdAt,
  // updatedAt, error. The derived fields (edgesByTarget, edgesByFrom)
  // are NOT serialized — they're recomputed on deserialize.
  const { edgesByTarget: _et, edgesByFrom: _ef, ...rest } = state;
  return JSON.stringify(rest);
}

function buildIndex(edges: ReadonlyArray<Edge>): {
  edgesByTarget: Record<NodeKeyT, ReadonlyArray<Edge>>;
  edgesByFrom: Record<NodeKeyT, ReadonlyArray<Edge>>;
} {
  const byTarget: Record<string, Edge[]> = {};
  const byFrom: Record<string, Edge[]> = {};
  for (const e of edges) {
    const t = e.to as unknown as string;
    const f = e.from as unknown as string;
    (byTarget[t] ??= []).push(e);
    (byFrom[f] ??= []).push(e);
  }
  const edgesByTarget: Record<NodeKeyT, ReadonlyArray<Edge>> = {};
  const edgesByFrom: Record<NodeKeyT, ReadonlyArray<Edge>> = {};
  for (const k of Object.keys(byTarget)) {
    edgesByTarget[k as unknown as NodeKeyT] = byTarget[k] as ReadonlyArray<Edge>;
  }
  for (const k of Object.keys(byFrom)) {
    edgesByFrom[k as unknown as NodeKeyT] = byFrom[k] as ReadonlyArray<Edge>;
  }
  return { edgesByTarget, edgesByFrom };
}

export function deserialize(json: string): WorkflowState {
  const parsed = JSON.parse(json) as Omit<WorkflowState, "edgesByTarget" | "edgesByFrom">;
  const { edgesByTarget, edgesByFrom } = buildIndex(parsed.edges);
  return { ...parsed, edgesByTarget, edgesByFrom };
}

// isReady: a node is ready iff it is pending/stale AND all upstream
// nodes are resolved (or it has no upstream).
function isReady(state: WorkflowState, id: string, upstream: ReadonlyArray<string>): boolean {
  const n = state.nodes[id];
  if (!n) return false;
  if (n.status.kind !== "pending" && n.status.kind !== "stale") return false;
  if (upstream.length === 0) return true;
  return upstream.every((u) => {
    const up = state.nodes[u];
    return up && up.status.kind === "resolved";
  });
}

// findReadyNodes: topological order. For each candidate, check
// isReady; if so, include. Use BFS through the DAG.
export function findReadyNodes(state: WorkflowState): ReadonlyArray<NodeKeyT> {
  const ready: NodeKeyT[] = [];
  const visited = new Set<string>();
  const inEdges: Record<string, string[]> = {};
  const outEdges: Record<string, string[]> = {};

  for (const id of Object.keys(state.nodes)) {
    inEdges[id] = [];
    outEdges[id] = [];
  }
  for (const e of state.edges) {
    const from = e.from as unknown as string;
    const to = e.to as unknown as string;
    inEdges[to]?.push(from);
    outEdges[from]?.push(to);
  }

  // Seed with zero-upstream nodes.
  const queue: string[] = [];
  for (const id of Object.keys(state.nodes)) {
    if ((inEdges[id] ?? []).length === 0) {
      queue.push(id);
    }
  }

  // BFS in topological order.
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (isReady(state, id, inEdges[id] ?? [])) {
      ready.push(id as unknown as NodeKeyT);
    }
    for (const next of outEdges[id] ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }
  return ready;
}

// findSubtree: BFS from a root key, returning all descendants.
export function findSubtree(state: WorkflowState, root: NodeKeyT): Set<NodeKeyT> {
  const visited = new Set<NodeKeyT>();
  const queue: NodeKeyT[] = [root];
  const childMap: Record<string, string[]> = {};
  for (const e of state.edges) {
    const f = e.from as unknown as string;
    const t = e.to as unknown as string;
    (childMap[f] ??= []).push(t);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const c of childMap[id as unknown as string] ?? []) {
      queue.push(c as unknown as NodeKeyT);
    }
  }
  return visited;
}

// getHumanFields: derive a ReadonlyMap<FieldKey, HumanMode> by
// walking the node's inputSchema.
export function getHumanFields(node: Node): ReadonlyMap<FieldKey, string> {
  const result = new Map<FieldKey, string>();
  walkSchema(node.inputSchema, "", result);
  return result;
}

function walkSchema(schema: ZodTypeAny, prefix: string, out: Map<FieldKey, string>): void {
  const def = schema._def as { typeName?: string; shape?: () => Record<string, ZodTypeAny> };
  const mode = getHumanMode(schema);
  if (mode) {
    out.set(prefix || "(root)", mode);
  }
  if (
    def.typeName === "ZodEffects" &&
    (schema as unknown as { sourceType?: ZodTypeAny }).sourceType
  ) {
    walkSchema((schema as unknown as { sourceType: ZodTypeAny }).sourceType, prefix, out);
    return;
  }
  if (def.typeName === "ZodObject" && typeof def.shape === "function") {
    const shape = def.shape();
    for (const key of Object.keys(shape)) {
      walkSchema(shape[key] as ZodTypeAny, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

// getHumanInputDisplay: helper for renderers. Returns a discriminated
// union on source kind: literal / from_node / human. The lib exposes
// the source; the renderer decides the UX. (TASK-S, folded into TASK-G.)
//
// Decision rules:
//   - If the field's schema is human-marked (verified) and has a
//     value: literal (the value is locked in; no human UI needed).
//   - If the field's schema is human-marked (writeable) and has a
//     value: human + status "set" (the human has typed it).
//   - If the field's schema is human-marked (writeable) and is empty:
//     human + status "pending" (waiting for human input).
//   - If the node has an incoming edge and the upstream is resolved:
//     from_node (the value flowed from upstream).
//   - Otherwise: literal (the value is just a constant at the root).
export function getHumanInputDisplay(
  state: WorkflowState,
  node: Node,
  _fieldKey: string,
): HumanInputDisplay {
  // Inspect the field schema. For a top-level call, we look at the
  // whole node's input schema; for per-field calls, the caller
  // would need a separate API. For now, the top-level call is the
  // contract: getHumanInputDisplay(state, node, "(root)").
  const schema = node.input.schema;
  const mode = getHumanMode(schema as never);
  const value = node.input.value;

  if (mode === "verified" && value !== undefined) {
    return { source: "literal", value, fieldSchema: schema as never };
  }
  if (mode === "writeable") {
    return {
      source: "human",
      value,
      fieldSchema: schema as never,
      status: value === undefined ? "pending" : "set",
    };
  }

  // Walk incoming edges. If any upstream is resolved, the value
  // flowed from there.
  const id = node.id as unknown as string;
  const inEdges = state.edgesByTarget[id as never] ?? [];
  for (const edge of inEdges) {
    const upId = edge.from as unknown as string;
    const up = state.nodes[upId];
    if (up && up.status.kind === "resolved") {
      const upstreamValue = up.status.kind === "resolved" ? up.status.finalOutput : undefined;
      return {
        source: "from_node",
        value: upstreamValue,
        fieldSchema: schema as never,
        upstream: edge.from,
      };
    }
  }

  return { source: "literal", value, fieldSchema: schema as never };
}

// resolveInput: for a node with all upstreams resolved, returns
// the input value as the bridge-transformed upstream output. If
// any upstream is unresolved, returns undefined.
//
// The composition API is single-parent-per-child, so a node has
// at most one incoming edge. The bridge (if any) is stored on
// the edge. The runtime calls this function before each program
// execution to compute the actual input.
export function resolveInput(state: WorkflowState, key: NodeKeyT): unknown {
  const edges = state.edgesByTarget[key] ?? [];
  if (edges.length === 0) {
    // No incoming edges: this is a root node. Its input is
    // whatever was set on the node directly.
    const node = state.nodes[key as unknown as string];
    return node?.input.value;
  }
  if (edges.length > 1) {
    // Multi-parent join: an object mapping each parent's key
    // to its (bridged) resolved output. The user's def
    // declares an object input schema.
    const result: Record<string, unknown> = {};
    for (const edge of edges) {
      const upstream = state.nodes[edge.from as unknown as string];
      if (!upstream || upstream.status.kind !== "resolved") {
        return undefined;
      }
      const value = edge.bridge
        ? edge.bridge(upstream.status.finalOutput)
        : upstream.status.finalOutput;
      result[edge.from as unknown as string] = value;
    }
    return result;
  }
  // Single-parent case: return the bridged upstream output.
  const edge = edges[0]!;
  const upstream = state.nodes[edge.from as unknown as string];
  if (!upstream || upstream.status.kind !== "resolved") return undefined;
  return edge.bridge ? edge.bridge(upstream.status.finalOutput) : upstream.status.finalOutput;
}

export { NodeKey, WorkflowId, z };
