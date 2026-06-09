---
title: "transport/event-stream"
type: module
parent: ../../index.md
principles: [boundary-discipline, minimal-api-surface, encode-lessons-in-structure]
decisions:
  - id: DEC-TRANSPORT-003
    date: 2026-06-06
    author: agent
    summary: Wire format is the WorkflowEvent stream — a discriminated union on event kind (NodeAdded, NodeUpdated, NodeRemoved, EdgeAdded, etc.). The in-process Node-granularity model is a projection of the same event log.
  - id: DEC-TRANSPORT-009
    date: 2026-06-07
    author: agent
    summary: 'WorkflowEvent is a discriminated union on kind: node-added, node-updated, node-removed, edge-added, edge-removed, workflow-status. Each event is JSON-serializable. encodeSseEvent formats an event as an SSE message (event: <kind>\ndata: <json>\n\n). The SseServer and WsServer wrap a LiveSubscriptionRegistry and emit one event per node per notify, plus a workflow-status event. The SseClient and WsClient parse incoming frames back into WorkflowEvents. (DEC-TRANSPORT-003 + DEC-TRANSPORT-004 + DEC-TRANSPORT-005 reflected in code.)'
  - id: DEC-TRANSPORT-009a
    date: 2026-06-08
    author: agent
    summary: "Two additional event kinds were added to the discriminated union: `write` (consumer injection: `{ kind: 'write', key, value, timestamp }`) and `writeHumanInput` (typed flavor for human-marked fields: `{ kind: 'writeHumanInput', key, value, timestamp }`). The WebSocket client sends these as outgoing frames; the server optionally round-trips them back to the runtime via an `onClientOperation` callback. (TASK-43 wiring.)"
  - id: DEC-TRANSPORT-003a
    date: 2026-06-08
    author: agent
    summary: "Each event carries a `timestamp: string` (ISO 8601). The wire form is JSON-friendly. `serializeEvent` produces a JSON string; `deserializeEvent` parses a JSON string back into a `WorkflowEvent`. The Zod schema (`workflowEventSchema`) is the source of truth for the wire form: a discriminated union on `kind`, with each variant carrying its payload. A roundtrip (serialize → deserialize) is the canonical contract test."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# transport/src/event-stream

The wire format for workflow events. A `WorkflowEvent` is a discriminated union on `kind`. Each event is JSON-serializable for transport over SSE or WebSocket.

## What lives here

The source is `event-stream.ts` next to this directory.

- **`WorkflowEvent`** — discriminated union on `kind`. Eight variants:
  - `node-added` — a new node appeared.
  - `node-updated` — a node's status or input changed.
  - `node-removed` — a node was removed (rare; v1.0 mostly marks nodes stale).
  - `edge-added` — a new edge appeared.
  - `edge-removed` — an edge was removed.
  - `workflow-status` — the workflow's top-level status changed.
  - `write` — consumer injection (outgoing frame for WebSocket).
  - `writeHumanInput` — typed flavor for human-marked fields (outgoing frame for WebSocket).
- **`SerializedNode`** — the wire form of a `Node`. JSON-friendly.
- **`workflowEventSchema`** — a Zod discriminated union on `kind`. Source of truth for the wire form. Used by `serializeEvent` and `deserializeEvent` for roundtrip.
- **`serializeEvent(event)`** / **`deserializeEvent(json)`** — JSON roundtrip. The canonical contract test is `deserializeEvent(serializeEvent(e))` equals `e`.
- **`encodeSseEvent(event)`** — formats an event as an SSE message: `event: <kind>\ndata: <json>\n\n`.
- **`stateToEvents(state)`** — internal. Walks a `WorkflowState` and emits one `node-updated` event per node plus a `workflow-status` event. Used by the transports to convert registry notifications into the wire format.

## Boundary

- Imports from: `zod` (peer), `@underwai/core` (Node, WorkflowStatus types).
- Exports to: `transports/sse.ts` (consumes/produces events), `transports/ws.ts` (consumes/produces events), `@underwai/transport/index.ts` (re-exports the public surface).
- **What does NOT live here:** the transports themselves (in `transports/`), the in-process subscription layer (in `subscribe.ts`), the registry (in `@underwai/core/live`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
