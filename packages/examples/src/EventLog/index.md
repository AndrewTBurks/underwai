---
title: "examples/EventLog"
type: module
parent: ../../index.md
principles: [experience-first, encode-lessons-in-structure, minimal-api-surface]
decisions:
  - id: DEC-EXAMPLES-005
    date: 2026-06-08
    author: agent
    summary: '`EventLog` displays the `WorkflowEvent` trail captured by `capture()`. The events array is stored in chronological order (oldest first, index 0 is the earliest); the display is also chronological (the user reads top to bottom in the order they happened). The first column shows a 1-based sequence number derived from the array position; the user reads #001 as the first event. (TASK-JF-5, .cns/plans/join-fixes/.)'
  - id: DEC-EXAMPLES-005a
    date: 2026-06-08
    author: agent
    summary: 'The sequence number is `(total - i)` padded to 3 digits: #001 is the latest event (i=total-1), the highest number is the earliest (i=0). This was a TASK-JF-5 fix: the previous wall-clock timestamp column had collisions because the runtime fires many `markRunning` / `markResolved` calls in the same tick (especially after TASK-JF-3''s event-driven dispatch). Sequence numbers are unique per event and match the consumer''s mental model.'
  - id: DEC-EXAMPLES-006
    date: 2026-06-08
    author: agent
    summary: '`capture(prev, next, prevState)` is a pure function that diffs `next` against `prevState` and appends new events to `prev`. It emits `node-added` for new nodes, `node-updated` for status or input changes, `node-removed` for removed nodes, `edge-added` for new edges, and `workflow-status` when the workflow status changes. The lib does not expose a `stateToEvents` utility; the shell synthesizes the diff.'
  - id: DEC-EXAMPLES-006a
    date: 2026-06-08
    author: agent
    summary: "The first column was narrowed from 90px to 50px to fit the 3-digit sequence numbers without truncation. The `event-log__time` CSS class is the only styling change beyond the format string."
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/EventLog

The event log panel. Displays the `WorkflowEvent` trail captured by `capture()` as the workflow runs. Each row shows: sequence number, event kind, and a detail (key + status, or key + value).

## What lives here

The source is `EventLog.tsx` next to this directory.

- **`EventLog({ events, lastEvent })`** — the component. Renders a vertical list of events. The `lastEvent` prop drives the flash animation on the newest row.
- **`formatIndex(i, total)`** — returns `#NNN` where `N = total - i`. The latest event is #001; the earliest is `#total`. (TASK-JF-5.)
- **`renderDetail(e)`** — for each `WorkflowEvent` kind, renders the appropriate detail (`{key} → {status}` for node events, `{from} → {to}` for edge events, `workflow → {status}` for workflow-status).
- **`capture(prev, next, prevState): WorkflowEvent[]`** — diffs `next` against `prevState`, appends new events to `prev`. Returns the new list with new events at the head (oldest events end up at the tail).
- **`serializeNode(n): SerializedNode`** — converts a `Node` to its wire-friendly form.

## Why sequence numbers

After TASK-JF-3 made the dispatch event-driven, the runtime fires many `markRunning` / `markResolved` calls in the same tick. Wall-clock timestamps collided. Sequence numbers are unique per event and match the consumer's mental model — the user reads "#001" as "the first event" at a glance, which is the top of the log.

## Boundary

- Imports from: `react` (peer, `useEffect`, `useRef`), `@underwai/core` (Node, WorkflowState, WorkflowStatus), `@underwai/transport` (WorkflowEvent, SerializedNode).
- Exports to: `ExampleShell.tsx` (uses `<EventLog>` in the right-bottom panel and calls `capture()` on every state change).
- **What does NOT live here:** the graph layout (in `Graph.tsx`), the rendered panel (in `RenderedPanel.tsx`), the human form (in `HumanForm.tsx`), the per-demo setup (in `workflows.ts`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
