---
title: "core/composition"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, minimal-api-surface]
decisions:
  - id: DEC-CORE-004
    date: 2026-06-06
    author: agent
    summary: Composition API is the only way to create nodes. The composition expression *is* the definition.
  - id: DEC-CORE-012
    date: 2026-06-06
    author: agent
    summary: "The `chain` combinator has two overloads: parent.chain(child) for direct match (parent.output shape === child.input shape), parent.chain((out) => in_, child) for bridge function. Bridge is composition metadata on the Edge, not a node (TASK-H)."
  - id: DEC-CORE-014
    date: 2026-06-06
    author: agent
    summary: 'The combinator is named `chain`, not `then`. `then` collides with the ESM module namespace''s thenable hook — vitest/Vite 8 invokes the exported `then` as a Promise resolver during module load, which throws "not implemented" and hangs the test. The pre-shard stub used `then`; the runtime name diverges. The semantics are unchanged: chain(parent, child) returns a NodeRef with the child''s path. Design-rationale: never name an export `then` in an ESM module.'
  - id: DEC-CORE-015
    date: 2026-06-07
    author: agent
    summary: "`compose(fn)` wraps a composition expression to capture the defs and edges. Inside the wrapper, run/chain/all/thenLoop record into a per-compose Builder. The result is a CompositionTree (root + defs + edges) that init() walks to build a WorkflowState. The implementation uses a module-level currentBuilder reference (the legacy-context pattern). Compositions written outside compose() still work — they just don't record."
  - id: DEC-CORE-004a
    date: 2026-06-08
    author: agent
    summary: 'The legacy compose/run/chain/all free functions were removed (TASK-40). The migration shape is: consumers use the typed builder `workflow().run(node(...)).chain(...)` to build a tree; `build()` produces a `CompositionTree`. Compositions written outside `workflow()` do not record into a builder — this is a v1.0 simplification. (TASK-40 follow-up; pre-shard stub kept compose/run/chain as parallel APIs; the runtime now has a single path.)'
  - id: DEC-CORE-004b
    date: 2026-06-08
    author: agent
    summary: '`node({ kind, schema, program, ... })` is the factory for a NodeDefinition. The factory infers TIn and TOut from the Zod schema; the program signature is `(input: TIn) => Effect<TOut, ...>`. The typed view method on a built tree reads a node by key with the declared output type. End-to-end typing from the composition site through the consumer''s program. No `as never` or `as unknown as` casts in well-formed example workflows.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# core/src/composition

The composition API. The only way to create nodes — the composition expression _is_ the definition. Public shape is the typed builder: `workflow().run(node(...)).chain(...).build()`. The legacy `compose`/`run`/`chain` free functions were removed in TASK-40.

## What lives here

The source is `composition.ts` next to this directory.

- **`workflow()`** — the builder factory. Returns a `WorkflowBuilder` with `.run`, `.chain`, `.all`, `.thenLoop` methods.
- **`node({ kind, schema, program })`** — the `NodeDefinition` factory. TIn/TOut are derived from the Zod schemas; the program signature is end-to-end typed.
- **`.chain()`** — two overloads: direct match (parent.output shape === child.input shape) and bridge function `(out) => in_`. Bridge is composition metadata on the Edge, not a node.
- **`.all({...})`** — parallel branches. Object form keyed by branch name; produces one NodeDefinition per key.
- **`.thenLoop({...})`** — a family of nodes (an N-element list that resolves to a final value at runtime).
- **`.build()`** — produces a `CompositionTree` (root + defs + edges).
- **`view(tree, key)`** — read a node by key with the declared output type.

## Boundary

- Imports from: `effect` (peer, type-only for `Effect`), `zod` (peer), `./keys.js` (NodeKey, NodeKey factory), `./types.js` (CompositionTree, NodeDefinition, NodeRef).
- Exports to: `operations.ts` (calls `init(tree, id)` to build a WorkflowState), the rest of the workspace that wants to build a tree.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the entire creation-side of the lib.
