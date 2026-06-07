---
title: "@underwai/transport"
type: package
parent: ../../.cns/index.md
status: dirty
shipped_in: v1.0
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/transport

The subscription API and the wire format. Sits on top of `@underwai/core`. v1.0 ships the in-process subscription API *and* the wire-format transports (SSE, WebSocket). The whole point of v1.0 is a lib that has a way to be consumed; transport is part of that.

## What will live here (v1.0)

- `package.json` — `@underwai/transport`, depends on `@underwai/core` and `effect`. Real package, v1.0.
- `src/index.ts` — the public entry. Re-exports `subscribe`, `subscribeSet`, the `Subscription` interface, the `WorkflowEvent` stream (wire format), and the SSE / WebSocket transports.
- `src/subscribe.ts` — in-process subscription. `subscribe(state, key, onUpdate)` and `subscribeSet(state, pattern, onUpdate)`. (TASK-C, TASK-D)
- `src/event-stream.ts` — the `WorkflowEvent` stream: `NodeAdded`, `NodeUpdated`, `NodeRemoved`, `EdgeAdded`, etc. The wire format for SSE / WebSocket transports. The in-process `Node`-granularity model is a *projection* of the same event log.
- `src/transports/sse.ts` — Server-Sent Events transport. Server pushes the `WorkflowEvent` stream to a client over an HTTP connection. v1.0.
- `src/transports/ws.ts` — WebSocket transport. Bidirectional — server pushes events, client sends `write` / `writeHumanInput` operations. v1.0.

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

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `.cns/architecture/index.md` § "Subscription" for the API contract, and implements subscribe.ts, event-stream.ts, and the two transports (sse.ts, ws.ts).

The transport package is part of v1.0 because the v1 deliverable is "a lib that has a way to be consumed." Without transport, the runner is observable only by an in-process consumer. The wire format is the bridge to renderers that run on different machines (the wall-display, the chat-embedded story) and to non-React consumers (the log renderer can be a CLI tool that tails the event stream over WebSocket).

Total code: ~300-500 lines. The interesting part is the event-stream shape (a discriminated union on event kind) and the two transport implementations. SSE is one-way (server → client); WebSocket is bidirectional. The lib's contract is the event stream; the transports are thin protocol layers.
