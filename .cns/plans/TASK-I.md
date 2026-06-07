---
task: TASK-I
status: resolved
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

**2026-06-06 — resolved (against the plan's recommendation).** Andrew: "we MUST have path/node type safety and specificity as a first-class constraint. the consumer side is interfacing with a useless library if not."

The plan's "drop the Path generic for v1" recommendation was wrong. The path generic is non-negotiable — the consumer-facing API must give compile-time safety on which key is which. The Path generic is implemented properly in the stub now.

Combinator signatures carry the path through:
- `run(def)` → `NodeRef<"root">`
- `then(parent, def)` → `NodeRef<`${P}.${K}`>` (P = parent's path, K = child's kind)
- `then(parent, bridge, def)` → `NodeRef<`${P}.${K}`>` (bridge overload)
- `all(parent, ...refs)` → `NodeRef<`${P}.all`>` (array form)
- `all(parent, refs)` → `NodeRef<`${P}.all.${string}`>` (object form)
- `thenLoop(parent, body, predicate)` → `NodeRef<`${P}.${K}`>` (family of nodes)

`all`'s array form's "N" is a wildcard — TypeScript can't enumerate a dynamic family. `subscribeSet` is the consumer's path to addressing individual iterations. The same applies to `thenLoop`'s "N" and "final" — they're runtime, not type-level.

The brand on `NodeKey` rejects raw strings at the call site: `subscribe(state, ref.key, ...)` is type-checked; `subscribe(state, "root.refine" as NodeKey, ...)` is a string cast that the type system can't help with. The combination of brand + path generic gives full compile-time safety when the consumer uses combinators, and the brand alone gives "no raw strings" when they don't.

Patches in this commit: combinator signatures in `docs/design.md` and `src/stub.ts` carry the path through. `run` and the combinators export their typed versions; `NodeKey` keeps the `Path` generic.

`tsc --noEmit` green. CNS health gate green.
