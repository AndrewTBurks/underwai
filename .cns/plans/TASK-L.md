---
task: TASK-L
status: resolved
source: interrogate-2026-06-06
severity: warning
finding_refs: [A6, C7]
decision_required: false
---

# TASK-L: Actor type — pick one

## Source findings

> **A6. [nit] The `Actor` type allows arbitrary strings, defeating the brand**
>
> *Location*: `docs/design.md` line ~95, `src/stub.ts` `Actor`
>
> *Finding*: `Actor = "system" | "human" | (string & {})` — the `(string & {})` brand allows any string. This is a common Zod-style trick to allow string-literal types to be intersected with arbitrary strings. But it means `actor: Actor` accepts `actor: "anything"` without a type error. The type system is not enforcing that `actor` is one of `system`/`human`/a registered role.
>
> *Evidence*: The design says "actor: 'system' | 'human' | string" — three categories, but the third is unbounded. The intent is presumably "a finite set of named roles" (e.g., "system", "human", "orchestrator", "reviewer") but the type allows any string.
>
> *Suggestion*: if the intent is "any string," drop the brand. If the intent is "a finite set of named roles," define `type ActorRole = "system" | "human" | "orchestrator" | "reviewer" | string & {}` and have `init()` validate that the role is registered. The current shape says "any string" but the doc implies "named roles."

> **C7. [warning] `actor: "system" | "human" | string` allows arbitrary strings, defeating the brand**
>
> *Location*: `docs/design.md` `Actor`, `src/stub.ts`
>
> *Finding*: same as A6 from a different angle. The `Actor` type is a Zod-style "branded string" trick that allows any string. If the intent is "a finite set of named roles," the type should be a closed union. If the intent is "any string," drop the brand.
>
> *Evidence*: `src/stub.ts` `type Actor = "system" | "human" | (string & {})`.
>
> *Suggestion*: pick one. If "any string," `type Actor = string`. If "named roles," `type Actor = "system" | "human" | "orchestrator" | "reviewer" | ...` (and a registry pattern for extension).

## Problem statement

`Actor` is a half-measure: it implies a finite set of named roles but allows any string. The `(string & {})` brand is a Zod trick for "string literals intersected with arbitrary strings" that defeats the type system.

## Recommendation

**Drop the brand. `type Actor = string`. Document the convention.**

The intent is "any string" (the actor is just a label). The half-brand is confusing. Plain string is honest.

```ts
type Actor = string
```

The convention (documented in the design doc) is:
- `"system"` for the lib's own operations (e.g., the runner setting an initial value).
- `"human"` for human-driven operations (e.g., `writeHumanInput`).
- Any other string for consumer-defined actors (e.g., `"orchestrator"`, `"reviewer"`, etc.).

The lib doesn't validate the actor; the consumer is responsible for using meaningful values.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `Actor` type. Change to `type Actor = string`. Document the convention.

2. **`src/stub.ts`** — change `type Actor = "system" | "human" | (string & {})` to `type Actor = string`.

### Verification

- `tsc --noEmit` exit 0.

## Session state

**2026-06-06 — resolved.** Drop the brand. `type Actor = string`. The half-brand was confusing. Document the convention. Patch: `docs/design.md` and `src/stub.ts`. The lib doesn't validate the actor; the consumer is responsible for meaningful values. The convention: "system" for the lib's own operations, "human" for human-driven, any other string for consumer-defined roles.
