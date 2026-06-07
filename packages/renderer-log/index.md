---
title: "@underwai/renderer-log"
type: package
parent: ../../.cns/index.md
status: deferred
shipped_in: v1.1+
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/renderer-log

> **Deferred to v1.1+.** This package does not have a `package.json` yet — only an `index.md` that pre-stages the local context. Phase 2 of the v1 implementation does not touch this folder. When v1.1 work begins, this folder is promoted to a real workspace package.

The stdout log renderer. For tests, debugging, and the "I just want to see what's happening" case. The smallest possible renderer that exercises the full subscription + auto-render protocol.

## What will live here (v1.1+)

- `package.json` — `@underwai/renderer-log`, depends on `@underwai/core` and `@underwai/transport`. No peer-deps; the lib does the work.
- `src/index.ts` — the public entry. Re-exports `logRenderer` (the registry), `runLogRenderer(state, opts?)` (the entry point).
- `src/registry.ts` — the registry. Maps every known `kind` to a `(node, indent) => string` function. Renders the node to a human-readable line.
- `src/runner.ts` — `runLogRenderer(state, opts?)`. Subscribes to state changes via `subscribeSet(state, "*", onUpdate)`, re-renders on every change. Defaults to ANSI-colored output; `--no-color` for non-TTY.

## Boundary

- **Will import from:** `@underwai/core` (data structure), `@underwai/transport` (subscription).
- **Will export to:** consumer code (the test fixture, the debug CLI).
- **What will NOT live here:** the data structure, the runner, the transport. This package is a thin debug renderer.

## Design decisions that govern this package

- **Every `kind` is renderable.** The registry has a default `(node, indent) => string` for unknown kinds, so adding a new `kind` to the lib doesn't break this renderer. (Laziness protocol: shipping a registry that requires per-kind registration would mean every new kind touches this package.)
- **Subscription via `subscribeSet(state, "*", onUpdate)`.** Re-renders the whole tree on every change. For test/debug use, this is fine; performance is not the priority. (TASK-D, absorbed into TASK-C; the wall-display case in TASK-D's original plan is also this pattern.)
- **No "AI chat" or "agent" UI affordances.** This package is a workflow logger. The output is a typed DAG that prints, not a transcript.
- **Stdout, not stderr.** State changes are the primary output, not diagnostics. (The lib's own logs go to stderr; this renderer's output goes to stdout.)

## Plan files that touch this package

- [`.cns/plans/TASK-C.md`](../../.cns/plans/TASK-C.md) — `subscribeSet(state, "*", onUpdate)` is the entry point.
- [`.cns/plans/TASK-D.md`](../../.cns/plans/TASK-D.md) — the original "wall-display" plan that became this renderer.
- [`.cns/plans/TASK-M.md`](../../.cns/plans/TASK-M.md) — re-execution coalescing rule; this renderer logs the coalesced state.
- [`.cns/plans/TASK-Q.md`](../../.cns/plans/TASK-Q.md) — stale UX reference; this renderer prints `[re-deriving]` next to stale nodes.

## For the v1.1 implementation phase

When v1.1 work begins, the agent reads this file, opens `.cns/design/index.md` § "The renderer protocol's posture" for the contract, and implements two small files (`registry.ts` and `runner.ts`).

The implementation is the smallest possible proof that the renderer protocol works. Total code: ~100 lines. The test for the lib uses this renderer as the visible signal in unit tests.

A future extension: a `--watch` mode that tails state changes as a stream (rather than re-rendering the whole tree on each change) — that would be TASK-D's `delta: true` option that was cancelled in v1. If the wall-display case ever needs a delta stream, this package is where it would live.
