---
parent: ../../.cns/index.md
title: "@underwai/renderer-react"
status: clean
last_reconciled: 2026-06-11
type: package
human_notes: |
links:
  - id: rr-provider
    path: packages/renderer-react/src/provider/index.md
  - id: rr-hooks
    path: packages/renderer-react/src/hooks/index.md
  - id: rr-registry
    path: packages/renderer-react/src/registry/index.md
  - id: rr-auto-render
    path: packages/renderer-react/src/auto-render/index.md
decisions:
  - id: DEC-RR-001
    date: 2026-06-06
    author: agent
    summary: "Hooks use useSyncExternalStore against the LiveSubscriptionRegistry. No useState, no useEffect, no shimmed subscription. React 18+ idiomatic."
  - id: DEC-RR-002
    date: 2026-06-06
    author: agent
    summary: "Renderer registry: kind -> (state, node) -> ReactElement. registerKind / getKindRenderer / clearRegistry. Default renderer is a <pre> with the kind and status."
  - id: DEC-RR-003
    date: 2026-06-06
    author: agent
    summary: 'AutoRender walks the DAG (state.nodes) and calls the registered renderer for each node. Unknown kinds render the defaultRenderer. The result is a single <div data-auto-render="true"> with one child per node.'
  - id: DEC-RR-004
    date: 2026-06-07
    author: agent
    summary: "No chat/agent UI affordances. The lib is workflow-shaped, not chat-shaped. The renderer is a thin adapter over the LiveSubscriptionRegistry; consumers compose their own UI from useNode, useSubtree, useWorkflowState."
  - id: DEC-RR-005
    date: 2026-06-07
    author: agent
    summary: 'Provider wires a LiveSubscriptionRegistry + WorkflowState into a React context. The provider''s subscribe function registers a "*" pattern callback that updates an internal current state ref. The hooks read from this ref via useSyncExternalStore.'
  - id: DEC-RR-006
    date: 2026-06-12
    author: agent
    summary: "renderer-react intentionally imports the core LiveSubscriptionRegistry directly instead of depending on @underwai/transport. React hooks need the full current WorkflowState for useSyncExternalStore; transport pattern helpers are still the public helper surface for consumers that need matched node sets. (TASK-49.)"
---

# @underwai/renderer-react

The React adapter. The lib is workflow-shaped, not chat-shaped. The renderer is a thin layer over the LiveSubscriptionRegistry; consumers compose their own UI from `useNode`, `useSubtree`, `useWorkflowState`.

## What lives here

- `src/provider.tsx` — `<WorkflowProvider registry={...} state={...} />`. Wires the LiveSubscriptionRegistry into a React context.
- `src/hooks.ts` — `useWorkflowState`, `useNode(key)`, `useSubtree(rootKey)`. All use `useSyncExternalStore`.
- `src/registry.tsx` — `registerKind(kind, fn)`, `getKindRenderer(kind)`, `clearRegistry()`. Default renderer is a `<pre>`.
- `src/auto-render.tsx` — `<AutoRender state={...} />` walks the DAG and renders each node via the registered kind renderer.
- `src/index.ts` — re-exports.

## Boundary

Imports from `@underwai/core` (LiveSubscriptionRegistry, types) intentionally. It does not import `@underwai/transport` because the provider needs full-state snapshots for `useSyncExternalStore`, not only matched node sets. Consumers import from `@underwai/renderer-react`.

## Runtime note

The renderer's public surface is small. The completed TASK-33 implementation wires React through `LiveSubscriptionRegistry` and `useSyncExternalStore`; consumers can share the same registry between the runner and `<WorkflowProvider>` or provide their own. Module-specific hook, provider, registry, and auto-render details live in the linked `src/*/index.md` nodes.

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above.
