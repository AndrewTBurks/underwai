---
title: "@underwai/core"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, laziness-protocol]
links:
  - id: node
    path: .cns/architecture/node.md
  - id: core-keys
    path: packages/core/src/keys/index.md
  - id: core-types
    path: packages/core/src/types/index.md
  - id: core-composition
    path: packages/core/src/composition/index.md
  - id: core-operations
    path: packages/core/src/operations/index.md
  - id: core-live
    path: packages/core/src/live/index.md
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
  - id: DEC-CORE-004
    date: 2026-06-06
    author: agent
    summary: Composition API is the only way to create nodes. The composition expression *is* the definition.
  - id: DEC-CORE-014
    date: 2026-06-07
    author: agent
    summary: 'The combinator is named `chain`, not `then`. `then` collides with the ESM module namespace''s thenable hook — vitest/Vite 8 invokes the exported `then` as a Promise resolver during module load, which throws "not implemented" and hangs the test. The pre-shard stub used `then`; the runtime name diverges. The semantics are unchanged: chain(parent, child) returns a NodeRef with the child''s path. Design-rationale: never name an export `then` in an ESM module.'
  - id: DEC-CORE-015
    date: 2026-06-07
    author: agent
    summary: "`compose(fn)` wraps a composition expression to capture the defs and edges. Inside the wrapper, run/chain/all/thenLoop record into a per-compose Builder. The result is a CompositionTree (root + defs + edges) that init() walks to build a WorkflowState. The implementation uses a module-level currentBuilder reference (the legacy-context pattern). Compositions written outside compose() still work — they just don't record."
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
  - id: DEC-CORE-005
    date: 2026-06-06
    author: agent
    summary: 'Path generic on NodeKey<Path> is non-negotiable. Combinator signatures thread the path through end-to-end (TASK-I). Brand on NodeKey rejects raw strings; path generic rejects "wrong node ref."'
  - id: DEC-CORE-006
    date: 2026-06-06
    author: agent
    summary: "findReadyNodes returns ReadonlyArray<NodeKey> in dependency order. Kahn's algorithm using edgesByFrom. Iteration order is the contract. No topologicalOrder field on WorkflowState (TASK-R)."
  - id: DEC-CORE-007
    date: 2026-06-06
    author: agent
    summary: Derived fields (edgesByTarget, edgesByFrom) are recomputed on deserialize(). Serialized form is the linear edges array. The serialization contract is in docs/design.md (TASK-F).
  - id: DEC-CORE-008
    date: 2026-06-06
    author: agent
    summary: 'type Actor = string. Half-brand on the closed union was confusing. Document the convention: "system" for the lib''s own operations, "human" for human-driven, any other string for consumer-defined roles (TASK-L).'
  - id: DEC-CORE-009
    date: 2026-06-06
    author: agent
    summary: getHumanFields(node) reads the schema on demand. No humanFields cache on Node. The helper walks inputSchema and returns the human-mode map (TASK-K, folded into TASK-G).
  - id: DEC-CORE-010
    date: 2026-06-06
    author: agent
    summary: 'getHumanInputDisplay(state, node, fieldKey) returns a discriminated union on source kind: literal / from_node / human. The human variant has status: "pending" | "set" but no verified+locked case — verified human-marked fields with a value are constants, the value is locked in, no human UI needed. The lib exposes the source; the renderer decides UX (TASK-S, folded into TASK-G).'
  - id: DEC-CORE-011
    date: 2026-06-06
    author: agent
    summary: ResolvedInput.value is the current input value. Sourced from upstream.finalOutput (after any bridge transform), from a literal at the composition root, or from a human write via writeHumanInput. The composition API enforces shape match (TASK-H).
  - id: DEC-CORE-012
    date: 2026-06-06
    author: agent
    summary: "The `chain` combinator has two overloads: parent.chain(child) for direct match (parent.output shape === child.input shape), parent.chain((out) => in_, child) for bridge function. Bridge is composition metadata on the Edge, not a node (TASK-H)."
  - id: DEC-CORE-013
    date: 2026-06-06
    author: agent
    summary: Subscription methods (subscribe, subscribeSet) live in @underwai/transport, not in core. Core exposes the data structure and composition API only.
human_notes: |

status: clean
last_reconciled: 2026-06-11
---

# @underwai/core

The data structure and composition layer. Core owns the branded keys, the workflow state shape, the typed composition builder, pure state derivations, and the minimal in-process live registry. The runner is the only mutator; core exposes values and helpers, not runtime side effects.

## What lives here

- `src/keys.ts` — `NodeKey<Path>`, the brand, and the path template helper.
- `src/types.ts` — `WorkflowState`, `NodeStatus`, `WorkflowStatus`, `Node`, `Edge`, `ResolvedInput`, `HumanInputDisplay`, serialized forms, `Actor`, and `HumanMode`.
- `src/composition.ts` — `workflow()`, `node()`, builder `.run`, `.chain`, `.all`, `.thenLoop`, `.build`, and typed `view` helpers. The legacy free-function creation path is gone.
- `src/operations.ts` — pure state derivations: `init`, `getNode`, `serialize`, `deserialize`, `findReadyNodes`, `findSubtree`, `resolveInput`, `topologicalLevels`, `getHumanFields`, and `getHumanInputDisplay`.
- `src/live.ts` — `LiveSubscriptionRegistry`, the small fan-out primitive shared by runner, transport, and renderer-react.
- `src/index.ts` — public re-exports.

## Boundary

- **Imports from:** `zod` and `effect` as peers where needed; current code also imports `@underwai/schema` for `HumanMode` and `getHumanMode`. TASK-48 tracks the package-boundary follow-up that will either make this dependency official or move human schema inspection out of core.
- **Exports to:** `@underwai/runner`, `@underwai/transport`, `@underwai/renderer-react`, `@underwai/renderer-log`, and `@underwai/examples`.
- **What does NOT live here:** runtime mutation methods (`publish`, `write`, `writeHumanInput`) and the Effect service. Those live in `@underwai/runner`. Protocol-specific subscription and wire transport live in `@underwai/transport`.

The completed Phase 1, Phase 2, audit-closing, and join-fix intent items have been sharded into the module nodes linked above. The package-level decisions summarize only the load-bearing package contract; module-specific details live in the corresponding `src/*/index.md` files.
