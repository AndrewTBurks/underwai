// EventLog — the list of WorkflowEvent that the runtime
// emitted during the run.
//
// The transport layer's WorkflowEvent is the wire format;
// the lib doesn't expose a stateToEvents utility (that
// would couple the lib to a specific view of "what
// happened"). The shell synthesizes events from the state
// by diffing successive state snapshots: for each new
// snapshot, emit a `node-updated` for every node whose
// status or input changed, plus a `workflow-status` event
// when the workflow status changes. This matches the
// transport's `stateToEvents()` semantics closely enough
// for a debug view.

import { useEffect, useRef } from "react";
import type { Node, WorkflowState, WorkflowStatus } from "@underwai/core";
import type { WorkflowEvent, SerializedNode } from "@underwai/transport";

export function EventLog({
  events,
  lastEvent,
}: {
  events: WorkflowEvent[];
  lastEvent: WorkflowEvent | null;
}) {
  const lastKeyRef = useRef<number | null>(null);

  // Re-key on the last event for the flash animation.
  useEffect(() => {
    if (lastEvent) lastKeyRef.current = events.indexOf(lastEvent);
  }, [lastEvent, events]);

  if (events.length === 0) {
    return <div className="event-log__empty">no events yet</div>;
  }

  return (
    <div className="event-log">
      {events.map((e, i) => {
        const isNew = i === lastKeyRef.current;
        return (
          <div
            key={i}
            className={`event-log__row${isNew ? " event-log__row--new" : ""}`}
          >
            <span className="event-log__time">{formatIndex(i, events.length)}</span>
            <span className={`event-log__kind event-log__kind--${e.kind}`}>
              {e.kind}
              {renderStatusKind(e)}
            </span>
            <span className="event-log__detail">
              {renderDetail(e)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// formatIndex: the event's 1-based sequence number. The
// events array is stored in chronological order (oldest
// first, index 0 is the earliest event), but it renders
// in the order it was captured — which is the same as
// array order. We display the index as (length - i) so
// the LATEST event shows #001 and the earliest shows
// the highest number. This way the user can see "the
// first event" at a glance — it's the one with #001 at
// the top, matching the consumer's mental model of a
// "latest first" log.
//
// The "same timestamp" issue is solved by this — each
// event has a unique sequence number, regardless of how
// close they fire in wall-clock time.
function formatIndex(i: number, total: number): string {
  const n = total - i;
  return `#${String(n).padStart(3, "0")}`;
}

function renderDetail(e: WorkflowEvent): React.ReactNode {
  switch (e.kind) {
    case "node-updated":
    case "node-added":
      return (
        <>
          <span className="event-log__detail-key">{e.key}</span>
          {" → "}
          {renderStatus(e.node)}
        </>
      );
    case "node-removed":
      return <span className="event-log__detail-key">{e.key}</span>;
    case "edge-added":
    case "edge-removed":
      return (
        <>
          <span className="event-log__detail-key">{e.from}</span>
          {" → "}
          <span className="event-log__detail-key">{e.to}</span>
        </>
      );
    case "workflow-status":
      return <>workflow → {e.status}</>;
  }
}

function renderStatusKind(e: WorkflowEvent): React.ReactNode {
  if (e.kind !== "node-updated" && e.kind !== "node-added") return null;
  return (
    <span
      className={`event-log__status event-log__status--${e.node.status.kind}`}
    >
      {e.node.status.kind}
    </span>
  );
}

function renderStatus(n: SerializedNode): React.ReactNode {
  const status = n.status;
  switch (status.kind) {
    case "resolved":
      return (
        <>
          resolved
          {" = "}
          {summarizeValue(status.finalOutput)}
        </>
      );
    case "running":
      return <>running</>;
    case "pending":
      return <>pending</>;
    case "failed":
      return <>failed: {summarizeValue(status.error)}</>;
    case "streaming":
      return (
        <>
          streaming
          {" = "}
          {summarizeValue(status.output)}
        </>
      );
    case "stale":
      return <>stale</>;
    case "paused":
      return <>paused</>;
  }
}

function summarizeValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") {
    const s = v.length > 40 ? v.slice(0, 37) + "…" : v;
    return JSON.stringify(s);
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + "…" : s;
  } catch {
    return "<unserializable>";
  }
}

// capture(): diff the new state against the previous one,
// append new events. Idempotent on the previous event list.
export function capture(
  prev: WorkflowEvent[],
  next: WorkflowState,
  prevState: WorkflowState | null,
): WorkflowEvent[] {
  const ts = next.updatedAt;
  const out: WorkflowEvent[] = [];
  const nextByKey = new Map<string, Node>();
  for (const n of next.nodes.values()) {
    nextByKey.set(n.id as unknown as string, n);
  }
  const prevByKey = new Map<string, Node>();
  if (prevState) {
    for (const n of prevState.nodes.values()) {
      prevByKey.set(n.id as unknown as string, n);
    }
  }
  // node-updated / node-added
  for (const [key, node] of nextByKey) {
    const was = prevByKey.get(key);
    if (!was) {
      out.push({
        kind: "node-added",
        key,
        node: serializeNode(node),
        timestamp: ts,
      });
    } else if (nodeStatusChanged(was, node) || nodeInputChanged(was, node)) {
      out.push({
        kind: "node-updated",
        key,
        node: serializeNode(node),
        timestamp: ts,
      });
    }
  }
  // node-removed (if any in prev is not in next)
  for (const [key] of prevByKey) {
    if (!nextByKey.has(key)) {
      out.push({ kind: "node-removed", key, timestamp: ts });
    }
  }
  // edge-added (compare edge lists)
  const prevEdges = new Set(
    prevState?.edges.map(
      (e) => `${e.from as unknown as string}|${e.to as unknown as string}`,
    ) ?? [],
  );
  for (const e of next.edges) {
    const sig = `${e.from as unknown as string}|${e.to as unknown as string}`;
    if (!prevEdges.has(sig)) {
      out.push({
        kind: "edge-added",
        from: e.from as unknown as string,
        to: e.to as unknown as string,
        timestamp: ts,
      });
    }
  }
  // workflow-status
  if (!prevState || prevState.status !== next.status) {
    out.push({
      kind: "workflow-status",
      status: next.status as WorkflowStatus,
      timestamp: ts,
    });
  }
  return [...out, ...prev];
}

function nodeStatusChanged(a: Node, b: Node): boolean {
  return a.status.kind !== b.status.kind;
}

function nodeInputChanged(a: Node, b: Node): boolean {
  return a.input.value !== b.input.value;
}

function serializeNode(n: Node): SerializedNode {
  return {
    id: n.id as unknown as string,
    kind: n.kind,
    status: n.status,
    actor: n.actor,
    input: n.input.value,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}
