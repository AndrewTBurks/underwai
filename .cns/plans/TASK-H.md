---
task: TASK-H
status: resolved
source: interrogate-2026-06-06
severity: critical
finding_refs: [C3, C4]
decision_required: false
---

# TASK-H: InputSource carries the schema (two-stage validation)

## Source findings

> **C3. [critical] `InputSource` doesn't carry a schema, so the lib can't revalidate the value**
>
> *Location*: `docs/design.md` `InputSource`, `src/stub.ts`
>
> *Finding*: `InputSource = { kind: "literal"; value: unknown } | { kind: "from_node"; nodeId: NodeKey } | { kind: "human"; fieldSchema; value?; status }`. The `literal` source has no schema — the value is `unknown`. The `from_node` source has no schema — the value comes from the upstream's `finalOutput` (which was validated against that node's `outputSchema`, but that's a different schema). The `human` source has `fieldSchema` (good).
>
> *Evidence*: when a node transitions to `ready`, the runner gathers all input sources, builds the full input object, validates it against the node's `inputSchema`, and then calls the consumer's `program(input)`. Where does that validation happen? The design doesn't say, and `InputSource` doesn't have a uniform schema to validate against.
>
> *Suggestion*: every `InputSource` should carry the schema that validates its value. For `literal`, this is a per-field schema (ZodType for that input field). For `from_node`, the schema is the upstream's `outputSchema` (resolved at the edge). For `human`, it's the field's schema. The lib builds a "resolved input" by validating each source against its schema, then assembling the full input and validating against `inputSchema`. This makes the validation chain explicit.

> **C4. [warning] `Edge` has no schema for the `from_node` source**
>
> *Location*: `docs/design.md` `Edge`, `src/stub.ts`
>
> *Finding*: `Edge = { from: NodeKey; to: NodeKey; toField: FieldKey }`. The edge says "the output of `from` feeds into the `toField` of `to`'s input." But there's no schema for the value being passed. The runner assumes that the upstream's `output` (or `finalOutput`) is compatible with the downstream's input field. If the upstream's `outputSchema` and the downstream's input field's schema don't match, the runner has no way to detect the mismatch before running the downstream.
>
> *Evidence*: the design doesn't say how cross-node compatibility is validated. The lib validates against the downstream's `inputSchema` when the node runs, but that's *after* the runner has already gathered the input.
>
> *Suggestion*: validate at edge resolution. When the runner gathers the input for a node, for each `from_node` source, validate the upstream's `finalOutput` against the *downstream field's schema* (extracted from `inputSchema`). This is an early-failure check — if upstream's output doesn't match what downstream expects, the node fails before running the program. (Or, the lib could have an explicit `edgesByTarget: Record<NodeKey, Edge[]>` index with field schemas precomputed.)

## Problem statement

Two related issues:

1. **`InputSource` doesn't carry a schema per source.** The `from_node` variant has no schema; the runner can't revalidate the upstream's `finalOutput` against what the downstream expects.

2. **`Edge` doesn't carry a schema for the value being passed.** The runner has to infer "the upstream's outputSchema must be compatible with the downstream's input field schema" but can't check it.

The result: a single bad value (e.g., upstream's `outputSchema` is `z.string()` but downstream expects `z.number()`) is detected *only* when the downstream node runs, not at edge resolution. The failure is late and the error message is generic.

## Recommendation

Add a `schema: ZodTypeAny` field to the `from_node` variant of `InputSource`. The schema is the *downstream field's schema*, extracted from the downstream's `inputSchema` at edge resolution. The runner validates the upstream's `finalOutput` against this schema before assembling the input.

Don't change `literal` or `human` (they already have explicit value types / schemas).

```ts
type InputSource =
  | { kind: "literal"; value: unknown }
  | { kind: "from_node"; nodeId: NodeKey; schema: ZodTypeAny }
  | { kind: "human"; fieldSchema: ZodTypeAny; value?: unknown; status: "pending" | "set" }
```

The runner's input resolution is now two-stage:
1. **Per-source validation.** For each `from_node` source, validate the upstream's `finalOutput` against the source's `schema`. If validation fails, the node's input is invalid; transition to `failed`.
2. **Aggregate validation.** Assemble the full input object. Validate against the node's `inputSchema`. If validation fails, transition to `failed`.

This catches the cross-node type mismatch at edge resolution, not deep in the program.

The `Edge` type doesn't need a schema field — the schema is carried on the `InputSource.from_node`, which is derived from the edge + the downstream's `inputSchema` at init time.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `InputSource` type. Add `schema: ZodTypeAny` to the `from_node` variant. Document the two-stage validation.

2. **`docs/design.md`** — operations section. Add a subsection on input resolution: "For each from_node source, validate upstream.finalOutput against source.schema. If valid, assemble the full input and validate against inputSchema. If invalid, transition to failed."

3. **`src/stub.ts`** — `InputSource.from_node` variant. Add `schema: ZodTypeAny`.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): a workflow where upstream's `outputSchema` is `z.string()` but downstream expects `z.number()` fails the input resolution at edge time, with a clear error message identifying the mismatch.

## Session state

**2026-06-06 — resolved (with significant pivot).** Andrew's question ("I don't really understand what InputSource even is") surfaced a deeper issue: the per-field `InputSource` discriminated union was the wrong shape. The original design's "literal / from_node / human" per-field source was confused — a field's source isn't a per-cycle thing, it's a composition-time wiring.

The pivot:

1. **`InputSource` is gone.** The runner doesn't ask "where did this field's value come from this cycle?" — it asks "what's the upstream?" via the edge list, "what's the human mode?" via `humanFields`, and "is this a literal?" by absence of edge and human mode. The bundle shape (`fields` + `fieldSchemas` + `humanFields`) is gone too — `ResolvedInput` is a single value, schema, and human-fields map.

2. **`ResolvedInput = { value, schema, humanFields }`.** A single value, not a per-field bundle. The composition API enforces shape match between parent's output and child's input. No per-field wiring.

3. **Edge drops `toField`.** Edge = `{ from, to }`. No per-field wiring metadata. The connection is positional: parent's `finalOutput` becomes child's `value` (wholesale).

4. **Bridges are an optional function on the Edge.** `Edge = { from, to, bridge?: (parentOut) => unknown }`. The composition API has two overloads of `.then()`:
   - `parent.then(child)` — direct match (parent.output shape === child.input shape).
   - `parent.then((out) => in_, child)` — bridge overload; the bridge function is composition metadata, stored on the Edge, applied by the runner at edge resolution.

5. **The composition API combinators enforce shape match.** When shapes don't match, the consumer writes a bridge function (or chains through a transform node). The lib doesn't auto-wire fields.

This is a foundational move. The data structure now says: "the runner's job is to walk a DAG, run Effect programs at each node, and pipe the result downstream. The composition is the wiring." The per-field `InputSource` was a half-measure that the lib used to paper over the missing composition-level wiring.

The `humanFields` map stays. It tracks which fields are human-editable and in which mode, derived from the input schema via `getHumanMode`. The runner uses it to know whether `writeHumanInput` marks the node `stale` (writeable) or pauses for confirmation (verified). The seed-vs-no-seed vocabulary (TASK-E) still applies: a `writeable` field may have a seed (from upstream) or not; a `verified` field pauses for confirmation regardless of seed.

Patches in this commit:
- `InputSource` and the per-field bundle shape are removed from `docs/design.md` and `src/stub.ts`.
- `ResolvedInput` becomes `{ value, schema, humanFields }`.
- `Edge = { from, to, bridge? }` replaces the old `{ from, to, toField }`.
- The composition API's `then` has two overloads (direct match and bridge); the stub implements both signatures.
- `docs/design.md` composition API section documents the two overloads.

`tsc --noEmit` green. CNS health gate green.

The plan's original "two-stage validation" recommendation (per-source validation against `source.schema`, then aggregate against `inputSchema`) is preserved: with the new shape, the per-source validation is `value` against `schema`, and the aggregate validation is the full input object (when the schema is a record) against `inputSchema`. The lib still does two stages; the per-source stage is now a single value check rather than a per-field map walk.
