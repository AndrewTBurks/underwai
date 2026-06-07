---
title: "@underwai/schema"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, encode-lessons-in-structure]
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/schema

The Zod extension. `z.human()` flags a schema as human-writable; `.verified()` is a decorator that gates on human confirmation. Standalone — depends on Zod only, not on `@underwai/core`.

## What lives here

The pre-shard file plan:

- `src/index.ts` — the public entry. Re-exports `z.human`, `.verified`, `HumanMode`, `getHumanMode`. The only file the consumer imports from.
- `src/human.ts` — `z.human()` runtime: clones the input schema, mutates `_def.humanMode` to attach the marker. (TASK-E)
- `src/verified.ts` — `.verified()` decorator: chains on a `HumanSchema<T>` and flips `_def.humanMode` from `"writeable"` to `"verified"`.
- `src/get-mode.ts` — `getHumanMode(schema)` helper: reads `_def.humanMode` and returns the marker or `undefined`.

## Boundary

- **Imports from:** `zod` (peer). Nothing else.
- **Exports to:** `@underwai/core` (uses `HumanMode` as a type; re-exports for convenience), `@underwai/runner` (uses `getHumanMode` to read the marker on a node's `inputSchema`).
- **What does NOT live here:** the data structure (`@underwai/core`), the runner (`@underwai/runner`). This package is one Zod extension; nothing else.

## Design decisions that govern this package

- **`z.human()` is a runtime function, not just a type.** (TASK-E) The lib reads the human-mode marker at `init()` time, so the marker has to be on the schema object, not just in the type. Clone-and-mutate `_def.humanMode` is the chosen mechanism for Zod 3.x. Zod 4.x would use `.meta({ human: "..." })` instead — deferred.
- **Two human modes:** `"writeable"` and `"verified"`. The third implicit state ("human-editable with upstream seed") is named in the docs (TASK-E) but is not a third value; it's the composition of source-kind (TASK-H) and `HumanMode`.
- **The marker is a convention, not a type-system enforcement.** The lib doesn't reject a schema that has neither `z.human()` nor plain Zod — it just reads `getHumanMode()` and the result is `undefined` for plain schemas.

## Plan files that touch this package

- [`.cns/plans/TASK-E.md`](../../.cns/plans/TASK-E.md) — the runtime implementation of `z.human()`; the seed-vs-no-seed vocabulary.

## For the implementation phase

When Phase 2 starts, the agent implements three small files (`human.ts`, `verified.ts`, `get-mode.ts`) and the `index.ts` re-export. The TypeScript declaration-merge trick (`declare module "zod" { namespace z { function human<T>(schema: T): HumanSchema<T> } }`) gives the type-level extension; the runtime functions attach the marker.

The shape of `HumanSchema<T>` is `T & { __humanMode: HumanMode; verified(): HumanSchema<T> }`. The `&` intersection is the type-theoretic cleanest shape; the runtime marker is on `_def`, which is internal to Zod but stable across 3.x.

Total code in this package: ~50 lines. The design is the bulk of the work.
