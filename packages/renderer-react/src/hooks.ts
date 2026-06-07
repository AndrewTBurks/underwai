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
    () => getState().nodes[key as unknown as string],
    () => getState().nodes[key as unknown as string],
  );
}

export function useSubtree(rootKey: NodeKey): Record<string, Node> {
  const { getState, subscribe } = useProvider();
  return useSyncExternalStore(
    subscribe,
    () => {
      const state = getState();
      const result: Record<string, Node> = {};
      const prefix = (rootKey as unknown as string) + ".";
      for (const [k, n] of Object.entries(state.nodes)) {
        if (k === (rootKey as unknown as string) || k.startsWith(prefix)) {
          result[k] = n;
        }
      }
      return result;
    },
    () => ({}),
  );
}
