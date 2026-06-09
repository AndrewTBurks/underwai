---
title: "core/keys"
type: module
parent: ../../index.md
principles: [type-system-discipline, boundary-discipline]
decisions:
  - id: DEC-CORE-005
    date: 2026-06-06
    author: agent
    summary: 'Path generic on NodeKey<Path> is non-negotiable. Combinator signatures thread the path through end-to-end (TASK-I). Brand on NodeKey rejects raw strings; path generic rejects "wrong node ref."'
  - id: DEC-CORE-005a
    date: 2026-06-08
    author: agent
    summary: 'NodeKey is constructed via a factory `NodeKey<Path>(path: Path)` rather than a structural cast. The factory preserves the Path generic at the call site; a raw `as unknown as NodeKey<Path>` cast was tried first and rejected because it allows arbitrary strings to satisfy the brand (per principle-type-system-discipline, branded primitives that don''t fire are lies to the compiler). The factory is a one-line helper; the brand check is the runtime side of the compile-time brand.'
  - id: DEC-CORE-005b
    date: 2026-06-08
    author: agent
    summary: 'WorkflowId is a separate brand from NodeKey. Both are `string & { __brand: "..." }`, but the tags differ. NodeKey carries the Path generic; WorkflowId is unparameterized. The two types can never be confused at a call site that demands one of them, even though both are strings at runtime.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# core/src/keys

Branded primitive types: `NodeKey<Path>`, `WorkflowId`, `FieldKey`. The brand is structural (`__brand`) at the type level; the runtime representation is `string`. A consumer who tries to pass a raw string to a function expecting `NodeKey<Path>` gets a compile error.

## What lives here

The source is `keys.ts` next to this directory.

- `NodeKey<Path>` — the brand. Carries a `Path extends string` generic so the composition API's signatures (composition.ts) can thread the path end-to-end.
- `WorkflowId` — a workflow instance identifier. Distinct brand from NodeKey.
- `FieldKey` — an unbranded string for the field name inside a node's input. The lib treats the input as opaque at the field level (Zod handles the shape).
- `NodeKey(path: Path)` — the factory. Returns `path as unknown as NodeKey<Path>`. The cast is safe at the brand level; the factory is the single place the cast happens, not at every callsite.
- `WorkflowId(s: string)` — the factory for WorkflowId.

## Boundary

- Imports from: nothing (the only file in core with zero imports).
- Exports to: `types.ts` (re-exports for convenience), `composition.ts`, `operations.ts`, `live.ts`, every consumer package that holds a NodeKey-typed field.

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above. The brand is the only mechanism; the factories are the only safe construction path.
