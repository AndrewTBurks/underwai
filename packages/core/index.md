---
title: "@underwai/core"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, laziness-protocol]
links:
  - id: node
    path: .cns/architecture/node.md
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/core

The data structure. The foundation. No imports from `@underwai/schema` or `@underwai/runner` — those depend on this. This package depends on Zod (peer) and Effect (peer) only as far as it needs them for the composition API.

## What lives here

The pre-shard file plan (from `.cns/intent.md` Phase 2):

- `src/keys.ts` — `NodeKey<Path>`, brand, path template-literal. The branded key that rejects raw strings at the call site. The Path generic threads through the composition API so the consumer's `subscribe(state, ref.key, ...)` is type-checked against the ref's path. (TASK-I)
- `src/types.ts` — the data structure: `WorkflowState`, `Node` (a discriminated union on `Node["status"]`), `Edge`, `ResolvedInput`, `SerializedError`, `Actor`, `HumanMode`. (TASK-G, TASK-H, TASK-L, TASK-S)
- `src/composition.ts` — the only way to create nodes: `run`, `then` (two overloads: direct match and bridge function), `all` (array and object forms), `thenLoop` (family of nodes). (TASK-C, TASK-H, TASK-I, TASK-U)
- `src/operations.ts` — state derivations and mutations: `init`, `getNode`, `serialize`, `deserialize`, `findReadyNodes`, `findSubtree`, `publish`, `write`, `writeHumanInput`. Plus the `getHumanFields` and `getHumanInputDisplay` helpers. (TASK-F, TASK-K, TASK-O, TASK-R, TASK-S)
- `src/index.ts` — the public re-exports. The only file the consumer imports from.

The current pre-shard artifact lives at `src/stub.ts` — a single file with all the type definitions stubbed out (real implementation is Phase 2). The stub was moved here from the project root on 2026-06-06 when the pre-shard landed. Phase 2 distributes the stub's contents across `keys.ts`, `types.ts`, `composition.ts`, and `operations.ts`.

## Boundary

- **Imports from:** `zod` (peer), `effect` (peer, only in `composition.ts` and `operations.ts` where Effect types are used).
- **Exports to:** `@underwai/runner` (uses `WorkflowState`, `Node`, `Edge`, `ResolvedInput`, `NodeKey`, `Actor`, `HumanMode`, the composition API), `@underwai/transport` (v1.1+), `@underwai/renderer-react` (v1.1+), `@underwai/renderer-log` (v1.1+).
- **What does NOT live here:** the `z.human()` runtime (`@underwai/schema`), the Effect service and runner logic (`@underwai/runner`).

## Design decisions that govern this package

- **The data structure is the boundary.** Every value crossing the package boundary is validated against a Zod schema. Internal types are trusted within the package; external data (workflow state, effect programs, human inputs) is parsed at the edge.
- **The composition API is the only way to create nodes.** Consumers cannot add a node to the workflow by hand outside the composition API. The composition expression *is* the definition.
- **The Path generic is non-negotiable.** (TASK-I) Combinator signatures carry the path through end-to-end. The brand on `NodeKey` rejects raw strings; the path generic rejects "wrong node ref" at the call site.
- **`Node["status"]` is a discriminated union.** (TASK-G) Per-status data lives on the variants that own them. There is no top-level `output` or `finalOutput`; both are on the `streaming` and `resolved` variants.
- **`ResolvedInput` is a single value, not a per-field bundle.** (TASK-H) The composition API enforces shape match between parent's output and child's input.
- **`Edge = { from, to, bridge? }`.** (TASK-H) No `toField`. Bridges are an optional function on the Edge, applied by the runner at edge resolution.
- **No `topologicalOrder` field on `WorkflowState`.** (TASK-R) `findReadyNodes` returns in dependency order directly (Kahn's algorithm using `edgesByFrom`).
- **Derived fields are recomputed on `deserialize()`.** (TASK-F) The serialized form is the linear `edges` array; `edgesByTarget` and `edgesByFrom` are rebuilt. The serialization contract is in `docs/design.md`.

## Plan files that touch this package

- [`.cns/plans/TASK-A.md`](../../.cns/plans/TASK-A.md) — writeHumanInput race; the policy lives in `operations.ts`.
- [`.cns/plans/TASK-B.md`](../../.cns/plans/TASK-B.md) — `WorkflowRuntime` service is in `@underwai/runner`, but the data structure changes (single-fiber runner) live here.
- [`.cns/plans/TASK-C.md`](../../.cns/plans/TASK-C.md) — `subscribe` is in `@underwai/transport`; the `NodeKey<Path>` types it consumes live here.
- [`.cns/plans/TASK-F.md`](../../.cns/plans/TASK-F.md) — `edgesByTarget` and `edgesByFrom` live on `WorkflowState` (here).
- [`.cns/plans/TASK-G.md`](../../.cns/plans/TASK-G.md) — `Node["status"]` discriminated union (here).
- [`.cns/plans/TASK-H.md`](../../.cns/plans/TASK-H.md) — `ResolvedInput`, `Edge`, the composition API.
- [`.cns/plans/TASK-I.md`](../../.cns/plans/TASK-I.md) — `NodeKey<Path>` and the path-generic combinator signatures.
- [`.cns/plans/TASK-J.md`](../../.cns/plans/TASK-J.md) — folded into TASK-G (output/finalOutput on variants).
- [`.cns/plans/TASK-K.md`](../../.cns/plans/TASK-K.md) — folded into TASK-G (`getHumanFields` helper).
- [`.cns/plans/TASK-L.md`](../../.cns/plans/TASK-L.md) — `type Actor = string`.
- [`.cns/plans/TASK-O.md`](../../.cns/plans/TASK-O.md) — `findReadyNodes` returns `pending` OR `stale`; `paused` is NOT.
- [`.cns/plans/TASK-R.md`](../../.cns/plans/TASK-R.md) — `findReadyNodes` returns `ReadonlyArray<NodeKey>` in dependency order.
- [`.cns/plans/TASK-S.md`](../../.cns/plans/TASK-S.md) — `getHumanInputDisplay` returns a discriminated union on source kind.

## For the implementation phase

When Phase 2 starts, the agent reads this file, opens `src/stub.ts` (the pre-shard artifact with all the types stubbed out), and distributes the contents into the four `src/*` files. The stub has every type and function declaration in one place; the split is mechanical. The composability of the result is verified by `tsc --noEmit` and the per-package typecheck.

The data structure is small enough to fit in your head. The composition API is four combinators. The state machine is seven statuses. The runner is an Effect program that walks the DAG. Most of the implementation work is *verifying the design*, not building the design — the design is settled.
