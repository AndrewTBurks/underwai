// WebSocket transport tests. Mock WebSocket; verify the wire
// format and the parse roundtrip.
import { describe, expect, it } from "vitest";
import { WsClient, WsServer, type WsLike } from "./ws.js";
import { LiveSubscriptionRegistry, NodeKey, WorkflowId } from "@underwai/core";
import type { WorkflowState } from "@underwai/core";
import { z } from "zod";

function makeState(): WorkflowState {
  return {
    id: WorkflowId("wf-1"),
    defs: new Map(),
    version: 1,
    status: "running",
    nodes: new Map([
      [
        NodeKey("root"),
        {
          id: NodeKey("root"),
          kind: "root",
          inputSchema: z.unknown(),
          input: { value: "hello", schema: z.unknown(), humanFields: new Map() },
          outputSchema: z.unknown(),
          status: { kind: "resolved", finalOutput: "done", resolvedAt: "T" },
          actor: "system",
          createdAt: "T",
          updatedAt: "T",
        },
      ],
    ]),
    edges: [],
    edgesByTarget: new Map(),
    edgesByFrom: new Map(),
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("WsServer", () => {
  it("writes a JSON frame per node + a workflow-status frame on notify", () => {
    const registry = new LiveSubscriptionRegistry();
    const frames: string[] = [];
    const server = new WsServer();
    server.open(registry, (f) => frames.push(f));
    registry.notify(makeState());
    server.close(() => {});
    expect(frames.length).toBe(2);
    expect(JSON.parse(frames[0]!).kind).toBe("node-updated");
    expect(JSON.parse(frames[1]!).kind).toBe("workflow-status");
  });
});

describe("WsClient", () => {
  it("parses a WebSocket message into a WorkflowEvent", () => {
    const handlers: Record<string, (data: string) => void> = {};
    const ws: WsLike = {
      on: (event, cb) => {
        handlers[event] = cb;
      },
      send: () => {},
      close: () => {},
    };
    const client = new WsClient();
    client.parse(ws);
    const frame = JSON.stringify({
      kind: "node-updated",
      key: "root",
      node: {
        id: "root",
        kind: "root",
        status: { kind: "resolved", finalOutput: "done", resolvedAt: "T" },
        actor: "system",
        input: "hello",
        createdAt: "T",
        updatedAt: "T",
      },
      timestamp: "T",
    });
    handlers["message"]?.(frame);
    expect(client.events.length).toBe(1);
    expect(client.events[0]?.kind).toBe("node-updated");
  });

  it("write() sends a 'write' frame with the right wire shape", () => {
    // TASK-43: WsClient now has typed write and writeHumanInput
    // methods. Each sends a serialized WorkflowEvent frame
    // with the kind, key, value, and timestamp.
    const sent: string[] = [];
    const ws: WsLike = {
      on: () => {},
      send: (f) => sent.push(f),
      close: () => {},
    };
    const client = new WsClient();
    client.write(ws, NodeKey("root"), "injected");
    expect(sent.length).toBe(1);
    const frame = JSON.parse(sent[0]!);
    expect(frame.kind).toBe("write");
    expect(frame.key).toBe("root");
    expect(frame.value).toBe("injected");
    expect(typeof frame.timestamp).toBe("string");
  });

  it("writeHumanInput() sends a 'writeHumanInput' frame", () => {
    const sent: string[] = [];
    const ws: WsLike = {
      on: () => {},
      send: (f) => sent.push(f),
      close: () => {},
    };
    const client = new WsClient();
    client.writeHumanInput(ws, NodeKey("ask"), { name: "Alice" });
    expect(sent.length).toBe(1);
    const frame = JSON.parse(sent[0]!);
    expect(frame.kind).toBe("writeHumanInput");
    expect(frame.key).toBe("ask");
    expect(frame.value).toEqual({ name: "Alice" });
  });
});
