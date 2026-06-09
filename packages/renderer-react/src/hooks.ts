// @underwai/renderer-react — hooks.ts
//
// React hooks for subscribing to workflow state. Each hook is
// implemented with useSyncExternalStore against the
// LiveSubscriptionRegistry. No useState, no useEffect, no
// shimmed subscription — React 18+ idiomatic.
import { useSyncExternalStore } from "react";
import type { Node, NodeKey, WorkflowState } from "@underwai/core";
import { useProvider } from "./provider.js";

export function useWorkflowState(): WorkflowState {
  const { getState, subscribe } = useProvider();
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useNode(key: NodeKey): Node | undefined {
  const { getState, subscribe } = useProvider();
  return useSyncExternalStore(
    subscribe,
    () => getState().nodes.get(key),
    () => getState().nodes.get(key),
  );
}

export function useSubtree(rootKey: NodeKey): Record<string, Node> {
  const { getState, subscribe } = useProvider();
  return useSyncExternalStore(
    subscribe,
    () => {
      const state = getState();
      const result: Record<string, Node> = {};
      const rootStr = rootKey as unknown as string;
      const prefix = rootStr + ".";
      for (const [k, n] of state.nodes) {
        const ks = k as unknown as string;
        if (ks === rootStr || ks.startsWith(prefix)) {
          result[ks] = n;
        }
      }
      return result;
    },
    () => ({}),
  );
}
