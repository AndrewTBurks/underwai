// event-stream tests. Round-trip serialize/deserialize; SSE format.
import { describe, expect, it } from "vitest"
import {
  deserializeEvent,
  encodeSseEvent,
  serializeEvent,
  type WorkflowEvent,
} from "./event-stream.js"

const sample: WorkflowEvent = {
  kind: "node-updated",
  key: "root",
  node: {
    id: "root",
    kind: "root",
    status: { kind: "resolved", finalOutput: "done", resolvedAt: "T1" },
    actor: "system",
    input: "hello",
    output: "done",
    createdAt: "T0",
    updatedAt: "T1",
  },
  timestamp: "T1",
}

describe("event-stream", () => {
  it("round-trips a WorkflowEvent through serialize/deserialize", () => {
    const json = serializeEvent(sample)
    const restored = deserializeEvent(json)
    expect(restored.kind).toBe("node-updated")
    if (restored.kind === "node-updated" || restored.kind === "node-added") {
      expect(restored.key).toBe("root")
    }
  })

  it("encodes to SSE format with event: and data: lines", () => {
    const sse = encodeSseEvent(sample)
    expect(sse).toMatch(/^event: node-updated\n/)
    expect(sse).toMatch(/\ndata: \{/)
    expect(sse.endsWith("\n\n")).toBe(true)
  })

  it("rejects malformed input on deserialize", () => {
    expect(() => deserializeEvent("not json")).toThrow()
    expect(() => deserializeEvent(JSON.stringify({ kind: "unknown" }))).toThrow()
  })
})
