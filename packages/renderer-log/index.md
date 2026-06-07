---
parent: ../../.cns/index.md
title: "@underwai/renderer-log"
status: clean
last_reconciled: 2026-06-07
type: package
human_notes: |
decisions:
  - id: DEC-RL-001
    date: 2026-06-07
    author: agent
    summary: 'The kind -> text registry: kind -> (node, indent) -> string. registerKind / getKindRenderer / clearRegistry. Default renderer prints "<indent><kind> (<status>)".'
  - id: DEC-RL-002
    date: 2026-06-07
    author: agent
    summary: 'runLogRenderer(registry, initialState, {print, getState}) subscribes via subscribeSet(registry, "*", onUpdate). On every notify, it calls getState() to read the latest, walks the DAG, and prints each node via the registered kind renderer. The consumer owns the state; the runner subscribes for change notifications.'
---

# @underwai/renderer-log

The smallest possible consumer. A stdout log renderer that subscribes to a workflow and prints it.

## What lives here

- `src/registry.ts` — kind → `(node, indent) => string`. Default renderer is `"<indent><kind> (<status>)"`.
- `src/runner.ts` — `runLogRenderer(registry, initialState, {print, getState})`. Subscribes via `subscribeSet(registry, "*", onUpdate)`; on every notify, calls `getState()` to read the latest, walks the DAG, and prints each node.
- `src/index.ts` — re-exports.

## Boundary

Imports from `@underwai/core` (LiveSubscriptionRegistry, types) and `@underwai/transport` (subscribeSet). Re-exports the small public surface.

## For the v1.X implementation phase

The runner takes a `getState` function from the consumer. This is the v1.0 wire: the consumer owns the state (typically via a ref or React state), the runner subscribes for change notifications, and reads the state on each notify. A future v1.1 could pass the state through subscribeSet's callback instead, but for now the consumer-owned pattern matches how transport's `subscribeSet` is shaped.

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above.
