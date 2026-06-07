---
title: "@underwai/core"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, laziness-protocol]
links:
  - id: node
    path: .cns/architecture/node.md
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
  - id: DEC-CORE-005
    date: 2026-06-06
    author: agent
    summary: 'Path generic on NodeKey<Path> is non-negotiable. Combinator signatures thread the path through end-to-end (TASK-I). Brand on NodeKey rejects raw strings; path generic rejects "wrong node ref."'
  - id: DEC-CORE-006
    date: 2026-06-06
    author: agent
    summary: 'findReadyNodes returns ReadonlyArray<NodeKey> in dependency order. Kahn''s algorithm using edgesByFrom. Iteration order is the contract. No topologicalOrder field on WorkflowState (TASK-R).'
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
    summary: 'getHumanInputDisplay(node, fieldKey) returns a discriminated union on source kind. No "proposed: boolean" flag — the lib exposes the source, the renderer decides UX (TASK-S, folded into TASK-G).'
  - id: DEC-CORE-011
    date: 2026-06-06
    author: agent
    summary: ResolvedInput.value is the current input value. Sourced from upstream.finalOutput (after any bridge transform), from a literal at the composition root, or from a human write via writeHumanInput. The composition API enforces shape match (TASK-H).
  - id: DEC-CORE-012
    date: 2026-06-06
    author: agent
    summary: 'Then combinator has two overloads: parent.then(child) for direct match (parent.output shape === child.input shape), parent.then((out) => in_, child) for bridge function. Bridge is composition metadata on the Edge, not a node (TASK-H).'
  - id: DEC-CORE-013
    date: 2026-06-06
    author: agent
    summary: Subscription methods (subscribe, subscribeSet) live in @underwai/transport, not in core. Core exposes the data structure and composition API only.
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/core

The data structure. The foundation. No imports from `@underwai/schema` or `@underwai/runner` — those depend on this. This package depends on Zod (peer) and Effect (peer) only as far as it needs them for the composition API.

## What lives here

The pre-shard file plan (from `.cns/intent.md` Phase 2):

- `src/keys.ts` — `NodeKey<Path>`, brand, path template-literal. The branded key that rejects raw strings at the call site. The Path generic threads through the composition API so the consumer's `subscribe(state, ref.key, ...)` is type-checked against the ref's path.
- `src/types.ts` — the data structure: `WorkflowState`, `Node` (a discriminated union on `Node["status"]`), `Edge`, `ResolvedInput`, `SerializedError`, `Actor`, `HumanMode`.
- `src/composition.ts` — the only way to create nodes: `run`, `then` (two overloads: direct match and bridge function), `all` (array and object forms), `thenLoop` (family of nodes).
- `src/operations.ts` — state derivations and mutations: `init`, `getNode`, `serialize`, `deserialize`, `findReadyNodes`, `findSubtree`, `publish`, `write`, `writeHumanInput`. Plus the `getHumanFields` and `getHumanInputDisplay` helpers.
- `src/index.ts` — the public re-exports. The only file the consumer imports from.

The current pre-shard artifact lives at `src/stub.ts` — a single file with all the type definitions stubbed out (real implementation is Phase 2). The stub was moved here from the project root on 2026-06-06 when the pre-shard landed. Phase 2 distributes the stub's contents across `keys.ts`, `types.ts`, `composition.ts`, and `operations.ts`.

## Boundary

- **Imports from:** `zod` (peer), `effect` (peer, only in `composition.ts` and `operations.ts` where Effect types are used).
- **Exports to:** `@underwai/runner` (uses `WorkflowState`, `Node`, `Edge`, `ResolvedInput`, `NodeKey`, `Actor`, `HumanMode`, the composition API), `@underwai/transport` (subscription and wire format), `@underwai/renderer-react` (registry + auto-render), `@underwai/renderer-log` (registry).
- **What does NOT live here:** the `z.human()` runtime (`@underwai/schema`), the Effect service and runner logic (`@underwai/runner`), the subscription API and transports (`@underwai/transport`).

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `src/stub.ts` (the pre-shard artifact with all the types stubbed out), and distributes the contents into the four `src/*` files. The stub has every type and function declaration in one place; the split is mechanical. The composability of the result is verified by `tsc -b` and the per-package typecheck.

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the type shapes, the composition API, and the serialization contract. Prose in the body is for the file plan and the boundary; the *why* lives in the decisions array.

The data structure is small enough to fit in your head. The composition API is four combinators. The state machine is seven statuses. The runner is an Effect program that walks the DAG. Most of the implementation work is *verifying the design*, not building the design — the design is settled.
