---
title: "examples/HumanForm"
type: module
parent: ../../index.md
principles: [experience-first, boundary-discipline, type-system-discipline]
decisions:
  - id: DEC-EXAMPLES-010
    date: 2026-06-08
    author: agent
    summary: '`HumanForm` is a single-field form for a human-paused node. The lib''s `human()` schema marker is constrained to literal primitive types (string, number, boolean, enum) in the v1.0 reference renderer. The form is a single input with a label and a submit button. (TASK-44.)'
  - id: DEC-EXAMPLES-010a
    date: 2026-06-08
    author: agent
    summary: "The form's input type is derived from the schema via `unwrapScalarType(schema: ZodTypeAny): ScalarType`. The `ScalarType` is `\"string\" | \"number\" | \"boolean\" | \"enum\" | \"unknown\"`. The form supports strings, numbers, booleans (checkbox), and enums (a `<select>` with two fixed options). The `ZodEffects` wrapper is unwrapped recursively."
  - id: DEC-EXAMPLES-010b
    date: 2026-06-08
    author: agent
    summary: 'On submit, the form coerces the value to the inferred scalar type (`coerce(value, type)`) and calls `onSubmit(value)`. The shell wires `onSubmit` to `rt.writeHumanInput`. The coercion is a one-line helper; a v1.1 form could use Zod''s `schema.parse(value)` for stricter validation, but for the v1.0 reference the scalar coercion is sufficient.'
human_notes: |
status: clean
last_reconciled: 2026-06-08
---

# examples/src/HumanForm

A single-field form for a human-paused node. The lib's `human()` schema marker is constrained to literal primitive types in the v1.0 reference renderer.

## What lives here

The source is `HumanForm.tsx` next to this directory.

- **`HumanForm({ schema, label, onSubmit })`** — the component. Reads the schema's scalar type, renders the appropriate input, and calls `onSubmit(value)` on submit.
- **`unwrapScalarType(schema: ZodTypeAny): ScalarType`** — internal. Recursively unwraps `ZodEffects` and returns `"string" | "number" | "boolean" | "enum" | "unknown"`.
- **`defaultForType(t: ScalarType): string`** — internal. Returns the default string value for the input (empty for string/number, "false" for boolean).
- **`coerce(value: string, t: ScalarType): unknown`** — internal. Coerces the string to the inferred scalar type before calling `onSubmit`.

## Boundary

- Imports from: `react` (peer, `useState`), `zod` (peer, `ZodTypeAny`).
- Exports to: `RenderedPanel.tsx` (uses `<HumanForm>` when a node is paused on a human-marked field).
- **What does NOT live here:** the panel that wraps the form (in `RenderedPanel.tsx`), the shell that wires the submit handler (in `ExampleShell.tsx`).

The design decisions that govern this module are encoded in the `decisions[]` frontmatter above.
