---
title: "transport/transports/sse"
type: module
parent: ../../../index.md
principles: [boundary-discipline, type-system-discipline, minimal-api-surface]
decisions:
  - id: DEC-TRANSPORT-004
    date: 2026-06-06
    author: agent
    summary: "SSE transport: server pushes the WorkflowEvent stream to a client over an HTTP connection. One-way (server → client). v1.0."
  - id: DEC-TRANSPORT-004a
    date: 2026-06-08
    author: agent
    summary: "`SseServer.open(registry, sink)` subscribes to the registry with a `*` pattern and writes each `WorkflowEvent` to the sink as a single SSE message (`event: <kind>\\ndata: <json>\\n\\n`). `SseServer.close(sink)` unsubscribes and closes the sink. The server holds a single unsubscribe function and clears it on close. Tests use a mock sink/stream; the structure is real."
  - id: DEC-TRANSPORT-004b
    date: 2026-06-08
    author: agent
    summary: "`SseClient.parse(stream)` is an async generator. It walks the stream chunks, splits on newlines, and for each `data: <json>` line, deserializes the JSON via `deserializeEvent` from `event-stream.ts`. Yields the resulting `WorkflowEvent`. The client is receive-only (server → client); bidirectional is the WebSocket transport's job."
  - id: DEC-TRANSPORT-004c
    date: 2026-06-08
    author: agent
    summary: "`stateToEvents(state)` emits one `node-updated` event per node (using the state's `updatedAt` as the timestamp) plus a single `workflow-status` event at the end. The diff is implicit — the consumer compares successive states. Granular diffs (one event per changed field) are a v1.1 follow-up."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# transport/src/transports/sse

Server-Sent Events transport. The wire format is one SSE message per `WorkflowEvent`. The server wraps a `LiveSubscriptionRegistry`; the client parses with `EventSource`. v1.0.

## What lives here

The source is `sse.ts` next to this directory.

- **`SseSink`** — `{ write: (chunk: string) => void; close: () => void }`. The consumer's write target.
- **`SseServer`** — `open(registry, sink)` subscribes with a `*` pattern and writes each event to the sink. `close(sink)` unsubscribes and closes.
- **`SseEventStream`** — `AsyncIterable<string>`. The client's input.
- **`SseClient`** — `parse(stream)` is an async generator. For each `data: <json>` line, deserializes and yields a `WorkflowEvent`.
- **`stateToEvents(state)`** — internal. Emits one `node-updated` per node plus a `workflow-status` event.

## Why one-way

SSE is HTTP-based and server-initiated only. The consumer's HTTP request opens a long-lived connection; the server pushes events. Bidirectional is the WebSocket transport's job (TASK-43). v1.0 ships both.

## Boundary

- Imports from: `@underwai/core` (LiveSubscriptionRegistry, WorkflowState), `../event-stream.js` (deserializeEvent, encodeSseEvent, WorkflowEvent).
- Exports to: `@underwai/transport/index.ts` (re-exports `SseServer`, `SseClient`, `SseSink`, `SseEventStream`).
- **What does NOT live here:** the wire format itself (in `event-stream.ts`), the in-process subscription layer (in `subscribe.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
