// @underwai/transport — transports/ws.ts
//
// WebSocket transport. The server wraps a workflow state stream;
// the client wraps the consumer's WebSocket. Each frame is a
// serialized WorkflowEvent JSON string.
//
// v1.0 shape:
//   - WsServer.open(registry, send): subscribes and writes
//     JSON frames to the consumer's send function.
//   - WsClient.parse(ws): wraps a WebSocket that emits "message"
//     events; parses each frame into a WorkflowEvent.
//
// The structure is real; tests use a mock send/recv.
import type { LiveSubscriptionRegistry, NodeKey, WorkflowState } from "@underwai/core";
import { serializeEvent, type WorkflowEvent } from "../event-stream.js";
import { deserializeEvent } from "../event-stream.js";

export type WsSend = (frame: string) => void;
export type WsClose = () => void;

// Outgoing frames: write (consumer injection), writeHumanInput
// (typed flavor for human-marked fields). Wire format matches
// the WorkflowEvent JSON shape: each frame is a serialized event.
export type WsOutgoing =
  | { kind: "write"; key: string; value: unknown }
  | { kind: "writeHumanInput"; key: string; value: unknown };

export class WsServer {
  private unsubscribe: (() => void) | null = null;

  open(registry: LiveSubscriptionRegistry, send: WsSend): void {
    this.unsubscribe = registry.registerPattern("*", (state) => {
      const events = stateToEvents(state);
      for (const e of events) {
        send(serializeEvent(e));
      }
    });
  }

  close(close: WsClose): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    close();
  }
}

function stateToEvents(state: WorkflowState): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];
  const timestamp = state.updatedAt;
  for (const [key, node] of Object.entries(state.nodes)) {
    events.push({
      kind: "node-updated",
      key,
      node: {
        id: (node.id as unknown as string) ?? key,
        kind: node.kind,
        status: node.status,
        actor: node.actor,
        input: node.input.value,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
      timestamp,
    });
  }
  events.push({ kind: "workflow-status", status: state.status, timestamp });
  return events;
}

// Minimal WebSocket-shape interface. Both the browser's WebSocket
// and the `ws` package implement enough of this that WsClient can
// use either. (A test uses a MockWs.)
export type WsLike = {
  on: (event: "message" | "close" | "error", cb: (data: string) => void) => void;
  send: (frame: string) => void;
  close: () => void;
};

export class WsClient {
  events: WorkflowEvent[] = [];
  parse(ws: WsLike): WorkflowEvent[] {
    ws.on("message", (data) => {
      this.events.push(deserializeEvent(data));
    });
    return this.events;
  }

  // write: send a consumer-injection frame. The server applies
  // the value to the node's `finalOutput` and marks the node
  // resolved.
  write(ws: WsLike, key: NodeKey, value: unknown): void {
    ws.send(
      serializeEvent({
        kind: "write",
        key: key as unknown as string,
        value,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // writeHumanInput: send a typed-flavor injection for a
  // human-marked field. Same wire shape as write; the server
  // distinguishes by node's input schema's humanFields.
  writeHumanInput(ws: WsLike, key: NodeKey, value: unknown): void {
    ws.send(
      serializeEvent({
        kind: "writeHumanInput",
        key: key as unknown as string,
        value,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
