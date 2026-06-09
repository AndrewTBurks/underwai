---
title: "core/operations"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, encode-lessons-in-structure]
decisions:
  - id: DEC-CORE-006
    date: 2026-06-06
    author: agent
    summary: "findReadyNodes returns ReadonlyArray<NodeKey> in dependency order. Kahn's algorithm using edgesByFrom. Iteration order is the contract. No topologicalOrder field on WorkflowState (TASK-R)."
  - id: DEC-CORE-009
    date: 2026-06-06
    author: agent
    summary: getHumanFields(node) reads the schema on demand. No humanFields cache on Node. The helper walks inputSchema and returns the human-mode map (TASK-K, folded into TASK-G).
  - id: DEC-CORE-011
    date: 2026-06-06
    author: agent
    summary: ResolvedInput.value is the current input value. Sourced from upstream.finalOutput (after any bridge transform), from a literal at the composition root, or from a human write via writeHumanInput. The composition API enforces shape match (TASK-H).
  - id: DEC-CORE-013
    date: 2026-06-06
    author: agent
    summary: Subscription methods (subscribe, subscribeSet) live in @underwai/transport, not in core. Core exposes the data structure and composition API only.
  - id: DEC-CORE-016
    date: 2026-06-07
    author: agent
    summary: "`init(tree, id)` is the public WorkflowState builder. Walks CompositionTree.defs, creates a Node for each (status=pending), applies edges (with bridges), and computes edgesByTarget and edgesByFrom. Replaces the pre-shard stub."
  - id: DEC-CORE-017
    date: 2026-06-07
    author: agent
    summary: "`getHumanInputDisplay(state, node, fieldKey)` returns a discriminated union on source kind: literal (root, no incoming edge, or human-marked+verified+value), from_node (incoming edge from a resolved upstream), human (writeable+pending or writeable+set). Renderer decides UX. Replaces the pre-shard stub. Signature changed: takes state in addition to node, so the function can read edgesByTarget."
  - id: DEC-CORE-018
    date: 2026-06-07
    author: agent
    summary: "@underwai/core has no mutation primitives. The runner is the only mutator; core is a pure data + composition layer. The previously-public publish/write in core were deleted; the runner's WorkflowRuntime service is the canonical state-mutation API (TASK-38)."
  - id: DEC-CORE-020
    date: 2026-06-08
    author: agent
    summary: '`topologicalLevels(state): ReadonlyArray<ReadonlyArray<NodeKey>>` assigns each node a level equal to the longest path from any root. Roots (no incoming edges) are level 0. Siblings at the same level are sorted by NodeKey string compare. Returns a 2-D array: outer index = level, inner = nodes at that level in deterministic order. Used by the example panel to render in DAG order (TASK-JF-1, .cns/plans/join-fixes/phase-1-topological-render.md).'
  - id: DEC-CORE-006a
    date: 2026-06-08
    author: agent
    summary: '`resolveInput(state, key)` is the public bridge-resolution helper. Walks `state.edgesByTarget[key]`, looks up each upstream''s `finalOutput` (if `resolved`), applies the `Edge.bridge` if present, and returns the transformed value as a `ResolvedInput`. The runner calls this in its dispatch loop; the helper is exported so consumers (and tests) can exercise the transform without going through the runtime.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# core/src/operations

State derivations on a `WorkflowState`. The composition API (`composition.ts`) describes the DAG shape; this module acts on a constructed state. Pure functions in, derived data out. No mutations live here (TASK-38).

## What lives here

The source is `operations.ts` next to this directory.

- **`init(tree, id)`** — build a `WorkflowState` from a `CompositionTree`. Walks `tree.defs`, creates a `Node` for each (status=`pending`), applies edges (with bridges), and computes `edgesByTarget` and `edgesByFrom`.
- **`getNode(state, key)`** — read a single node.
- **`serialize(state)`** / **`deserialize(serialized)`** — Maps to JSON-compatible arrays and back. `edgesByTarget` / `edgesByFrom` are recomputed on `deserialize()`.
- **`findReadyNodes(state)`** — Kahn's algorithm using `edgesByFrom`. Returns `ReadonlyArray<NodeKey>` in dependency order. Iteration order is the contract.
- **`findSubtree(state, rootKey)`** — the set of nodes reachable from `rootKey` (used by `useSubtree` in the React renderer).
- **`resolveInput(state, key)`** — bridge-transformed upstream output for a node. Used by the runner.
- **`topologicalLevels(state)`** — assigns each node a level = longest path from any root. Returns `ReadonlyArray<ReadonlyArray<NodeKey>>` (2-D: outer = level, inner = nodes at that level in deterministic order). Used by the example panel.
- **`getHumanFields(node)`** — reads the schema on demand. Returns the human-mode map for the node's input fields.
- **`getHumanInputDisplay(state, node, fieldKey)`** — discriminated union on source kind: literal / from_node / human. The renderer reads this to decide UX.

## Boundary

- Imports from: `effect` (peer), `zod` (peer), `@underwai/schema` (peer, for `getHumanMode`), `./keys.js`, `./composition.js`, `./types.js`, `./live.js` (the `LiveSubscriptionRegistry` is referenced in some helpers; operations itself is pure).
- Exports to: every other core module, the runner (`@underwai/runner`), the renderers (`@underwai/renderer-react`, `@underwai/renderer-log`), the transport (`@underwai/transport`).
- **What does NOT live here:** mutations. Core has no `publish` / `write` / `writeHumanInput` — those live in the runner. (TASK-38.)

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
