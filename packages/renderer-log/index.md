---
title: "@underwai/renderer-log"
type: package
parent: ../../.cns/index.md
status: dirty
shipped_in: v1.0
decisions:
  - id: DEC-RL-001
    date: 2026-06-06
    author: agent
    summary: 'Every kind is renderable. The registry has a default (node, indent) => string for unknown kinds, so adding a new kind to the lib doesn''t break this renderer. (Laziness protocol: shipping a registry that requires per-kind registration would mean every new kind touches this package.)'
  - id: DEC-RL-002
    date: 2026-06-06
    author: agent
    summary: 'Subscription via subscribeSet(state, "*", onUpdate). Re-renders the whole tree on every change. For test/debug use, performance is not the priority (TASK-D, absorbed into TASK-C).'
  - id: DEC-RL-003
    date: 2026-06-06
    author: agent
    summary: 'No "AI chat" or "agent" UI affordances. This package is a workflow logger. The output is a typed DAG that prints, not a transcript.'
  - id: DEC-RL-004
    date: 2026-06-06
    author: agent
    summary: 'stdout, not stderr. State changes are the primary output, not diagnostics. (The lib''s own logs go to stderr; this renderer''s output goes to stdout.)'
  - id: DEC-RL-005
    date: 2026-06-06
    author: agent
    summary: 'Stale UX reference (TASK-Q): print [re-deriving] next to stale nodes. Coalesced re-execution (TASK-M): log the coalesced state, not the intermediate writes.'
  - id: DEC-RL-006
    date: 2026-06-06
    author: agent
    summary: A --watch mode (delta stream) is a v1.1+ extension if the wall-display case ever needs it. v1.0 ships without it; the registry structure leaves room for --watch to be added without breaking the public API (TASK-V cancelled).
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/renderer-log

The stdout log renderer. For tests, debugging, and the "I just want to see what's happening" case. The smallest possible renderer that exercises the full subscription + auto-render protocol. Shipped with v1.0 — it's how tests assert the runner is doing the right thing without depending on React.

## What will live here (v1.0)

- `package.json` — `@underwai/renderer-log`, depends on `@underwai/core` and `@underwai/transport`. Real package, v1.0. No peer-deps; the lib does the work.
- `src/index.ts` — the public entry. Re-exports `logRenderer` (the registry), `runLogRenderer(state, opts?)` (the entry point).
- `src/registry.ts` — the registry. Maps every known `kind` to a `(node, indent) => string` function. Renders the node to a human-readable line.
- `src/runner.ts` — `runLogRenderer(state, opts?)`. Subscribes to state changes via `subscribeSet(state, "*", onUpdate)`, re-renders on every change. Defaults to ANSI-colored output; `--no-color` for non-TTY.

## Boundary

- **Will import from:** `@underwai/core` (data structure), `@underwai/transport` (subscription).
- **Will export to:** consumer code (the test fixture, the debug CLI).
- **What will NOT live here:** the data structure, the runner, the transport. This package is a thin debug renderer.

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `.cns/design/index.md` § "The renderer protocol's posture" for the contract, and implements two small files (`registry.ts` and `runner.ts`).

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the default-for-unknown-kinds registry, the subscribeSet subscription model, the stdout-not-stderr output choice, and the v1.0-ships-without-delta-stream decision. Prose in the body is for the file plan; the *why* lives in the decisions array.

The implementation is the smallest possible proof that the renderer protocol works. Total code: ~100 lines. The test suite for the lib uses this renderer as the visible signal in unit tests — no React, no DOM, just a terminal.

This package is part of v1.0 because tests are a v1 deliverable. Without a log renderer, the runner's correctness has to be asserted by reading internal state, which is fragile. The log renderer gives tests a stable, observable output.

A future extension: a `--watch` mode that tails state changes as a stream (rather than re-rendering the whole tree on each change) — that would be the cancelled TASK-V's `delta: true` option. If the wall-display case ever needs a delta stream, this package is where it would live. v1.0 ships without it; the registry structure leaves room for a `--watch` mode to be added later without breaking the public API.
