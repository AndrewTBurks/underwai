// @underwai/transport — transports/sse.ts
//
// Server-Sent Events transport. The wire format is one SSE
// message per WorkflowEvent. The server wraps a workflow state
// stream; the client parses with EventSource.
//
// v1.0 shape:
//   - SseServer.open(state, sink): subscribes to the workflow
//     and writes each event to the sink.
//   - SseClient.parse(stream): parses an SSE stream into a
//     sequence of WorkflowEvents.
//
// The structure is real; tests use a mock sink/stream.
import type { LiveSubscriptionRegistry, WorkflowState } from "@underwai/core"
import { encodeSseEvent, type WorkflowEvent } from "../event-stream.js"

export type SseSink = {
  write: (chunk: string) => void
  close: () => void
}

export class SseServer {
  private unsubscribe: (() => void) | null = null

  open(registry: LiveSubscriptionRegistry, sink: SseSink): void {
    this.unsubscribe = registry.registerPattern("*", (state) => {
      const events = stateToEvents(state)
      for (const e of events) {
        sink.write(encodeSseEvent(e))
      }
    })
  }

  close(sink: SseSink): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    sink.close()
  }
}

// stateToEvents: derive a sequence of WorkflowEvents from a
// WorkflowState. For v1.0 we emit one node-updated event per
// node and one workflow-status event. More granular diffs are
// a v1.1 follow-up.
function stateToEvents(state: WorkflowState): WorkflowEvent[] {
  const events: WorkflowEvent[] = []
  const timestamp = state.updatedAt
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
    })
  }
  events.push({ kind: "workflow-status", status: state.status, timestamp })
  return events
}

export type SseEventStream = AsyncIterable<string>

export class SseClient {
  async *parse(stream: SseEventStream): AsyncIterable<WorkflowEvent> {
    for await (const chunk of stream) {
      // Each SSE message is `event: <kind>\ndata: <json>\n\n`.
      // We parse the data line, deserialize, and yield.
      const lines = chunk.split("\n")
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.slice("data: ".length)
          const { deserializeEvent } = await import("../event-stream.js")
          yield deserializeEvent(json)
        }
      }
    }
  }
}
