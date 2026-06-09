---
title: "core/live"
type: module
parent: ../../index.md
principles: [boundary-discipline, minimal-api-surface, encode-lessons-in-structure]
decisions:
  - id: DEC-TRANSPORT-008
    date: 2026-06-07
    author: agent
    summary: "LiveSubscriptionRegistry lives in @underwai/core. It is a small in-process fan-out: register(key, cb) / registerPattern(pattern, cb) / notify(state). The transport layer wraps it with pattern matching; the runner runtime calls notify after every state mutation (when runWorkflow is given a liveRegistry in RunOptions). The React renderer wraps it with useSyncExternalStore. One registry, three adapters. (TASK-32 wiring.)"
  - id: DEC-CORE-021
    date: 2026-06-08
    author: agent
    summary: '`LiveSubscriptionRegistry` exposes two registration methods: `register(key, cb)` for exact-key subscribers, `registerPattern(pattern, cb)` for wildcard subscribers. Both return an unsubscribe function. The `notify(state)` method fans out to all subscribers. Pattern matching is NOT done inside the registry — it is done by the transport layer (`@underwai/transport/subscribe.ts`) which wraps the registry. The registry itself only stores the two kinds of callback maps.'
  - id: DEC-CORE-021a
    date: 2026-06-08
    author: agent
    summary: 'The `LiveCallback` type alias was removed (TASK-40). It was named in the original DEC-TRANSPORT-008 sketch but never referenced outside this module. The callback types are inline at the registration methods. (Verified: `grep LiveCallback` across all packages returns 0 hits outside `live.ts` itself.)'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# core/src/live

A small in-process subscription registry. The runner's runtime calls `notify(state)` after every state mutation; subscribers register callbacks keyed by `NodeKey` (exact) or pattern (wildcard, via the transport layer's wrapper).

## What lives here

The source is `live.ts` next to this directory.

- **`LiveSubscriptionRegistry`** — a class with two registration methods (`register`, `registerPattern`) and a `notify(state)` fan-out.
- **No pattern matching inside the registry.** The pattern grammar (`*`, `prefix.*`, exact key) is implemented in `@underwai/transport/subscribe.ts`. The registry stores the two kinds of callback maps separately and lets the transport layer call `register` with the matched keys.

## Why this lives in core

It's the lowest-level fan-out primitive. The runner (mutator) needs it; the transport layer (pattern matching + wire format) wraps it; the React renderer (useSyncExternalStore) wraps it. Putting it in core means: one implementation, three adapters. The transport layer doesn't re-implement fan-out; the React renderer doesn't re-implement fan-out; the runner's runtime doesn't re-implement fan-out. DEC-TRANSPORT-008.

## Boundary

- Imports from: `./types.js` (Node, NodeKey, WorkflowState).
- Exports to: `@underwai/transport` (wraps with pattern matching), `@underwai/renderer-react` (wraps with `useSyncExternalStore`), `@underwai/renderer-log` (subscribes via transport's `subscribeSet`), `@underwai/runner` (calls `notify` on every state mutation when a `liveRegistry` is provided in `RunOptions`).
- **What does NOT live here:** pattern matching (in transport), the Effect service (in runner), the React adapter (in renderer-react).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
