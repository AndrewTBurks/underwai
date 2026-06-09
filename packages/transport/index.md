---
title: "@underwai/transport"
type: package
parent: ../../.cns/index.md
status: dirty
shipped_in: v1.0
links:
  - id: transport-subscribe
    path: packages/transport/src/subscribe/index.md
  - id: transport-event-stream
    path: packages/transport/src/event-stream/index.md
  - id: transport-sse
    path: packages/transport/src/transports/sse/index.md
  - id: transport-ws
    path: packages/transport/src/transports/ws/index.md
decisions:
  - id: DEC-TRANSPORT-001
    date: 2026-06-06
    author: agent
    summary: "Two subscription methods, no flags. subscribe is exact-key match; subscribeSet is wildcard pattern with `*` as the path-segment wildcard; bare `*` matches every node. No { prefix: true } or { exact: boolean } knob (TASK-C)."
  - id: DEC-TRANSPORT-002
    date: 2026-06-06
    author: agent
    summary: "Callback receives the full updated Node (subscribe) or a Record<string, Node> keyed by relative key (subscribeSet). The consumer's renderer switches on node.status."
  - id: DEC-TRANSPORT-003
    date: 2026-06-06
    author: agent
    summary: Wire format is the WorkflowEvent stream — a discriminated union on event kind (NodeAdded, NodeUpdated, NodeRemoved, EdgeAdded, etc.). The in-process Node-granularity model is a projection of the same event log.
  - id: DEC-TRANSPORT-004
    date: 2026-06-06
    author: agent
    summary: "SSE transport: server pushes the WorkflowEvent stream to a client over an HTTP connection. One-way (server → client). v1.0."
  - id: DEC-TRANSPORT-005
    date: 2026-06-06
    author: agent
    summary: "WebSocket transport: bidirectional. Server pushes events; client sends write/writeHumanInput operations. v1.0."
  - id: DEC-TRANSPORT-006
    date: 2026-06-06
    author: agent
    summary: No batching or delta flags. TASK-P (batched) and TASK-V (delta) are cancelled. React adapter batches setState natively; wall-display debounces in-renderer. Renderers shallow-compare inside their callback.
  - id: DEC-TRANSPORT-007
    date: 2026-06-06
    author: agent
    summary: 'subscribeSet''s pattern grammar: exact key, or "prefix.*" for path-segment prefix, or "*" for every node. The matched set is keyed by relative key (the matched prefix is stripped for namespaces; "*" returns the original keys).'
  - id: DEC-TRANSPORT-008
    date: 2026-06-07
    author: agent
    summary: "LiveSubscriptionRegistry lives in @underwai/core. It is a small in-process fan-out: register(key, cb) / registerPattern(pattern, cb) / notify(state). The transport layer wraps it with pattern matching; the runner runtime calls notify after every state mutation (when runWorkflow is given a liveRegistry in RunOptions). The React renderer wraps it with useSyncExternalStore. One registry, three adapters. (TASK-32 wiring.)"
  - id: DEC-TRANSPORT-009
    date: 2026-06-07
    author: agent
    summary: 'WorkflowEvent is a discriminated union on kind: node-added, node-updated, node-removed, edge-added, edge-removed, workflow-status. Each event is JSON-serializable. encodeSseEvent formats an event as an SSE message (event: <kind>\ndata: <json>\n\n). The SseServer and WsServer wrap a LiveSubscriptionRegistry and emit one event per node per notify, plus a workflow-status event. The SseClient and WsClient parse incoming frames back into WorkflowEvents. (DEC-TRANSPORT-003 + DEC-TRANSPORT-004 + DEC-TRANSPORT-005 reflected in code.)'
human_notes: |

last_reconciled: 2026-06-06
---

# @underwai/transport

The subscription API and the wire format. Sits on top of `@underwai/core`. v1.0 ships the in-process subscription API _and_ the wire-format transports (SSE, WebSocket). The whole point of v1.0 is a lib that has a way to be consumed; transport is part of that.

## What will live here (v1.0)

- `package.json` — `@underwai/transport`, depends on `@underwai/core` and `effect`. Real package, v1.0.
- `src/index.ts` — the public entry. Re-exports `subscribe`, `subscribeSet`, the `Subscription` interface, the `WorkflowEvent` stream (wire format), and the SSE / WebSocket transports.
- `src/subscribe.ts` — in-process subscription. `subscribe(state, key, onUpdate)` and `subscribeSet(state, pattern, onUpdate)`. (TASK-C, TASK-D)
- `src/event-stream.ts` — the `WorkflowEvent` stream: `NodeAdded`, `NodeUpdated`, `NodeRemoved`, `EdgeAdded`, etc. The wire format for SSE / WebSocket transports. The in-process `Node`-granularity model is a _projection_ of the same event log.
- `src/transports/sse.ts` — Server-Sent Events transport. Server pushes the `WorkflowEvent` stream to a client over an HTTP connection. v1.0.
- `src/transports/ws.ts` — WebSocket transport. Bidirectional — server pushes events, client sends `write` / `writeHumanInput` operations. v1.0.

## Boundary

- **Will import from:** `@underwai/core` (data structure), `effect` (peer).
- **Will export to:** `@underwai/renderer-react` (v1.1+, subscribes to the event stream), `@underwai/renderer-log` (v1.1+), consumer code.
- **What will NOT live here:** the data structure, the runner. This package is the bridge between in-memory state and external observers.

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `.cns/architecture/index.md` § "Subscription" for the API contract, and implements subscribe.ts, event-stream.ts, and the two transports (sse.ts, ws.ts).

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the subscription API (no flags), the wire format (the WorkflowEvent stream), and the transports (SSE one-way, WebSocket bidirectional). Prose in the body is for the file plan; the _why_ lives in the decisions array.

The transport package is part of v1.0 because the v1 deliverable is "a lib that has a way to be consumed." Without transport, the runner is observable only by an in-process consumer. The wire format is the bridge to renderers that run on different machines (the wall-display, the chat-embedded story) and to non-React consumers (the log renderer can be a CLI tool that tails the event stream over WebSocket).

Total code: ~300-500 lines. The interesting part is the event-stream shape (a discriminated union on event kind) and the two transport implementations. SSE is one-way (server → client); WebSocket is bidirectional. The lib's contract is the event stream; the transports are thin protocol layers.
