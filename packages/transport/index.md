---
title: "@underwai/transport"
type: package
parent: ../../.cns/index.md
status: deferred
shipped_in: v1.1+
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/transport

> **Deferred to v1.1+.** This package does not have a `package.json` yet — only an `index.md` that pre-stages the local context. Phase 2 of the v1 implementation does not touch this folder. When v1.1 work begins, this folder is promoted to a real workspace package.

The subscription API and the wire format. Sits on top of `@underwai/core`. v1 ships in-process subscription only; v1.1+ ships wire-format transports (SSE, WebSocket, change-stream).

## What will live here (v1.1+)

- `package.json` — `@underwai/transport`, depends on `@underwai/core` and `effect`.
- `src/index.ts` — the public entry. Re-exports `subscribe`, `subscribeSet`, the `Subscription` interface, the `WorkflowEvent` stream (wire format).
- `src/subscribe.ts` — in-process subscription. `subscribe(state, key, onUpdate)` and `subscribeSet(state, pattern, onUpdate)`. (TASK-C, TASK-D)
- `src/event-stream.ts` — the `WorkflowEvent` stream: `NodeAdded`, `NodeUpdated`, `NodeRemoved`, `EdgeAdded`, etc. The wire format for SSE / WebSocket transports. The in-process `Node`-granularity model is a *projection* of the same event log.

## Boundary

- **Will import from:** `@underwai/core` (data structure), `effect` (peer).
- **Will export to:** `@underwai/renderer-react` (v1.1+, subscribes to the event stream), `@underwai/renderer-log` (v1.1+), consumer code.
- **What will NOT live here:** the data structure, the runner. This package is the bridge between in-memory state and external observers.

## Design decisions that govern this package

- **Two subscription methods, no flags.** (TASK-C) `subscribe` is exact-key match; `subscribeSet` is wildcard pattern (`"root.*"` for descendants, `"*"` for every node). No `{ prefix: true }` or `{ exact: boolean }` knob.
- **Callback receives the full updated `Node`.** The consumer's renderer switches on `node.status`. (TASK-S — the `getHumanInputDisplay` helper is in `@underwai/core`; this package subscribes to its results.)
- **Wire format is event-stream, not Node-granularity.** Transports consume a more minimal `WorkflowEvent` stream from the runner. The in-process model is a *projection* of the same event log.
- **No batching or delta flags.** (TASK-P, TASK-V, both cancelled) The React adapter batches `setState` natively; the wall-display debounces in-renderer. Renderers shallow-compare inside their callback.

## Plan files that touch this package

- [`.cns/plans/TASK-C.md`](../../.cns/plans/TASK-C.md) — subscribe / subscribeSet.
- [`.cns/plans/TASK-D.md`](../../.cns/plans/TASK-D.md) — absorbed into TASK-C.
- [`.cns/plans/TASK-P.md`](../../.cns/plans/TASK-P.md) — cancelled; no `batched` option.
- [`.cns/plans/TASK-S.md`](../../.cns/plans/TASK-S.md) — `getHumanInputDisplay` is in `@underwai/core`; this package's subscribers consume its results.
- [`.cns/plans/TASK-V.md`](../../.cns/plans/TASK-V.md) — cancelled; no `delta` option.

## For the v1.1 implementation phase

When v1.1 work begins, the agent reads this file, opens `.cns/architecture/index.md` § "Subscription" for the API contract, and implements two files (`subscribe.ts` and `event-stream.ts`). The in-process `subscribe` / `subscribeSet` are thin wrappers around the runner's mutation events; the event-stream is a publish-subscribe layer.

The transport package is a v1.1 deliverable because the v1 use case (in-process) doesn't need it. The reference React adapter and the wall-display renderer are also v1.1+ — they need this package.
