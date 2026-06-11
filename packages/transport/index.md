---
title: "@underwai/transport"
type: package
parent: ../../.cns/index.md
status: clean
last_reconciled: 2026-06-11
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

---

# @underwai/transport

The subscription and wire-format package. It wraps `@underwai/core`'s `LiveSubscriptionRegistry` with consumer-facing pattern matching, then projects workflow state into a JSON-serializable `WorkflowEvent` stream for SSE and WebSocket transports.

## What lives here

- `src/subscribe.ts` — `subscribe`, `subscribeSet`, `Subscription`, and the pattern grammar: exact key, `prefix.*`, `prefix.`, and bare `*`.
- `src/event-stream.ts` — `WorkflowEvent`, `SerializedNode`, Zod wire schemas, JSON roundtrip helpers, SSE encoding, and `stateToEvents(state)`.
- `src/transports/sse.ts` — one-way server-to-client event transport.
- `src/transports/ws.ts` — bidirectional WebSocket transport. Server pushes events; client can send typed `write` and `writeHumanInput` operations.
- `src/index.ts` — public re-exports.

## Boundary

- **Imports from:** `@underwai/core` for data types and the live registry; `zod` for the wire schema.
- **Exports to:** renderer packages, examples, and consumers that need in-process subscriptions or external event streams.
- **What does NOT live here:** workflow state construction, runtime mutation, or renderer-specific UI.

The completed TASK-C, TASK-D, TASK-P, TASK-V, TASK-32, TASK-41, and TASK-43 decisions are sharded into this package and its module nodes. The package-level decisions encode the contract; module-specific mechanics live in `src/subscribe/index.md`, `src/event-stream/index.md`, and the transport module nodes.
