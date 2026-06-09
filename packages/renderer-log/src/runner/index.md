---
title: "renderer-log/runner"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, experience-first]
decisions:
  - id: DEC-RL-002
    date: 2026-06-07
    author: agent
    summary: "runLogRenderer(registry, initialState, {print, getState}) subscribes via subscribeSet(registry, '*', onUpdate). On every notify, it calls getState() to read the latest, walks the DAG, and prints each node via the registered kind renderer. The consumer owns the state; the runner subscribes for change notifications."
  - id: DEC-RL-002a
    date: 2026-06-08
    author: agent
    summary: "The runner takes a `getState` function from the consumer. This is the v1.0 wire: the consumer owns the state (typically via a ref or React state), the runner subscribes for change notifications, and reads the state on each notify. The runner does not own the state; it cannot be the source of truth."
  - id: DEC-RL-002b
    date: 2026-06-08
    author: agent
    summary: "On startup, the runner fires once with the initial state (so the consumer sees a render at t=0). Then it subscribes via `subscribeSet(registry, '*', ...)` and on every notify calls `opts.getState()` to read the latest. The `print` option defaults to `console.log`; tests pass a captured-stdout function."
  - id: DEC-RL-002c
    date: 2026-06-08
    author: agent
    summary: "Indent is computed from the key: `depth = (key as string).split('.').length - 1`. Root nodes have depth 0; `root.a` has depth 1; `root.a.b` has depth 2. This matches the topological level when the keys follow the composition's path."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# renderer-log/src/runner

`runLogRenderer(registry, initialState, opts)` subscribes to a workflow via `subscribeSet(registry, "*", onUpdate)`. On every notify, it walks the DAG and prints each node via the registered kind renderer. The smallest possible consumer — a stdout log renderer for tests and CLI tools.

## What lives here

The source is `runner.ts` next to this directory.

- **`RunOptions`** — `{ print?: (line) => void; getState: () => WorkflowState }`. `print` defaults to `console.log`; `getState` is the consumer's source of truth.
- **`runLogRenderer(registry, initialState, opts): Subscription`** — fires once with the initial state, then subscribes for updates. Returns the subscription so the consumer can `unsubscribe()` later.

## Why consumer-owned state

The transport layer's `subscribeSet` only delivers change notifications; the payload is the state, not a delta. The runner needs to read the latest state on every notify. Passing a `getState` function is the v1.0 wire: the consumer owns the state (typically via a React state or a ref), the runner subscribes to the registry for change notifications, and reads the state on each notify. A future v1.1 could pass the state through `subscribeSet`'s callback payload, but the consumer-owned pattern matches how transport's `subscribeSet` is shaped today.

## Boundary

- Imports from: `@underwai/transport` (subscribeSet, Subscription), `@underwai/core` (LiveSubscriptionRegistry, WorkflowState), `./registry.js` (defaultRenderer, getKindRenderer).
- Exports to: the test suite (3 tests in `index.test.ts`), any CLI tool or smoke-test harness that wants to watch a workflow's state.
- **What does NOT live here:** the kind registry (in `registry.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
