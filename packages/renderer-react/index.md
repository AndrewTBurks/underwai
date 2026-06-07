---
title: "@underwai/renderer-react"
type: package
parent: ../../.cns/index.md
status: deferred
shipped_in: v1.1+
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/renderer-react

> **Deferred to v1.1+.** This package does not have a `package.json` yet — only an `index.md` that pre-stages the local context. Phase 2 of the v1 implementation does not touch this folder. When v1.1 work begins, this folder is promoted to a real workspace package.

The reference React adapter. Maps the renderer protocol to React's `useSyncExternalStore` (for SSR streaming) and `useEffect` (for client). The lib ships zero UI; this package is a *reference* renderer, not the canonical one. Consumers can write their own.

## What will live here (v1.1+)

- `package.json` — `@underwai/renderer-react`, depends on `@underwai/core` and `@underwai/transport` (or directly on `@underwai/core` for in-process use). Peer-depends on `react`.
- `src/index.ts` — the public entry. Re-exports `useWorkflowState`, `useNode`, `useSubtree`, `<WorkflowProvider>`.
- `src/provider.tsx` — `<WorkflowProvider>` context. Wraps a `WorkflowState` and a subscription handle. Provides the state to descendant hooks.
- `src/hooks.ts` — the React hooks. `useWorkflowState` (returns the whole state, re-renders on any change), `useNode(key)` (returns a single node), `useSubtree(key)` (returns a node and its downstream descendants).
- `src/registry.tsx` — the renderer registry mapping `kind` → `(node, children) => ReactElement`. The lib's renderer protocol; this is the React binding.
- `src/auto-render.tsx` — the auto-render entry point. Given a `WorkflowState` and a registry, walks the DAG and emits a tree of React elements.

## Boundary

- **Will import from:** `@underwai/core` (data structure), `@underwai/transport` (subscription), `react` (peer).
- **Will export to:** consumer code (the React components and hooks).
- **What will NOT live here:** the data structure, the runner, the transport. This package is a thin React binding.

## Design decisions that govern this package

- **`useSyncExternalStore` for in-process subscription.** React 18+ concurrent-safe. Batches updates naturally — no `batched` option needed (TASK-P).
- **The renderer registry is a plain function map.** No JSX-as-workflow, no DSL. Consumers register `kind` → `(node, children) => ReactElement` and the lib renders. (TASK-C's `subscribe` semantics apply; this package reads the same `Node` shape.)
- **Two render modes.** (a) auto-render the whole graph (for SSR full-page), (b) subscribe to a node and get its subtree (for embedding workflow pieces in chat, wall displays, etc.). The hook surface covers both.
- **No "AI chat" or "agent" UI affordances.** This package is a workflow renderer. Chat surfaces, agent loops, tool calls — those are out of scope. (Anti-reference: AI SDK's chat primitives.)

## Plan files that touch this package

- [`.cns/plans/TASK-C.md`](../../.cns/plans/TASK-C.md) — `subscribe` and `subscribeSet` are the primitives this package builds on.
- [`.cns/plans/TASK-D.md`](../../.cns/plans/TASK-D.md) — absorbed into TASK-C; the wall-display case (`subscribeSet(state, "*", onUpdate)`) applies here too.
- [`.cns/plans/TASK-P.md`](../../.cns/plans/TASK-P.md) — cancelled; `setState` batching is sufficient.
- [`.cns/plans/TASK-Q.md`](../../.cns/plans/TASK-Q.md) — stale UX reference: show previous output with "re-deriving" indicator.
- [`.cns/plans/TASK-V.md`](../../.cns/plans/TASK-V.md) — cancelled; renderers shallow-compare inside their callback.

## For the v1.1 implementation phase

When v1.1 work begins, the agent reads this file, opens `.cns/design/index.md` § "The renderer protocol's posture" for the contract, and implements the React hooks and provider.

The implementation is mostly React plumbing: a context provider, three hooks, a registry shape. The interesting decision is *how* the subscription model maps to React's rendering model. `useSyncExternalStore` is the canonical answer for in-process subscriptions; `useEffect`-based subscriptions are the alternative for cross-process transports.

Total code: ~200-300 lines. Most of the work is the registry shape and the auto-render tree walker.
