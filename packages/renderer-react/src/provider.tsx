// @underwai/renderer-react — provider.tsx
//
// The provider wires a LiveSubscriptionRegistry + WorkflowState
// into a React context. Children use the hooks (useWorkflowState,
// useNode, useSubtree) to subscribe to state changes.
import { createContext, createElement, useContext, type ReactNode } from "react";
import type { LiveSubscriptionRegistry, WorkflowState } from "@underwai/core";

export type ProviderProps = {
  registry: LiveSubscriptionRegistry;
  state: WorkflowState;
  children: ReactNode;
};

type ProviderValue = {
  registry: LiveSubscriptionRegistry;
  getState: () => WorkflowState;
  subscribe: (cb: (state: WorkflowState) => void) => () => void;
};

const ProviderContext = createContext<ProviderValue | null>(null);

export function WorkflowProvider({ registry, state, children }: ProviderProps) {
  let current = state;
  const subscribe = (cb: (state: WorkflowState) => void) => {
    return registry.registerPattern("*", (s) => {
      current = s;
      cb(s);
    });
  };
  const value: ProviderValue = {
    registry,
    getState: () => current,
    subscribe,
  };
  return createElement(ProviderContext.Provider, { value }, children);
}

export function useProvider(): ProviderValue {
  const v = useContext(ProviderContext);
  if (!v) {
    throw new Error("useProvider must be used inside <WorkflowProvider>");
  }
  return v;
}
