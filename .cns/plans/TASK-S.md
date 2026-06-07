---
task: TASK-S
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [D8]
decision_required: false
---

# TASK-S: getHumanInputDisplay helper

## Source finding

> **D8. [nit] The "starting value" the human sees is renderer-defined; the lib doesn't expose it**
>
> *Location*: `docs/design.md` line ~340, `writeHumanInput`
>
> *Finding*: when a node is `paused` (verified gate), the human sees a "starting value" (proposed, current, or empty) and writes *something* via `writeHumanInput`. The renderer decides what the starting value is by reading `node.input.fields[fieldKey]`. The lib doesn't have an API like `getProposedValue(node, fieldKey)` that codifies the read.
>
> *Suggestion*: provide a helper `getHumanInputDisplay(node, fieldKey): { value: unknown; status: "pending" | "set"; proposed: boolean }` that codifies the read. The "proposed" flag indicates whether the value is a *proposal* (came from upstream, awaiting human confirmation) or a *current* value (already set). The renderer can use this to render the field differently.

## Problem statement

When a node is `paused`, the human sees a starting value (proposed, current, or empty) and writes via `writeHumanInput`. The renderer decides what the starting value is by reading `node.input.fields[fieldKey]` directly. The lib doesn't codify this read; every renderer reinvents it.

The original suggestion had a `proposed: boolean` flag. That flag encodes a UX decision the lib shouldn't make: "is this value a proposal or a current value?" Different renderers will answer differently (some want a "Proposed: <value>" prefix; some want a confirmation step; some want to gray the value out entirely). The flag forces a particular UX model.

What the lib actually knows is the *source* of the value: literal, from an upstream node, or human-set. The renderer's "is this a proposal?" question is its own. The helper should expose the source and let the renderer decide.

## Recommendation

Add a `getHumanInputDisplay(node, fieldKey)` helper that returns a discriminated union on the input source kind. The lib exposes what it knows; the renderer decides what to do with it.

```ts
type HumanInputDisplay =
  | { source: "literal"; value: unknown; fieldSchema: ZodTypeAny }
  | { source: "from_node"; value: unknown; fieldSchema: ZodTypeAny; upstream: NodeKey }
  | { source: "human"; value: unknown; fieldSchema: ZodTypeAny; status: "pending" | "set" }
  | undefined  // fieldKey is not a human-editable field

function getHumanInputDisplay(
  node: Node,
  fieldKey: FieldKey
): HumanInputDisplay
```

The return is `undefined` when the field is not human-editable. The discriminator is `source`, which mirrors `InputSource.kind`. The renderer pattern-matches and decides UX:

- `source: "literal"` — the value is hardcoded. Render as a read-only field with a "(literal)" indicator, or hide the field.
- `source: "from_node"` — the value came from an upstream node's output. The renderer can show a "proposed by <upstream>" indicator (its choice of UX). The field is human-editable, so the human can override.
- `source: "human", status: "pending"` — no value yet, the human must provide one. Render an empty input.
- `source: "human", status: "set"` — the human has already written. Render the current value (editable, since the field is human-writable).

## Why this shape, not a `proposed` flag

The original suggestion's `proposed: boolean` collapsed three distinct cases (literal value, upstream-seeded proposal, no seed) into a single flag. The collapsed shape leaks:

1. The renderer can't tell the difference between "literal value that the human can't override" and "upstream-seeded value that the human can override." Both come back as `proposed: true`. The renderer's "is this editable?" question has no answer from the flag alone.

2. The `proposed: true` case for a `from_node` source requires the lib to know whether the field is human-editable at all. The current suggestion mixes the source question (what is this value?) with the editability question (can the human change it?). The discriminated union separates them: the source tells you what the value is, the field's `HumanMode` (from TASK-E) tells you whether the field is human-editable.

3. The renderer has to read `node.input.fields[fieldKey]` to get the `fieldSchema` anyway, in order to render the form. The helper's discriminated union includes `fieldSchema` so the renderer doesn't have to do a second read.

The discriminated union is one more type, but it's a typed join between `InputSource`, `HumanMode`, and the form-rendering contract. The renderer reads it once, pattern-matches, renders. The `proposed` flag would have forced the renderer to read the underlying `InputSource` a second time to answer the questions the flag couldn't.

## What "done" looks like

### Patches

1. **`docs/design.md`** — operations section. Add `getHumanInputDisplay` to the operations. Document the discriminated-union return type with the four cases.

2. **`docs/design.md`** — subscription section. Add a note: "the renderer is the source of truth for 'is this a proposal?' UX. The lib exposes the source; the renderer decides the rendering."

3. **`src/stub.ts`** — add `getHumanInputDisplay` as a new exported function with `throw new Error("not implemented")` body. Add the `HumanInputDisplay` type as an exported type alias.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2) covering all four cases:
  - `getHumanInputDisplay(nodeWithLiteralField, "x")` returns `{ source: "literal", value, fieldSchema }`.
  - `getHumanInputDisplay(pausedNode, "summary")` (with an upstream-seeded value) returns `{ source: "from_node", value: <seeded>, fieldSchema, upstream: <NodeKey> }`.
  - `getHumanInputDisplay(verifiedNodeAfterWrite, "summary")` returns `{ source: "human", value: <human-set>, fieldSchema, status: "set" }`.
  - `getHumanInputDisplay(node, "nonExistentField")` returns `undefined`.
  - `getHumanInputDisplay(node, "nonHumanField")` returns `undefined`.

## Session state

*(to be filled in during the design session)*
