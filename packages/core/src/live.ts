// @underwai/core — live.ts
//
// A simple in-process subscription registry. The runner's runtime
// calls notify(state) after every state mutation. Subscribers
// register callbacks keyed by NodeKey. The transport layer wraps
// this with pattern matching; renderers wrap it with React
// useSyncExternalStore.
import type { Node, NodeKey, WorkflowState } from "./types.js";

type LiveCallback = (state: WorkflowState) => void;

export class LiveSubscriptionRegistry {
  private byKey: Map<string, Set<LiveCallback>> = new Map();
  private byPattern: Array<{
    pattern: string;
    cb: (state: WorkflowState, matched: Record<string, Node>) => void;
  }> = [];

  register(key: NodeKey, cb: LiveCallback): () => void {
    const k = key as unknown as string;
    let set = this.byKey.get(k);
    if (!set) {
      set = new Set();
      this.byKey.set(k, set);
    }
    set.add(cb);
    return () => {
      this.byKey.get(k)?.delete(cb);
    };
  }

  registerPattern(
    pattern: string,
    cb: (state: WorkflowState, matched: Record<string, Node>) => void,
  ): () => void {
    const entry = { pattern, cb };
    this.byPattern.push(entry);
    return () => {
      const i = this.byPattern.indexOf(entry);
      if (i >= 0) this.byPattern.splice(i, 1);
    };
  }

  notify(state: WorkflowState): void {
    for (const [k, set] of this.byKey) {
      const node = state.nodes[k];
      if (!node) continue;
      for (const cb of set) cb(state);
    }
    for (const { cb } of this.byPattern) {
      cb(state, state.nodes);
    }
  }
}
