---
title: "renderer-react/provider"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
decisions:
  - id: DEC-RR-005
    date: 2026-06-07
    author: agent
    summary: "Provider wires a LiveSubscriptionRegistry + WorkflowState into a React context. The provider's subscribe function registers a '*' pattern callback that updates an internal current state ref. The hooks read from this ref via useSyncExternalStore."
  - id: DEC-RR-005a
    date: 2026-06-08
    author: agent
    summary: "`ProviderProps = { registry: LiveSubscriptionRegistry; state: WorkflowState; children: ReactNode }`. The provider holds a closure variable `current` (the latest state) and exposes `getState: () => current` and `subscribe: (cb) => registry.registerPattern('*', (s) => { current = s; cb(s); })`. The hooks (`useWorkflowState`, `useNode`, `useSubtree`) read from this pair via `useSyncExternalStore`."
  - id: DEC-RR-005b
    date: 2026-06-08
    author: agent
    summary: "`useProvider()` is the context consumer. Returns the `{ registry, getState, subscribe }` triple. Throws if used outside `<WorkflowProvider>`. The renderer's coupling to React Context is a v1.0 simplification — v1.1+ could pass the triple directly to the hooks."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-react/src/provider

The provider wires a `LiveSubscriptionRegistry` + `WorkflowState` into a React context. Children use the hooks (`useWorkflowState`, `useNode`, `useSubtree`) to subscribe to state changes.

## What lives here

The source is `provider.tsx` next to this directory.

- **`ProviderProps`** — `{ registry, state, children }`.
- **`ProviderValue`** — `{ registry, getState, subscribe }`. The shape exposed by the context.
- **`ProviderContext`** — internal `createContext<ProviderValue | null>(null)`.
- **`WorkflowProvider`** — the component. Holds a closure variable `current = state`, exposes `getState` and `subscribe`. Children read from the context.
- **`useProvider()`** — context consumer. Throws if used outside `<WorkflowProvider>`.

## Why a context

The hooks (`useWorkflowState`, `useNode`, `useSubtree`) need access to the registry's `subscribe` and the latest state. Passing these as props through every component would be noisy. React context is the idiomatic solution. The `LiveSubscriptionRegistry` is shared between the runner and the renderer; the context propagates the handle.

## Boundary

- Imports from: `react` (peer, `createContext`, `createElement`, `useContext`, `ReactNode`), `@underwai/core` (LiveSubscriptionRegistry, WorkflowState).
- Exports to: the rest of `@underwai/renderer-react` (the hooks read from this provider), consumer code that wraps their app in `<WorkflowProvider>`.
- **What does NOT live here:** the hooks themselves (in `hooks.ts`), the kind registry (in `registry.tsx`), the auto-render (in `auto-render.tsx`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
