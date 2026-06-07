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

import type { ZodTypeAny } from "zod"
import { NodeKey, WorkflowId, type FieldKey } from "./keys.js"
import { getHumanMode } from "@underwai/schema"
import type {
  Edge,
  HumanInputDisplay,
  Node,
  NodeKey as NodeKeyT,
  ResolvedInput,
  SerializedError,
  WorkflowState,
} from "./types.js"
import { z } from "zod"

export function init(_root: unknown): WorkflowState {
  throw new Error("not implemented")
}

export function getNode(state: WorkflowState, key: NodeKeyT): Node {
  const node = state.nodes[key as unknown as string]
  if (!node) throw new Error(`node not found: ${key as unknown as string}`)
  return node
}

export function serialize(state: WorkflowState): string {
  // Serialized form: id, version, status, nodes, edges, createdAt,
  // updatedAt, error. The derived fields (edgesByTarget, edgesByFrom)
  // are NOT serialized — they're recomputed on deserialize.
  const { edgesByTarget: _et, edgesByFrom: _ef, ...rest } = state
  return JSON.stringify(rest)
}

function buildIndex(edges: ReadonlyArray<Edge>): {
  edgesByTarget: Record<NodeKeyT, ReadonlyArray<Edge>>
  edgesByFrom: Record<NodeKeyT, ReadonlyArray<Edge>>
} {
  const byTarget: Record<string, Edge[]> = {}
  const byFrom: Record<string, Edge[]> = {}
  for (const e of edges) {
    const t = e.to as unknown as string
    const f = e.from as unknown as string
    ;(byTarget[t] ??= []).push(e)
    ;(byFrom[f] ??= []).push(e)
  }
  const edgesByTarget: Record<NodeKeyT, ReadonlyArray<Edge>> = {}
  const edgesByFrom: Record<NodeKeyT, ReadonlyArray<Edge>> = {}
  for (const k of Object.keys(byTarget)) {
    edgesByTarget[k as unknown as NodeKeyT] = byTarget[k] as ReadonlyArray<Edge>
  }
  for (const k of Object.keys(byFrom)) {
    edgesByFrom[k as unknown as NodeKeyT] = byFrom[k] as ReadonlyArray<Edge>
  }
  return { edgesByTarget, edgesByFrom }
}

export function deserialize(json: string): WorkflowState {
  const parsed = JSON.parse(json) as Omit<
    WorkflowState,
    "edgesByTarget" | "edgesByFrom"
  >
  const { edgesByTarget, edgesByFrom } = buildIndex(parsed.edges as ReadonlyArray<Edge>)
  return { ...parsed, edgesByTarget, edgesByFrom }
}

// isReady: a node is ready iff it is pending/stale AND all upstream
// nodes are resolved (or it has no upstream).
function isReady(state: WorkflowState, id: string, upstream: ReadonlyArray<string>): boolean {
  const n = state.nodes[id]
  if (!n) return false
  if (n.status.kind !== "pending" && n.status.kind !== "stale") return false
  if (upstream.length === 0) return true
  return upstream.every((u) => {
    const up = state.nodes[u]
    return up && up.status.kind === "resolved"
  })
}

// findReadyNodes: topological order. For each candidate, check
// isReady; if so, include. Use BFS through the DAG.
export function findReadyNodes(state: WorkflowState): ReadonlyArray<NodeKeyT> {
  const ready: NodeKeyT[] = []
  const visited = new Set<string>()
  const inEdges: Record<string, string[]> = {}
  const outEdges: Record<string, string[]> = {}

  for (const id of Object.keys(state.nodes)) {
    inEdges[id] = []
    outEdges[id] = []
  }
  for (const e of state.edges) {
    const from = e.from as unknown as string
    const to = e.to as unknown as string
    inEdges[to]?.push(from)
    outEdges[from]?.push(to)
  }

  // Seed with zero-upstream nodes.
  const queue: string[] = []
  for (const id of Object.keys(state.nodes)) {
    if ((inEdges[id] ?? []).length === 0) {
      queue.push(id)
    }
  }

  // BFS in topological order.
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    if (isReady(state, id, inEdges[id] ?? [])) {
      ready.push(id as unknown as NodeKeyT)
    }
    for (const next of outEdges[id] ?? []) {
      if (!visited.has(next)) {
        queue.push(next)
      }
    }
  }
  return ready
}

// findSubtree: BFS from a root key, returning all descendants.
export function findSubtree(state: WorkflowState, root: NodeKeyT): Set<NodeKeyT> {
  const visited = new Set<NodeKeyT>()
  const queue: NodeKeyT[] = [root]
  const childMap: Record<string, string[]> = {}
  for (const e of state.edges) {
    const f = e.from as unknown as string
    const t = e.to as unknown as string
    ;(childMap[f] ??= []).push(t)
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const c of childMap[id as unknown as string] ?? []) {
      queue.push(c as unknown as NodeKeyT)
    }
  }
  return visited
}

// getHumanFields: derive a ReadonlyMap<FieldKey, HumanMode> by
// walking the node's inputSchema.
export function getHumanFields(node: Node): ReadonlyMap<FieldKey, string> {
  const result = new Map<FieldKey, string>()
  walkSchema(node.inputSchema, "", result)
  return result
}

function walkSchema(
  schema: ZodTypeAny,
  prefix: string,
  out: Map<FieldKey, string>,
): void {
  const def = schema._def as { typeName?: string; shape?: () => Record<string, ZodTypeAny> }
  const mode = getHumanMode(schema)
  if (mode) {
    out.set(prefix || "(root)", mode)
  }
  if (def.typeName === "ZodEffects" && (schema as unknown as { sourceType?: ZodTypeAny }).sourceType) {
    walkSchema(
      (schema as unknown as { sourceType: ZodTypeAny }).sourceType,
      prefix,
      out,
    )
    return
  }
  if (def.typeName === "ZodObject" && typeof def.shape === "function") {
    const shape = def.shape()
    for (const key of Object.keys(shape)) {
      walkSchema(shape[key] as ZodTypeAny, prefix ? `${prefix}.${key}` : key, out)
    }
  }
}

export function getHumanInputDisplay(
  _node: Node,
  _fieldKey: FieldKey,
): HumanInputDisplay {
  throw new Error("not implemented")
}

export { NodeKey, WorkflowId, z }
