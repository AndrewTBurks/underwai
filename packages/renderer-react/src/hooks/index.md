---
title: "renderer-react/hooks"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
decisions:
  - id: DEC-RR-001
    date: 2026-06-06
    author: agent
    summary: "Hooks use useSyncExternalStore against the LiveSubscriptionRegistry. No useState, no useEffect, no shimmed subscription. React 18+ idiomatic."
  - id: DEC-RR-001a
    date: 2026-06-08
    author: agent
    summary: "Three hooks: `useWorkflowState()` returns the full `WorkflowState`; `useNode(key)` returns a single `Node` or `undefined`; `useSubtree(rootKey)` returns a `Record<string, Node>` of the root and all its descendants (by string-prefix match). All three use `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`."
  - id: DEC-RR-001b
    date: 2026-06-08
    author: agent
    summary: "`useSubtree(rootKey)`'s server snapshot returns `{}` (a stable empty record) so SSR doesn't crash. The client snapshot is computed on every render; the empty object identity changes per call, but React's `useSyncExternalStore` handles identity correctly when the same render returns the same shape."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-react/src/hooks

React hooks for subscribing to workflow state. Each hook is implemented with `useSyncExternalStore` against the `LiveSubscriptionRegistry` exposed by `<WorkflowProvider>`. React 18+ idiomatic — no `useState`, no `useEffect`, no shimmed subscription.

## What lives here

The source is `hooks.ts` next to this directory.

- **`useWorkflowState(): WorkflowState`** — returns the full state. Re-renders on every notify.
- **`useNode(key: NodeKey): Node | undefined`** — returns a single node. Re-renders when the node's `status` or `input` changes.
- **`useSubtree(rootKey: NodeKey): Record<string, Node>`** — returns the root and all its descendants (string-prefix match). Re-renders when any node in the subtree changes.

## Why `useSyncExternalStore`

The lib owns the state, not React. `useSyncExternalStore` is React 18+'s official primitive for subscribing to external stores: it integrates with concurrent mode's tearing detection, supports SSR via a `getServerSnapshot`, and is the idiomatic shape for an external-state library. The `subscribe` function comes from the provider's context; the `getSnapshot` reads from the provider's `getState`.

## Boundary

- Imports from: `react` (peer, `useSyncExternalStore`), `@underwai/core` (Node, NodeKey, WorkflowState types), `./provider.js` (the `useProvider` consumer).
- Exports to: consumer React components that want to render workflow state.
- **What does NOT live here:** the provider (in `provider.tsx`), the kind registry (in `registry.tsx`), the auto-render (in `auto-render.tsx`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
