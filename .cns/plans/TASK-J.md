---
task: TASK-J
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [C1]
decision_required: false
---

# TASK-J: output vs finalOutput duality

## Source finding

> **C1. [warning] `output` vs `finalOutput` is two fields for the same conceptual value**
>
> *Location*: `docs/design.md` `Node` type, `src/stub.ts` `Node`
>
> *Finding*: `Node.output?: unknown` (the accumulator) and `Node.finalOutput?: unknown` (the validated final). The design says the partial is in `output` and the final is in `finalOutput`. But for nodes that don't stream, only `finalOutput` is set. For streaming nodes, `output` is updated incrementally and `finalOutput` is set when the program completes. This is two fields encoding "current partial value" + "validated final value."
>
> *Evidence*: the design says "the consumer's Effect program calls `publish(value)` to update the accumulator. The lib validates the value as a partial of `outputSchema`. When the Effect program returns, the runner calls `write(value)`, which validates against the full schema and sets `finalOutput`." The two fields are kept separate to allow `output` to be a *partial* of the schema and `finalOutput` to be the *full* schema.
>
> *Suggestion*: this is a real duality that has to be modeled somehow. Two options: (a) keep the two fields (current state), or (b) collapse to a single `output: { partial: unknown, final?: unknown }` (more explicit, but adds nesting). (a) is simpler for the consumer. Keep the current shape. The only "fix" needed is to clarify in the doc that for non-streaming nodes, `output` stays `undefined` and only `finalOutput` is set.

## Problem statement

`output` (accumulator) and `finalOutput` (validated final) are two fields. The duality is real (partial vs final) and the current shape is fine. The doc just needs to clarify the rule.

## Recommendation

**Keep the two-field shape. Document the rule.**

For non-streaming nodes:
- `output` stays `undefined`.
- Only `finalOutput` is set when the program returns.

For streaming nodes:
- `output` is updated incrementally via `publish()`.
- `finalOutput` is set when the program returns and `write()` validates the final value.

The renderer reads `output` for partial display, `finalOutput` for the resolved view. Both fields are `unknown`; the consumer's type system provides the actual type via `z.infer<outputSchema>`.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `Node` type. Add a comment block describing the rule:
   - For non-streaming nodes: `output` is `undefined`; only `finalOutput` is set.
   - For streaming nodes: `output` is the accumulator; `finalOutput` is the validated final.

### Verification

- `tsc --noEmit` exit 0 (no type change; only a doc clarification).

## Session state

*(to be filled in during the design session)*
