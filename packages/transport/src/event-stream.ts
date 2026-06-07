// @underwai/transport — event-stream.ts
//
// The wire format for workflow events. A WorkflowEvent is a
// discriminated union on `kind`. Each event is JSON-serializable
// for transport over SSE or WebSocket.
//
// Event kinds:
//   - "node-added" — a new node appeared in the state.
//   - "node-updated" — a node's status or input changed.
//   - "node-removed" — a node was removed (rare; v1.0 mostly
//     marks nodes stale rather than removing them).
//   - "edge-added" — a new edge appeared.
//   - "edge-removed" — an edge was removed.
//   - "workflow-status" — the workflow's top-level status changed.
//
// The timestamp is ISO 8601. The serialized form is what travels
// over the wire; deserializing reconstructs the WorkflowEvent.
import { z } from "zod";
import type { Node, WorkflowStatus } from "@underwai/core";

// WorkflowEvent: a discriminated union. Each variant carries the
// minimal info the consumer needs to react.
export type WorkflowEvent =
  | {
      kind: "node-added";
      key: string;
      node: SerializedNode;
      timestamp: string;
    }
  | {
      kind: "node-updated";
      key: string;
      node: SerializedNode;
      timestamp: string;
    }
  | {
      kind: "node-removed";
      key: string;
      timestamp: string;
    }
  | {
      kind: "edge-added";
      from: string;
      to: string;
      timestamp: string;
    }
  | {
      kind: "edge-removed";
      from: string;
      to: string;
      timestamp: string;
    }
  | {
      kind: "workflow-status";
      status: WorkflowStatus;
      timestamp: string;
    }
  | {
      kind: "write";
      key: string;
      value: unknown;
      timestamp: string;
    }
  | {
      kind: "writeHumanInput";
      key: string;
      value: unknown;
      timestamp: string;
    };

// SerializedNode: the wire form of a Node. JSON-friendly.
export type SerializedNode = {
  id: string;
  kind: string;
  status: Node["status"];
  actor: string;
  input: unknown;
  output?: unknown;
  createdAt: string;
  updatedAt: string;
};

export const workflowEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("node-added"),
    key: z.string(),
    node: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    kind: z.literal("node-updated"),
    key: z.string(),
    node: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    kind: z.literal("node-removed"),
    key: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    kind: z.literal("edge-added"),
    from: z.string(),
    to: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    kind: z.literal("edge-removed"),
    from: z.string(),
    to: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    kind: z.literal("workflow-status"),
    status: z.string(),
    timestamp: z.string(),
  }),
]);

// serialize: a WorkflowEvent to its JSON string.
export function serializeEvent(event: WorkflowEvent): string {
  return JSON.stringify(event);
}

// deserialize: a JSON string back to a WorkflowEvent. Throws on
// invalid input — the caller is responsible for handling the
// error (transport-level retry, log-and-continue, etc.).
export function deserializeEvent(json: string): WorkflowEvent {
  const parsed = JSON.parse(json);
  return workflowEventSchema.parse(parsed) as WorkflowEvent;
}

// encodeSseEvent: format a WorkflowEvent as an SSE message.
// Server-Sent Events wire format is `event: <kind>\ndata: <json>\n\n`.
export function encodeSseEvent(event: WorkflowEvent): string {
  return `event: ${event.kind}\ndata: ${serializeEvent(event)}\n\n`;
}
