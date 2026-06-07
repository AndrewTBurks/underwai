// WebSocket transport tests. Mock WebSocket; verify the wire
// format and the parse roundtrip.
import { describe, expect, it } from "vitest"
import { WsClient, WsServer, type WsLike } from "./ws.js"
import { LiveSubscriptionRegistry, NodeKey, WorkflowId } from "@underwai/core"
import type { WorkflowState } from "@underwai/core"
import { z } from "zod"

function makeState(): WorkflowState {
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: {
      root: {
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
    },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "T",
    updatedAt: "T",
  }
}

describe("WsServer", () => {
  it("writes a JSON frame per node + a workflow-status frame on notify", () => {
    const registry = new LiveSubscriptionRegistry()
    const frames: string[] = []
    const server = new WsServer()
    server.open(registry, (f) => frames.push(f))
    registry.notify(makeState())
    server.close(() => {})
    expect(frames.length).toBe(2)
    expect(JSON.parse(frames[0]!).kind).toBe("node-updated")
    expect(JSON.parse(frames[1]!).kind).toBe("workflow-status")
  })
})

describe("WsClient", () => {
  it("parses a WebSocket message into a WorkflowEvent", () => {
    const handlers: Record<string, (data: string) => void> = {}
    const ws: WsLike = {
      on: (event, cb) => {
        handlers[event] = cb
      },
      send: () => {},
      close: () => {},
    }
    const client = new WsClient()
    client.parse(ws)
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
    })
    handlers["message"]?.(frame)
    expect(client.events.length).toBe(1)
    expect(client.events[0]?.kind).toBe("node-updated")
  })
})
