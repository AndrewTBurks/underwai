---
title: "transport/subscribe"
type: module
parent: ../../index.md
principles: [boundary-discipline, minimal-api-surface, type-system-discipline]
decisions:
  - id: DEC-TRANSPORT-001
    date: 2026-06-06
    author: agent
    summary: "Two subscription methods, no flags. subscribe is exact-key match; subscribeSet is wildcard pattern with `*` as the path-segment wildcard; bare `*` matches every node. No { prefix: true } or { exact: boolean } knob (TASK-C)."
  - id: DEC-TRANSPORT-002
    date: 2026-06-06
    author: agent
    summary: "Callback receives the full updated Node (subscribe) or a Record<string, Node> keyed by relative key (subscribeSet). The consumer's renderer switches on node.status."
  - id: DEC-TRANSPORT-006
    date: 2026-06-06
    author: agent
    summary: No batching or delta flags. TASK-P (batched) and TASK-V (delta) are cancelled. React adapter batches setState natively; wall-display debounces in-renderer. Renderers shallow-compare inside their callback.
  - id: DEC-TRANSPORT-007
    date: 2026-06-06
    author: agent
    summary: 'subscribeSet''s pattern grammar: exact key, or "prefix.*" for path-segment prefix, or "*" for every node. The matched set is keyed by relative key (the matched prefix is stripped for namespaces; "*" returns the original keys).'
  - id: DEC-TRANSPORT-001a
    date: 2026-06-08
    author: agent
    summary: "The exact-key pattern was originally a no-op (TASK-41). The matchPattern function had an else-branch that returned an empty record for an exact-key pattern — the pattern was registered but the callback never produced a match. Fixed: before returning, check `if (all.hasOwnProperty(pattern)) result[pattern] = all[pattern]!`. The exact-key case is a single-node match with the full key as the result key."
  - id: DEC-TRANSPORT-001b
    date: 2026-06-08
    author: agent
    summary: "Pattern matching is implemented in this module (subscribe.ts), not inside the LiveSubscriptionRegistry (core/live.ts). The registry exposes `register` (exact key) and `registerPattern` (wildcard); subscribe.ts' matchPattern translates the consumer's pattern into the appropriate registry calls, so the registry stays pattern-unaware. One source of truth for the pattern grammar."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# transport/src/subscribe

The in-process subscription layer. Two methods: `subscribe` (single key, exact match) and `subscribeSet` (wildcard pattern). Both wrap `LiveSubscriptionRegistry` from `@underwai/core/live` and translate the consumer's call into the registry's primitives.

## What lives here

The source is `subscribe.ts` next to this directory.

- **`Subscription`** — `{ unsubscribe: () => void }`. The return type of both subscription methods.
- **`subscribe(registry, key, onUpdate)`** — single key, exact match. `onUpdate` is called on every state change that touches the key.
- **`subscribeSet(registry, pattern, onUpdate)`** — wildcard pattern. `onUpdate` is called on every state change with a `Record<NodeKey, Node>` keyed by the relative key.
- **`matchPattern(all, pattern)`** — internal. Walks the registry's `byKey` map and returns the matching subset.

## Pattern grammar

- `"*"` matches every node. Relative keys are the full keys.
- `"prefix.*"` matches direct children of prefix. Relative keys are the suffix (e.g., `"a"`, `"b"`) with no further dots.
- `"prefix."` (no wildcard) is equivalent to `"prefix.*"`.
- An exact key (e.g., `"root.a"`) is a single-node match with the full key as the result key (TASK-41 fix).

No batching flag, no delta flag, no prefix flag. TASK-P (batched) and TASK-V (delta) were cancelled. React adapter batches `setState` natively; wall-display debounces in-renderer. Renderers shallow-compare inside their callback.

## Boundary

- Imports from: `@underwai/core` (LiveSubscriptionRegistry, Node, NodeKey, WorkflowState), `@underwai/core/live`.
- Exports to: `@underwai/renderer-react` (uses `subscribe` / `subscribeSet` in the provider's `subscribe`), `@underwai/renderer-log` (uses `subscribeSet` for the wildcard print loop).
- **What does NOT live here:** the registry itself (in `@underwai/core/live`), the wire format (in `event-stream.ts`), the transports (in `transports/`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
