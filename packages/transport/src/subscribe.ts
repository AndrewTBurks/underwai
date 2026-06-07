// @underwai/transport — subscribe.ts
//
// The in-process subscription layer. Two methods:
//   - subscribe(state, key, onUpdate): single key, exact match.
//     onUpdate is called once with the matching Node when called.
//   - subscribeSet(state, pattern, onUpdate): wildcard pattern.
//     onUpdate is called once with a Record<NodeKey, Node> keyed
//     by the relative key (the part after the pattern prefix).
//     Bare "*" matches every node, with relative keys being the
//     full keys. "prefix.*" matches descendants of "prefix",
//     with relative keys being the suffix (e.g., "a", "a.b").
//
// No batching flag, no delta flag, no prefix flag. (TASK-P, TASK-V
// cancelled; TASK-C+D folded into a pattern grammar.)

import type { Node, NodeKey, WorkflowState } from "@underwai/core"

export type Subscription = {
  unsubscribe: () => void
}

export function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (node: Node) => void,
): Subscription {
  // Push-based: invoke once with the current value, return the
  // unsubscribe handle. (Future: wire into the runner's state-changed
  // event stream; for v1.0, this is a one-shot read.)
  const node = state.nodes[key as unknown as string]
  if (node) {
    onUpdate(node)
  }
  return {
    unsubscribe: () => {},
  }
}

export function subscribeSet(
  state: WorkflowState,
  pattern: string,
  onUpdate: (nodes: Record<string, Node>) => void,
): Subscription {
  // "*" matches every node. "prefix.*" matches descendants of prefix.
  const matched = matchPattern(state, pattern)
  onUpdate(matched)
  return {
    unsubscribe: () => {},
  }
}

function matchPattern(
  state: WorkflowState,
  pattern: string,
): Record<string, Node> {
  const result: Record<string, Node> = {}
  const allKeys = Object.keys(state.nodes)

  if (pattern === "*") {
    for (const k of allKeys) {
      result[k] = state.nodes[k]!
    }
    return result
  }

  // "prefix.*" — direct children of prefix, NOT transitive.
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2)
    const prefixDot = prefix + "."
    for (const k of allKeys) {
      if (k.startsWith(prefixDot)) {
        // Only direct children: the suffix after "prefix." must
        // not contain a further dot.
        const suffix = k.slice(prefixDot.length)
        if (!suffix.includes(".")) {
          result[suffix] = state.nodes[k]!
        }
      }
    }
    return result
  }

  // "prefix." (no wildcard) — direct children of prefix, NOT transitive.
  if (pattern.endsWith(".")) {
    const prefix = pattern.slice(0, -1)
    const prefixDot = prefix + "."
    for (const k of allKeys) {
      if (k.startsWith(prefixDot)) {
        const suffix = k.slice(prefixDot.length)
        if (!suffix.includes(".")) {
          result[suffix] = state.nodes[k]!
        }
      }
    }
    return result
  }

  return result
}
