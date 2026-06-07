---
title: "@underwai/schema"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, encode-lessons-in-structure]
decisions:
  - id: DEC-SCHEMA-001
    date: 2026-06-06
    author: agent
    summary: z.human() is a runtime function that clones the input schema and mutates _def.humanMode. Not just a type. Zod 3.x target; Zod 4.x would use .meta() (TASK-E).
  - id: DEC-SCHEMA-002
    date: 2026-06-06
    author: agent
    summary: 'Two human modes: "writeable" and "verified". The "human-editable with upstream seed" case is named in docs/design.md but is not a third value — it composes source-kind (from @underwai/core) with HumanMode (TASK-E).'
  - id: DEC-SCHEMA-003
    date: 2026-06-06
    author: agent
    summary: 'getHumanMode(schema) reads the marker and returns the mode or undefined. Plain Zod schemas return undefined. The lib doesn''t reject schemas without a marker; absence of marker means "not human-writable."'
  - id: DEC-SCHEMA-004
    date: 2026-06-06
    author: agent
    summary: Standalone — depends on Zod only. No @underwai/core import. The HumanMode type is re-exported from this package for convenience.
  - id: DEC-SCHEMA-005
    date: 2026-06-06
    author: agent
    summary: 'HumanSchema<T> = ZodType<T["_output"], T["_def"], T["_input"]> & { __humanMode: HumanMode; verified(): HumanSchema<T> }. The ZodType rebind is required; without it the intersection collapses T''s generics.'
  - id: DEC-SCHEMA-006
    date: 2026-06-07
    author: agent
    summary: 'Canonical API is `human(z.string())` (named import). The `z.human()` namespace mutation is NOT shipped. Zod 3 freezes the z namespace object (Object.isFrozen(z) === true), so the standard zod-extension pattern (zod-prisma, tRPC) does not work without forking. Consumers who want the namespace syntax do `import { human }` and call human() directly. This is the minimal-API-surface shape: no surprise mutations of the consumer''s z object.'
human_notes: |

status: dirty
last_reconciled: 2026-06-06
---

# @underwai/schema

The Zod extension. `human()` (named import) flags a schema as human-writable; `.verified()` is a decorator that gates on human confirmation. Standalone — depends on Zod only, not on `@underwai/core`.

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

## For the v1.0 implementation phase

When v1.0 implementation begins, the agent reads this file, opens `.cns/architecture/index.md` for the state machine and per-status semantics, and implements three small files (`human.ts`, `verified.ts`, `get-mode.ts`) and the `index.ts` re-export. The TypeScript declaration-merge trick (`declare module "zod" { namespace z { function human<T>(schema: T): HumanSchema<T> } }`) gives the type-level extension; the runtime functions attach the marker.

The design decisions that govern this package are encoded in the `decisions[]` frontmatter above. They are load-bearing — they shape the runtime marker mechanism, the human-mode vocabulary, and the standalone boundary. Prose in the body is for the file plan; the *why* lives in the decisions array.

The shape of `HumanSchema<T>` is `T & { __humanMode: HumanMode; verified(): HumanSchema<T> }`. The `&` intersection is the type-theoretic cleanest shape; the runtime marker is on `_def`, which is internal to Zod but stable across 3.x.

Total code in this package: ~50 lines. The design is the bulk of the work.
