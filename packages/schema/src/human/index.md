---
title: "schema/human"
type: module
parent: ../../index.md
principles: [boundary-discipline, type-system-discipline, minimal-api-surface]
decisions:
  - id: DEC-SCHEMA-001
    date: 2026-06-06
    author: agent
    summary: z.human() is a runtime function that clones the input schema and attaches a new _def with humanMode. The clone avoids shared mutation across callsites; each call to z.human() produces a fresh schema. Zod 3.x target; Zod 4.x would use .meta() (TASK-E).
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
  - id: DEC-SCHEMA-001a
    date: 2026-06-08
    author: agent
    summary: '`cloneWithMode<T>(schema: T, mode: HumanMode)` constructs a fresh schema of the same constructor as the input, with the `_def` extended by `humanMode`. The constructor is read via `Object.getPrototypeOf(schema).constructor`. The new instance gets the `.verified()` method attached. This pattern is generic across Zod types (ZodString, ZodNumber, ZodObject, etc.) — the marker is on `_def`, the type-level shape comes from the original schema.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# schema/src/human

The Zod extension. `human(schema)` flags a schema as human-writable; `.verified()` is a decorator that gates on human confirmation. The runtime marker is on `_def.humanMode`; the type-level shape is `HumanSchema<T>`. Standalone — depends on Zod only.

## What lives here

The source is `human.ts` next to this directory.

- **`HumanMode`** — `"writeable" | "verified"`. Two modes. The "human-editable with upstream seed" case is not a third value — it composes `sourceKind` (from `@underwai/core/HumanInputDisplay`) with `HumanMode`.
- **`HumanSchema<T extends ZodTypeAny>`** — the type. `ZodType<T["_output"], T["_def"], T["_input"]> & { __humanMode: HumanMode; verified(): HumanSchema<T> }`. The ZodType rebind is required; without it the intersection collapses `T`'s generics.
- **`getHumanMode(schema: ZodTypeAny): HumanMode | undefined`** — reads `_def.humanMode`. Returns `undefined` for plain Zod schemas. The lib does not reject schemas without a marker; absence means "not human-writable."
- **`human<T>(schema: T): HumanSchema<T>`** — the public API. Clones the schema and attaches the marker.
- **`cloneWithMode<T>(schema, mode)`** — internal. Constructs a fresh instance with `_def` extended by `humanMode`. Generic across Zod types.

## Why named import, not `z.human()`

Zod 3 freezes the `z` namespace object (`Object.isFrozen(z) === true`). The standard zod-extension pattern (used by zod-prisma, tRPC) does not work without forking. The named import is the canonical spelling — no surprise mutations of the consumer's `z` object. This matches the principle "minimal API surface."

## Boundary

- Imports from: `zod` (peer). Nothing else.
- Exports to: `@underwai/core` (uses `HumanMode` as a type; re-exports for convenience), `@underwai/runner` (uses `getHumanMode` to read the marker on a node's `inputSchema`), the examples package (uses `human(z.string())` to mark fields).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
