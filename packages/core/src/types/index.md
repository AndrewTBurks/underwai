---
title: "core/types"
type: module
parent: ../../index.md
principles: [type-system-discipline, boundary-discipline, exhaust-the-design-space]
decisions:
  - id: DEC-CORE-001
    date: 2026-06-06
    author: agent
    summary: 'Node["status"] is a discriminated union. Per-status data lives on the variants that own them (TASK-G). Folds TASK-G, TASK-J, TASK-K, TASK-S.'
  - id: DEC-CORE-002
    date: 2026-06-06
    author: agent
    summary: ResolvedInput = { value, schema, humanFields }. Single value, not a per-field bundle (TASK-H).
  - id: DEC-CORE-003
    date: 2026-06-06
    author: agent
    summary: Edge = { from, to, bridge? }. No toField. Bridges are an optional function on the edge, applied by the runner at edge resolution (TASK-H).
  - id: DEC-CORE-008
    date: 2026-06-06
    author: agent
    summary: 'type Actor = string. Half-brand on the closed union was confusing. Document the convention: "system" for the lib''s own operations, "human" for human-driven, any other string for consumer-defined roles (TASK-L).'
  - id: DEC-CORE-007
    date: 2026-06-06
    author: agent
    summary: Derived fields (edgesByTarget, edgesByFrom) are recomputed on deserialize(). Serialized form is the linear edges array. The serialization contract is in docs/design.md (TASK-F).
  - id: DEC-CORE-001a
    date: 2026-06-08
    author: agent
    summary: 'NodeStatus has 7 variants: pending, running, streaming, resolved, failed, paused, stale. WorkflowStatus has 4 variants: pending, running, completed, failed. The two are distinct: a node can be in any NodeStatus; a workflow''s status is the aggregate (a workflow is "running" while at least one node is in running/streaming/paused/stale). The seven-status state machine is the source of truth; see .cns/architecture/node.md for the per-status semantics and valid transitions.'
  - id: DEC-CORE-001b
    date: 2026-06-08
    author: agent
    summary: 'Storage shape is Map<NodeKey, ...> end-to-end. The NodeKey brand is preserved because Map keys accept any branded type. Records can''t enforce branded keys and force `as unknown as string` casts at every read site (per principle-type-system-discipline, branded primitives that don''t fire are lies to the compiler). The serialized form is JSON-compatible arrays of [key, value] tuples; deserialize() rebuilds the Maps.'
  - id: DEC-CORE-001c
    date: 2026-06-08
    author: agent
    summary: 'HumanInputDisplay is a discriminated union on source: literal / from_node / human (with status pending | set). No verified+locked case — verified human-marked fields with a value are constants; the value is locked in, no human UI needed. The lib exposes the source; the renderer decides UX. (See DEC-CORE-017 for the implementation in operations.ts.)'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# core/src/types

The data structure. The shape is locked in the design phase; this module is the source of truth for the runtime types. The canonical per-status semantics live in `.cns/architecture/node.md`; see that file for the rationale and the valid state transitions.

## What lives here

The source is `types.ts` next to this directory.

- **`NodeStatus`** — discriminated union (7 variants). Per-status data lives on the variants that own them. There is no top-level `output` or `finalOutput`; both are on the `streaming` and `resolved` variants. Illegal states are unrepresentable at the type level.
- **`WorkflowStatus`** — `"pending" | "running" | "completed" | "failed"`. Distinct from NodeStatus; aggregate of the workflow's nodes.
- **`HumanInputDisplay`** — discriminated union on source: literal / from_node / human. The renderer reads this to decide UX.
- **`ResolvedInput`** — `{ value, schema, humanFields }`. Single value, not a per-field bundle.
- **`Edge`** — `{ from, to, bridge? }`. No `toField`. Bridges are an optional function on the edge, applied by the runner at edge resolution.
- **`Node`**, **`WorkflowState`**, **`SerializedState`**, **`SerializedError`**, **`Actor`**, **`HumanMode`** (re-exported from `@underwai/schema`).
- **`CompositionTree`**, **`NodeDefinition`**, **`NodeRef`** — the composition-side types used by `composition.ts`.

## Boundary

- Imports from: `effect` (peer, type-only for `Effect` reference on `NodeStatus`-adjacent types), `zod` (peer, type-only for `ZodTypeAny`).
- Exports to: every other core module, every package in the workspace. This is the central type module.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape every other file in the workspace.
