// @underwai/core — operations.ts
//
// State derivations and mutations on a WorkflowState. The
// composition API (composition.ts) describes the DAG shape;
// operations.ts acts on a constructed WorkflowState.
//
// Storage shape: Map<NodeKey, ...> end-to-end. This eliminates
// the `as unknown as string` casts that the Record<string, ...>
// shape forced at every read site (per principle-type-system-
// discipline, branded primitives that don't fire are lies).
//
// init: build a WorkflowState from a CompositionTree.
// serialize/deserialize: Maps to JSON-compatible arrays, back.
// getHumanFields / getHumanInputDisplay: derived views for
// renderers. (TASK-S, TASK-G.)
// findReadyNodes: topological order (Kahn's algorithm).
// resolveInput: bridge-transformed upstream output for a node.

import type { ZodTypeAny } from "zod";
import { WorkflowId } from "./keys.js";
import type { FieldKey } from "./keys.js";
import { getHumanMode } from "@underwai/schema";
import type { CompositionTree } from "./composition.js";
import type {
  Edge,
  HumanInputDisplay,
  Node,
  NodeKey,
  SerializedState,
  WorkflowState,
} from "./types.js";

export function init(tree: CompositionTree, id: WorkflowId): WorkflowState {
  const now = new Date().toISOString();
  const nodes = new Map<NodeKey, Node>();
  for (const [key, def] of tree.defs.entries()) {
    const node: Node = {
      id: key,
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
    nodes.set(key, node);
  }
  const edgesByTarget = new Map<NodeKey, ReadonlyArray<Edge>>();
  const edgesByFrom = new Map<NodeKey, ReadonlyArray<Edge>>();
  for (const e of tree.edges) {
    edgesByTarget.set(e.to, [...(edgesByTarget.get(e.to) ?? []), e]);
    edgesByFrom.set(e.from, [...(edgesByFrom.get(e.from) ?? []), e]);
  }
  return {
    id,
    version: 1,
    status: "pending",
    nodes,
    edges: tree.edges,
    edgesByTarget,
    edgesByFrom,
    defs: tree.defs,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNode(state: WorkflowState, key: NodeKey): Node {
  const node = state.nodes.get(key);
  if (!node) throw new Error(`node not found: ${key as unknown as string}`);
  return node;
}

export function serialize(state: WorkflowState): string {
  const serializedNodes: Array<[string, { kind: string; status: unknown; inputValue: unknown; updatedAt: string }]> = [];
  for (const [k, n] of state.nodes) {
    serializedNodes.push([
      k as unknown as string,
      {
        kind: n.kind,
        status: n.status,
        inputValue: n.input.value,
        updatedAt: n.updatedAt,
      },
    ]);
  }
  const out: Omit<SerializedState, "error"> = {
    id: state.id,
    version: state.version,
    status: state.status,
    nodes: serializedNodes as SerializedState["nodes"],
    edges: state.edges.map((e) => ({
      from: e.from as unknown as string,
      to: e.to as unknown as string,
      hasBridge: Boolean(e.bridge),
    })),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
  return JSON.stringify(out);
}

export function deserialize(json: string): WorkflowState {
  const parsed = JSON.parse(json) as SerializedState;
  const nodes = new Map<NodeKey, Node>();
  for (const [k, sn] of parsed.nodes) {
    nodes.set(k as unknown as NodeKey, {
      id: k as unknown as NodeKey,
      kind: sn.kind,
      inputSchema: undefined as never,
      input: { value: sn.inputValue, schema: undefined as never, humanFields: new Map() },
      outputSchema: undefined as never,
      status: sn.status as Node["status"],
      actor: "system",
      createdAt: sn.updatedAt,
      updatedAt: sn.updatedAt,
    });
  }
  // We don't have the defs after a round-trip. The runtime
  // must provide them via the layer's initialOpts or via a
  // composition tree. For now, deserialize returns a state
  // with empty defs; consumers that need programs re-init
  // through init() with the original tree.
  const base: Omit<WorkflowState, "error"> = {
    id: WorkflowId(parsed.id),
    version: parsed.version,
    status: parsed.status,
    nodes,
    edges: parsed.edges.map(
      (e) => ({ from: e.from as never, to: e.to as never } as Edge),
    ),
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    defs: new Map(),
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
  return parsed.error !== undefined ? { ...base, error: parsed.error } : base;
}

function isReady(state: WorkflowState, id: NodeKey, upstream: ReadonlyArray<NodeKey>): boolean {
  const n = state.nodes.get(id);
  if (!n) return false;
  if (n.status.kind !== "pending" && n.status.kind !== "stale") return false;
  if (upstream.length === 0) return true;
  return upstream.every((u) => state.nodes.get(u)?.status.kind === "resolved");
}

// findReadyNodes: topological order. For each candidate, check
// isReady; if so, include. Use BFS through the DAG.
export function findReadyNodes(state: WorkflowState): ReadonlyArray<NodeKey> {
  const ready: NodeKey[] = [];
  const visited = new Set<NodeKey>();
  const inEdges = new Map<NodeKey, NodeKey[]>();
  const outEdges = new Map<NodeKey, NodeKey[]>();
  for (const id of state.nodes.keys()) {
    inEdges.set(id, []);
    outEdges.set(id, []);
  }
  for (const e of state.edges) {
    inEdges.get(e.to)?.push(e.from);
    outEdges.get(e.from)?.push(e.to);
  }
  const queue: NodeKey[] = [];
  for (const [id, inList] of inEdges) {
    if (inList.length === 0) queue.push(id);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (isReady(state, id, inEdges.get(id) ?? [])) {
      ready.push(id);
    }
    for (const next of outEdges.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return ready;
}

// topologicalLevels: assign each node a "level" equal to the
// longest path from any root. Nodes with no incoming edges
// are level 0. Siblings at the same level are sorted by id
// (string compare) for stable rendering.
//
// Used by RenderedPanel (panel order) and Graph (column
// layout). The level map alone is what both consumers share;
// pixel positions are the Graph's job.
export function topologicalLevels(
  state: WorkflowState,
): ReadonlyArray<ReadonlyArray<NodeKey>> {
  const ids = Array.from(state.nodes.keys());
  const incoming = new Map<NodeKey, number>();
  for (const id of ids) incoming.set(id, 0);
  for (const e of state.edges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }
  const outEdges = new Map<NodeKey, NodeKey[]>();
  for (const id of ids) outEdges.set(id, []);
  for (const e of state.edges) {
    outEdges.get(e.from)?.push(e.to);
  }
  const level = new Map<NodeKey, number>();
  const queue: NodeKey[] = [];
  for (const id of ids) {
    if ((incoming.get(id) ?? 0) === 0) {
      level.set(id, 0);
      queue.push(id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const lv = level.get(id) ?? 0;
    for (const next of outEdges.get(id) ?? []) {
      const cur = level.get(next);
      if (cur === undefined || cur < lv + 1) {
        level.set(next, lv + 1);
        queue.push(next);
      }
    }
  }
  for (const id of ids) {
    if (!level.has(id)) level.set(id, 0);
  }
  const byLevel = new Map<number, NodeKey[]>();
  for (const [id, lv] of level) {
    const arr = byLevel.get(lv) ?? [];
    arr.push(id);
    byLevel.set(lv, arr);
  }
  const maxLevel = Math.max(0, ...Array.from(byLevel.keys()));
  const result: NodeKey[][] = [];
  for (let lv = 0; lv <= maxLevel; lv++) {
    const arr = byLevel.get(lv) ?? [];
    arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    result.push(arr);
  }
  return result;
}

// findSubtree: BFS from a root key, returning all descendants.
export function findSubtree(state: WorkflowState, root: NodeKey): Set<NodeKey> {
  const visited = new Set<NodeKey>();
  const queue: NodeKey[] = [root];
  const childMap = new Map<NodeKey, NodeKey[]>();
  for (const e of state.edges) {
    const list = childMap.get(e.from) ?? [];
    list.push(e.to);
    childMap.set(e.from, list);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const c of childMap.get(id) ?? []) {
      queue.push(c);
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

// getHumanInputDisplay: per-node helper for renderers. Returns a
// discriminated union on source kind: literal / from_node / human.
export function getHumanInputDisplay(
  state: WorkflowState,
  node: Node,
): HumanInputDisplay {
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
  const inEdges = state.edgesByTarget.get(node.id) ?? [];
  for (const edge of inEdges) {
    const up = state.nodes.get(edge.from);
    if (up && up.status.kind === "resolved") {
      return {
        source: "from_node",
        value: up.status.finalOutput,
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
export function resolveInput(state: WorkflowState, key: NodeKey): unknown {
  const edges = state.edgesByTarget.get(key) ?? [];
  if (edges.length === 0) {
    const node = state.nodes.get(key);
    return node?.input.value;
  }
  if (edges.length > 1) {
    // Multi-parent join: an object mapping each parent's key
    // to its (bridged) resolved output. The user's def
    // declares an object input schema.
    const result: Record<string, unknown> = {};
    for (const edge of edges) {
      const upstream = state.nodes.get(edge.from);
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
  const edge = edges[0]!;
  const upstream = state.nodes.get(edge.from);
  if (!upstream || upstream.status.kind !== "resolved") return undefined;
  return edge.bridge ? edge.bridge(upstream.status.finalOutput) : upstream.status.finalOutput;
}
