---
task: TASK-U
status: resolved
source: interrogate-2026-06-06
severity: warning
finding_refs: [A8]
decision_required: false
---

# TASK-U: thenLoop family handle typing

## Source finding

> **A8. [warning] `thenLoop` returns `NodeRef<string>`, not a family handle**
>
> *Location*: `docs/design.md` line ~38, `src/stub.ts` `thenLoop`
>
> *Finding*: `thenLoop` returns a single `NodeRef<string>`, but produces a *family* of nodes. The consumer can subscribe to `"root.refine.final"` individually, but there's no way to *handle the family* at the type level. The "address every node" promise is only partially delivered — the consumer can address individual nodes by typing their key as a string, but they can't get a typed handle to the family.
>
> *Evidence*: `src/stub.ts` `thenLoop` returns `NodeRef<string>`. The design says "the family is keyed as root.refine[N] and root.refine.final" but doesn't define a `FamilyRef<Path, N>` or similar type.
>
> *Suggestion*: this is acceptable for v1 — typing a family in TypeScript is hard (N is unbounded). The consumer addresses individual nodes by string. But the design should say "the family handle is a string-typed NodeRef; consumers address individual iterations by string." Don't imply more type-safety than is delivered.

## Problem statement

`thenLoop` returns `NodeRef<string>`, but the family is unbounded. The TypeScript type system can't enumerate an arbitrary number of iterations. The design should be honest about this.

## Recommendation

**Document that the family handle is string-typed. Consumers address individual iterations by string.**

```markdown
### `thenLoop` family handle

`thenLoop(body, predicate)` returns a `NodeRef<string>`, not a typed family handle. The family is unbounded (N is runtime-dependent), so the TypeScript type system can't enumerate it. Consumers address individual iterations and the final by string:

- `subscribe(state, "root.refine[0]" as NodeKey, ...)` — first iteration
- `subscribe(state, "root.refine[1]" as NodeKey, ...)` — second iteration
- `subscribe(state, "root.refine.final" as NodeKey, ...)` — the final
- `subscribe(state, "root.refine" as NodeKey, ..., { prefix: true })` — the whole family

The `as NodeKey` cast is required because the key is a string at the type level. This is a v1 limitation; v1.1+ may add a `FamilyRef<Path, Index extends number>` type if a use case demands it.
```

## What "done" looks like

### Patches

1. **`docs/design.md`** — composition API section. Add a "thenLoop family handle" subsection. State that the handle is `NodeRef<string>` and consumers address iterations by string.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` has a "thenLoop family handle" subsection.

## Session state

**2026-06-06 — resolved (doc-only).** The original plan said the family handle is `NodeRef<string>`. With TASK-I's resolution, the handle is `NodeRef<`${P}.${K}`>` — a *prefix* pointing at the family, not a list of members. The members are runtime (the N and final in `root.refine[N]` and `root.refine.final`); the prefix is type-checked.

The doc-only fix: clarify that `thenLoop` returns a single `NodeRef` (a prefix), and consumers use `subscribeSet(state, handle.key + ".*", onUpdate)` to address the family. Patch: `docs/design.md` combinator section paragraph 4 is updated.
