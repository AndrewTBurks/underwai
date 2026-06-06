---
task: TASK-C
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [A7, D4]
decision_required: true
---

# TASK-C: Subscribe prefix semantics + default inversion

## Source findings

> **A7. [critical] The stub's `subscribe` exact/prefix semantics are not specified**
>
> *Location*: `docs/design.md` line ~340, `src/stub.ts` `subscribe`
>
> *Finding*: the design says "Subscription matches by key prefix by default... opt into exact match: `subscribe(state, "root.refine.final", onUpdate, { exact: true })`." But the stub's `SubscribeOptions = { exact?: boolean }` doesn't say *what* the prefix match is. Does `subscribe(state, "root.refine", ...)` match `root.refine[0]`, `root.refine[1]`, `root.refine.final`? Does it match `root.refineOther`? The semantics depend on a path-prefix match, but the match function isn't defined.
>
> *Evidence*: The design says "matches every node in the loop family" as the example, but doesn't say how a non-loop-prefix match would work. Is `"root.refine"` a prefix of `"root.refineA"`? Yes as a string prefix, no semantically. The lib needs a clear rule.
>
> *Suggestion*: define the prefix rule explicitly: "match if the subscribed key is a *path-segment* prefix of the node's key, where a path segment is separated by `.`. So `"root.refine"` matches `root.refine[0]`, `root.refine[1]`, `root.refine.final`, but does not match `root.refineA`." Implement this as `nodeKey.startsWith(subscribedKey + ".") || nodeKey === subscribedKey`. Add a test case.

> **D4. [warning] The `exact: true` option's default (`false` = prefix match) is surprising**
>
> *Location*: `docs/design.md` line ~340
>
> *Finding*: `subscribe(state, "root.refine", onUpdate, { exact: true })` — the `exact` option opts *into* exact match, so the default is prefix. But the prefix match is *path-segment* prefix, not string prefix. The default being a "smart" match (segment-aware) rather than an exact match is surprising; consumers might expect `subscribe("root.refine", ...)` to match *only* `"root.refine"`, not `"root.refine[0]"`.
>
> *Evidence*: the design's wording is "matches by key prefix by default" — "key prefix" is ambiguous between string prefix and path-segment prefix.
>
> *Suggestion*: invert the default. `subscribe(state, key, onUpdate)` matches *only* the exact key. To opt into prefix match, `subscribe(state, key, onUpdate, { prefix: true })`. This is the safer default (no surprise matches) and matches consumer expectations.

## Problem statement

Two conflated issues:

1. **The prefix rule is undefined.** "Prefix match" is ambiguous between string prefix (`"root.refine"` matches `"root.refineA"`) and path-segment prefix (`"root.refine"` matches `"root.refine[0]"` but not `"root.refineA"`). The design says "matches every node in the loop family" but doesn't define the matching rule.

2. **The default is surprising.** Consumers expect `subscribe(state, "root.refine", ...)` to match *only* `"root.refine"`, not the loop family. The current default of "prefix match" is the wrong default.

## Recommendation

Both fixes together:

1. **Define the prefix rule explicitly:** `nodeKey === subscribedKey || nodeKey.startsWith(subscribedKey + ".")`. The dot is the path-segment boundary.

2. **Invert the default:** `subscribe(state, key, onUpdate)` is *exact* match. `subscribe(state, key, onUpdate, { prefix: true })` opts into segment-prefix match.

```ts
type SubscribeOptions = {
  exact?: boolean       // deprecated; use { prefix: false } to mean exact
  prefix?: boolean      // default: false (exact match)
}

function subscribe(
  state: WorkflowState,
  key: NodeKey,
  onUpdate: (node: Node) => void,
  opts?: { prefix?: boolean }
): Subscription
```

The wall-display uses `subscribeAll` (TASK-D), not prefix matches. Loop iterations that want the family use `{ prefix: true }`. Single-node subscribers use the default exact match.

## What "done" looks like

### Patches

1. **`docs/design.md`** — subscription section. Add the explicit matching rule. Note the default inversion. Provide examples for the three cases: exact, prefix, subscribeAll (TASK-D).

2. **`src/stub.ts`** — `SubscribeOptions` type. Replace `{ exact?: boolean }` with `{ prefix?: boolean }`. Update the `subscribe` signature.

3. **`src/stub.ts`** — add a comment in `subscribe` describing the matching rule. Even though the body is stub, the comment codifies the semantics.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` subscription section has the explicit matching rule and a note about the default inversion.
- A test case (post-Phase-2): `subscribe("root.refine", ...)` exact-matches `"root.refine"` but not `"root.refine[0]"`. `subscribe("root.refine", ..., { prefix: true })` matches both.

## Session state

*(to be filled in during the design session)*
