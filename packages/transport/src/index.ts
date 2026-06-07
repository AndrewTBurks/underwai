// @underwai/transport public entry point.
//
// Phase 1 ships an empty package. Phase 2 implements:
//   - src/subscribe.ts    — in-process subscribe / subscribeSet
//   - src/event-stream.ts — WorkflowEvent stream (the wire format)
//   - src/transports/sse.ts  — SSE server + client (v1.0)
//   - src/transports/ws.ts   — WebSocket server + client (v1.0)
//
// See ../index.md for the design rationale.

export {}
