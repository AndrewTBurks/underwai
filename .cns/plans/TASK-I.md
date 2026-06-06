---
task: TASK-I
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [A1]
decision_required: false
---

# TASK-I: Path generic on NodeKey<Path>

## Source finding

> **A1. [warning] The `Path` generic on `NodeKey<Path>` is over-promised**
>
> *Location*: `docs/design.md` line ~52, `src/stub.ts` `NodeKey<Path>`
>
> *Finding*: `NodeKey<Path extends string = string>` carries a `Path` generic, but in the stub every `NodeKey` is `NodeRef<string>` (or `NodeKey<string>`). The composition API's stub uses `NodeRef<"root">` for `run`, but everything downstream collapses to `NodeRef<string>`. The `Path` generic is only meaningful in a *fully-typed composition* where the consumer threads path types through generic combinator signatures. The current stub and design don't deliver on that.
>
> *Evidence*: `src/stub.ts` lines 30-37 — the `run` function returns `NodeRef<"root">` only because its return type is hardcoded. `then`, `all`, `thenLoop` all return `NodeRef<string>`. The template-literal types in the design doc (`"${parent.path}.${def.kind}"`) are not actually implemented in the stub.
>
> *Suggestion*: either (a) commit to the template-literal types by writing the combinator signatures in a way that actually carries the path through generics, or (b) drop the `Path` generic and use `NodeKey = string & { __brand: "NodeKey" }`. The current middle ground is the worst of both — it implies more type safety than it delivers.

## Problem statement

The `Path` generic is aspirational. The stub collapses everything to `string` because the combinator signatures don't actually carry the path through generics. The current state implies more type-safety than delivered.

## Recommendation

**Defer to v1.1.** Ship with `NodeRef<string>` for v1. Add templated path types in v1.1 once the combinator signatures can actually carry them (which requires significant work on the composition API's type signatures).

For v1:
- `NodeKey = string & { __brand: "NodeKey" }` (drop the `Path` generic).
- `NodeRef = { key: NodeKey }`.
- Combinator signatures return `NodeRef`, not `NodeRef<"some.path">`.

The doc says "v1.1 will template-literal-type the path." No code change for v1.

## What "done" looks like

### Patches

1. **`docs/design.md`** — `NodeKey` type. Drop the `Path` generic. Note that v1.1 will add templated paths.

2. **`src/stub.ts`** — `NodeKey` type. Drop the `Path` generic.

3. **`docs/design.md`** — open questions for v1.1+. Add a new entry: "Template-literal path types on `NodeRef<Path>`."

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` `NodeKey` type matches the stub.

## Session state

*(to be filled in during the design session)*
