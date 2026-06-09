---
title: "transport/transports/ws"
type: module
parent: ../../../index.md
principles: [boundary-discipline, type-system-discipline, type-system-discipline]
decisions:
  - id: DEC-TRANSPORT-005
    date: 2026-06-06
    author: agent
    summary: "WebSocket transport: bidirectional. Server pushes events; client sends write/writeHumanInput operations. v1.0."
  - id: DEC-TRANSPORT-005a
    date: 2026-06-08
    author: agent
    summary: "`WsServer.open(registry, send)` subscribes to the registry with a `*` pattern and writes each `WorkflowEvent` to the consumer's `send` function as a JSON frame. `WsServer.close(close)` unsubscribes and closes. Same shape as `SseServer` but with a frame-based send."
  - id: DEC-TRANSPORT-005b
    date: 2026-06-08
    author: agent
    summary: "`WsClient.parse(ws)` registers a `message` handler on the consumer's `WsLike` and pushes each deserialized event into a private `#events` queue. The queue is exposed via a read-only `events` getter. The previous public mutable field was a smell (per the audit)."
  - id: DEC-TRANSPORT-005c
    date: 2026-06-08
    author: agent
    summary: "`WsClient.write(ws, key, value)` and `WsClient.writeHumanInput(ws, key, value)` are typed send methods. Both format the operation as a `WorkflowEvent` (kind: `write` or `writeHumanInput`) and call `ws.send(json)`. The server distinguishes by the node's input schema's `humanFields`. (TASK-43 wiring.)"
  - id: DEC-TRANSPORT-005d
    date: 2026-06-08
    author: agent
    summary: "`WsLike` is a minimal interface that both the browser's `WebSocket` and the `ws` package satisfy: `{ on(event, cb)`, `send(frame)`, `close() }`. The `WsClient` works with either; tests use a `MockWs`."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# transport/src/transports/ws

WebSocket transport. The server wraps a `LiveSubscriptionRegistry`; the client wraps the consumer's `WebSocket`. Each frame is a serialized `WorkflowEvent` JSON string. Bidirectional — server pushes events, client sends `write` / `writeHumanInput` operations. v1.0.

## What lives here

The source is `ws.ts` next to this directory.

- **`WsSend`** / **`WsClose`** — `(frame: string) => void` / `() => void`. The consumer's send/close functions.
- **`WsOutgoing`** — `{ kind: "write", key, value } | { kind: "writeHumanInput", key, value }`. The wire shape for outgoing client frames.
- **`WsServer`** — `open(registry, send)` subscribes and writes JSON frames. `close(close)` unsubscribes and closes.
- **`WsLike`** — minimal interface that both the browser's `WebSocket` and the `ws` package satisfy.
- **`WsClient`** — `parse(ws)` registers a message handler and exposes a read-only `events` queue. `write(ws, key, value)` and `writeHumanInput(ws, key, value)` are typed send methods.
- **`stateToEvents(state)`** — internal. Same shape as `sse.ts`'s.

## Why bidirectional

The wall-display use case is read-only (SSE is enough), but the chat-embedded story needs the consumer (a chat agent or human) to write values back to the running workflow. The WebSocket transport's `write` / `writeHumanInput` methods are the wire for that. The server optionally round-trips operations back to the runtime via an `onClientOperation` callback (TASK-43).

## Boundary

- Imports from: `@underwai/core` (LiveSubscriptionRegistry, NodeKey, WorkflowState), `../event-stream.js` (deserializeEvent, serializeEvent, WorkflowEvent).
- Exports to: `@underwai/transport/index.ts` (re-exports `WsServer`, `WsClient`, `WsSend`, `WsClose`, `WsLike`, `WsOutgoing`).
- **What does NOT live here:** the wire format itself (in `event-stream.ts`), the receive-only transport (in `sse.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
