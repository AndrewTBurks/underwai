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
> *Location*: `docs/design.md` line ~340, writeHumanInput
>
> *Finding*: when a node is `paused` (verified gate), the human sees a "starting value" (proposed, current, or empty) and writes *something* via `writeHumanInput`. The renderer decides what the starting value is by reading `node.input.fields[fieldKey]`. The lib doesn't have an API like `getProposedValue(node, fieldKey)` that codifies the read.
>
> *Evidence*: the design says "the renderer reads `node.input.fields[fieldKey]` and decides." Direct field access.
>
> *Suggestion*: provide a helper `getHumanInputDisplay(node, fieldKey): { value: unknown; status: "pending" | "set"; proposed: boolean }` that codifies the read. The "proposed" flag indicates whether the value is a *proposal* (came from upstream, awaiting human confirmation) or a *current* value (already set). The renderer can use this to render the field differently.

## Problem statement

When a node is `paused`, the human sees a starting value (proposed, current, or empty) and writes via `writeHumanInput`. The renderer decides what the starting value is by reading `node.input.fields[fieldKey]` directly. The lib doesn't codify this read; every renderer reinvents it.

## Recommendation

**Add a `getHumanInputDisplay(node, fieldKey)` helper that returns `{ value, status, proposed }`.**

```ts
type HumanInputDisplay = {
  value: unknown
  status: "pending" | "set"
  proposed: boolean  // true if value came from upstream and is awaiting confirmation
}

function getHumanInputDisplay(
  node: Node,
  fieldKey: FieldKey
): HumanInputDisplay | undefined
```

The `proposed` flag is `true` when:
- The field is `human` and `status === "pending"`.
- The field has a `value` (came from upstream).

The `proposed` flag is `false` when:
- The field is `human` and `status === "set"` (the human has already written).
- The field has no `value` (upstream had no value, the human must provide one).

The renderer uses `proposed` to render the field differently (e.g., "Proposed: <value>" vs "<value>" vs "Please provide a value").

## What "done" looks like

### Patches

1. **`docs/design.md`** — operations section. Add `getHumanInputDisplay` to the operations. Document the return shape.

2. **`src/stub.ts`** — add `getHumanInputDisplay` as a new exported function. `throw new Error("not implemented")` body. The return type is `HumanInputDisplay | undefined`.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): `getHumanInputDisplay(pausedNode, "summary")` returns `{ value: <seeded>, status: "pending", proposed: true }`. `getHumanInputDisplay(verifiedNodeAfterWrite, "summary")` returns `{ value: <human-set>, status: "set", proposed: false }`. `getHumanInputDisplay(resolvedNode, "summary")` returns `{ value: <final>, status: "set", proposed: false }`.

## Session state

*(to be filled in during the design session)*
