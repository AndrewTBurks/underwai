---
title: "@underwai/schema"
type: package
parent: ../../.cns/index.md
principles: [boundary-discipline, type-system-discipline, encode-lessons-in-structure]
links:
  - id: schema-human
    path: packages/schema/src/human/index.md
decisions:
  - id: DEC-SCHEMA-001
    date: 2026-06-06
    author: agent
    summary: human() is a named runtime function that clones the input schema and attaches a new _def with humanMode. The clone avoids shared mutation across callsites; each call to human() produces a fresh schema. Zod 3.x target; Zod 4.x would use .meta() (TASK-E, reconciled after DEC-SCHEMA-006).
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
    summary: "Canonical API is `human(z.string())` (named import). The `z.human()` namespace mutation is NOT shipped. Zod 3 freezes the z namespace object (Object.isFrozen(z) === true), so the standard zod-extension pattern (zod-prisma, tRPC) does not work without forking. Consumers who want the namespace syntax do `import { human }` and call human() directly. This is the minimal-API-surface shape: no surprise mutations of the consumer's z object."
human_notes: |

status: clean
last_reconciled: 2026-06-11
---

# @underwai/schema

The Zod marker package. `human()` is a named import that clones a Zod schema and attaches a human-mode marker; `.verified()` is a method on the returned `HumanSchema`. The package is standalone and depends on Zod only.

## What lives here

- `src/human.ts` — `human(schema)`, `getHumanMode(schema)`, `HumanMode`, and the `HumanSchema<T>` type. `human()` clones the input schema and attaches a fresh `_def.humanMode`; it does not mutate the caller's schema in place. `.verified()` returns the verified flavor.
- `src/index.ts` — the public entry. Re-exports the named API. The `z.human()` namespace mutation is not shipped because Zod 3 freezes the namespace object.

## Boundary

- **Imports from:** `zod` only.
- **Exports to:** `@underwai/core`, `@underwai/runner`, and examples that need human-marked schemas.
- **What does NOT live here:** workflow state, runner transitions, renderer UX, or transport behavior.

The completed TASK-E decisions are sharded into this package and `src/human/index.md`. The design decisions that govern this package are encoded in the `decisions[]` frontmatter above.
