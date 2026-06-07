// SSE transport tests. Mock the sink/stream; verify the wire
// format and the parse roundtrip.
import { describe, expect, it } from "vitest";
import { SseClient, SseServer, type SseSink } from "./sse.js";
import { LiveSubscriptionRegistry, NodeKey, WorkflowId } from "@underwai/core";
import type { WorkflowState } from "@underwai/core";
import { z } from "zod";

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
  };
}

describe("SseServer", () => {
  it("writes an SSE message per node + a workflow-status event on notify", () => {
    const registry = new LiveSubscriptionRegistry();
    const chunks: string[] = [];
    const sink: SseSink = {
      write: (c) => chunks.push(c),
      close: () => {},
    };
    const server = new SseServer();
    server.open(registry, sink);
    registry.notify(makeState());
    server.close(sink);
    // 1 node + 1 workflow-status = 2 SSE messages.
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.startsWith("event: node-updated\n")).toBe(true);
    expect(chunks[1]?.startsWith("event: workflow-status\n")).toBe(true);
  });
});

describe("SseClient", () => {
  it("parses a single SSE chunk into a WorkflowEvent", async () => {
    const chunk =
      'event: node-updated\ndata: {"kind":"node-updated","key":"root","node":{"id":"root","kind":"root","status":{"kind":"resolved","finalOutput":"done","resolvedAt":"T"},"actor":"system","input":"hello","createdAt":"T","updatedAt":"T"},"timestamp":"T"}\n\n';
    async function* stream() {
      yield chunk;
    }
    const client = new SseClient();
    const events: unknown[] = [];
    for await (const e of client.parse(stream())) events.push(e);
    expect(events.length).toBe(1);
    expect((events[0] as { kind: string }).kind).toBe("node-updated");
  });
});
