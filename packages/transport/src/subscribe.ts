// @underwai/transport — subscribe.ts
//
// The in-process subscription layer. Two methods:
//   - subscribe(registry, key, onUpdate): single key, exact match.
//     onUpdate is called on every state change that touches the key.
//   - subscribeSet(registry, pattern, onUpdate): wildcard pattern.
//     onUpdate is called on every state change with a
//     Record<NodeKey, Node> keyed by the relative key (the part
//     after the pattern prefix).
//
// Pattern grammar:
//   - "*" matches every node. Relative keys are the full keys.
//   - "prefix.*" matches direct children of prefix. Relative keys
//     are the suffix (e.g., "a", "b") with no further dots.
//   - "prefix." (no wildcard) is equivalent to "prefix.*".
//
// No batching flag, no delta flag, no prefix flag. (TASK-P, TASK-V
// cancelled; TASK-C+D folded into a pattern grammar.)
import type { LiveSubscriptionRegistry, Node, NodeKey, WorkflowState } from "@underwai/core";

export type Subscription = {
  unsubscribe: () => void;
};

export function subscribe(
  registry: LiveSubscriptionRegistry,
  key: NodeKey,
  onUpdate: (node: Node) => void,
): Subscription {
  const unsub = registry.register(key, (state) => {
    const node = state.nodes[key as unknown as string];
    if (node) onUpdate(node);
  });
  return { unsubscribe: unsub };
}

export function subscribeSet(
  registry: LiveSubscriptionRegistry,
  pattern: string,
  onUpdate: (nodes: Record<string, Node>) => void,
): Subscription {
  const unsub = registry.registerPattern(pattern, (state, all) => {
    onUpdate(matchPattern(state, pattern, all));
  });
  return { unsubscribe: unsub };
}

function matchPattern(
  _state: WorkflowState,
  pattern: string,
  all: Readonly<Record<string, Node>>,
): Record<string, Node> {
  const result: Record<string, Node> = {};
  const allKeys = Object.keys(all);

  if (pattern === "*") {
    for (const k of allKeys) {
      result[k] = all[k]!;
    }
    return result;
  }

  if (pattern.endsWith(".*") || pattern.endsWith(".")) {
    const prefix = pattern.endsWith(".*") ? pattern.slice(0, -2) : pattern.slice(0, -1);
    const prefixDot = prefix + ".";
    for (const k of allKeys) {
      if (k.startsWith(prefixDot)) {
        const suffix = k.slice(prefixDot.length);
        if (!suffix.includes(".")) {
          result[suffix] = all[k]!;
        }
      }
    }
    return result;
  }

  // Exact-key pattern: the pattern is a full node key. Return
  // a single-entry record keyed by the pattern itself. No
  // trimming; the consumer asked for this exact key.
  if (all[pattern]) {
    result[pattern] = all[pattern]!;
  }
  return result;
}
