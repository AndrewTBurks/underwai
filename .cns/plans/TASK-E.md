---
task: TASK-E
status: pending
source: interrogate-2026-06-06
severity: critical
finding_refs: [A2, C5]
decision_required: true
---

# TASK-E: Runtime implementation of z.human()

## Source findings

> **A2. [warning] The `HumanSchema.__humanMode` is a phantom property that won't survive Zod's `.parse()`**
>
> *Location*: `docs/design.md` line ~273, `src/stub.ts` `HumanSchema`
>
> *Finding*: `HumanSchema<T> = T & { __humanMode: HumanMode; verified(): HumanSchema<T> }`. The `__humanMode` is a phantom property — it doesn't exist on the runtime value, only in the type. Zod schemas at runtime don't have a `__humanMode` field unless the lib adds one in `z.human()`. If the consumer does `z.human(z.string()).parse("hello")`, the result is `"hello"` (a string), and the type system *erases* the `__humanMode` because the parse result is the inner type. The lib has to *not* rely on the type-level mode at runtime; it has to read it from a *runtime* marker on the schema object.
>
> *Evidence*: The stub has `declare module "zod"` augmenting `z` with `human()`, but doesn't implement the runtime side. The `humanFields: ReadonlyMap<FieldKey, HumanMode>` field on `Node` requires reading the mode at `init()` time. Where does that read happen? The design doesn't say.
>
> *Suggestion*: implement `z.human(schema)` as a runtime function that returns a *wrapped* Zod schema with a marker property (e.g., `schema._def.humanMode = "writeable"`), and have `init()` walk the input schema to populate `node.humanFields`. The type-level `__humanMode` is for compile-time hints; the runtime marker is what the lib actually reads. Both are needed.

> **C5. [warning] The `__humanMode` and `verified()` runtime implementation is missing**
>
> *Location*: `docs/design.md` line ~273, `src/stub.ts` `HumanSchema`
>
> *Finding*: same as A2 from a different angle. The design says `z.human(schema)` and `.verified()` are Zod extensions, but the stub only declares them. The runtime implementation is missing. Without a runtime marker on the schema, the lib can't read the mode at `init()` time.
>
> *Evidence*: the stub has `declare module "zod" { namespace z { function human<T>(schema: T): HumanSchema<T> } }`. The implementation isn't there.
>
> *Suggestion*: implement `z.human` as a runtime function that wraps the Zod schema and adds a marker to its `_def`. Something like:
>
> ```ts
> function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
>   ;(schema._def as any).humanMode = "writeable"
>   ;(schema as any).verified = function() {
>     ;(this._def as any).humanMode = "verified"
>     return this
>   }
>   return schema as HumanSchema<T>
> }
> ```
>
> The exact mechanism depends on Zod's version, but the principle is: the lib reads the mode at runtime from a marker on the schema.

## Problem statement

The `z.human()` Zod extension is a type-only declaration in the stub. The lib's `init()` is supposed to walk the input schema to populate `node.humanFields` (or, post-TASK-K, derive the map on read). Without a runtime marker on the schema, the lib has nothing to read.

The runtime marker is the bridge between the type-level mode and the actual lib behavior.

## Options

### (a) Mutate the schema's `_def.humanMode` directly
`z.human(schema)` mutates the schema's internal `_def` object to add a `humanMode: "writeable"` property. `.verified()` mutates the same property to `"verified"`. The schema is no longer "pure" — the same Zod object has been augmented with a lib-specific marker.

**My read**: the conventional Zod-extension pattern. Many libs (tRPC, zod-prisma, etc.) do this. The downside: if the consumer constructs the same schema object in two places, the mutations collide. The workaround: `z.human()` returns a *copy* of the schema with the marker.

```ts
function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
  const wrapped = schema.clone() as HumanSchema<T>
  ;(wrapped._def as any).humanMode = "writeable"
  ;(wrapped as any).verified = function() {
    ;(this._def as any).humanMode = "verified"
    return this
  }
  return wrapped
}
```

### (b) Wrap the schema in a new object
`HumanSchema<T> = { schema: T; mode: "writeable" | "verified" }`. The consumer calls `humanSchema.schema.parse(x)` to get the underlying value, but the lib sees the wrapper. The consumer's existing code that does `z.human(z.string()).parse(x)` breaks — they have to do `z.human(z.string()).schema.parse(x)`.

**My read**: cleanest type-theoretically, but breaks the consumer-facing API. The whole point of `z.human(z.string())` is that it *looks* like a ZodString and chains with `.min(5)`, `.optional()`, etc. Wrapping breaks the chain.

### (c) Use Zod's `.describe()` or `.meta()` API
Zod 3.x has `.describe(description: string)`. Zod 4.x has `.meta(object)` for typed metadata. The lib encodes the human mode in the schema's metadata. `z.human(z.string())` is `z.string().meta({ human: "writeable" })`.

**My read**: most principled. But:
- Zod 3.x: `.meta()` doesn't exist. The lib would have to use `.describe()` and parse the description string, which is fragile.
- Zod 4.x: `.meta()` exists, but Zod 4 is still in development. Depend on Zod 4 only when it's stable.

If we target Zod 3.x: (a) is the right call.
If we target Zod 4.x: (c) is the right call.

## Recommendation

**(a) Mutate the schema's `_def.humanMode`, with a clone to avoid shared-mutation issues.**

Target Zod 3.x for v1. Zod 4.x is a v1.1+ consideration.

The `human()` function clones the schema, mutates the clone's `_def`, and returns the clone. `.verified()` mutates the same `_def` in place and returns the schema. The type-level `__humanMode` is for compile-time hints; the runtime `_def.humanMode` is what the lib reads.

```ts
import type { z, ZodTypeAny } from "zod"

export type HumanMode = "writeable" | "verified"

export type HumanSchema<T extends ZodTypeAny> = T & {
  readonly __humanMode: HumanMode
  verified(): HumanSchema<T>
}

export function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
  const wrapped = (schema as any).clone?.() ?? schema
  ;(wrapped._def as any).humanMode = "writeable"
  ;(wrapped as any).verified = function(this: HumanSchema<T>) {
    ;(this._def as any).humanMode = "verified"
    return this
  }
  return wrapped as HumanSchema<T>
}

declare module "zod" {
  namespace z {
    function human<T extends ZodTypeAny>(schema: T): HumanSchema<T>
  }
}
```

The lib reads `(schema._def as any).humanMode` to populate the human fields at `init()` time.

## The "human-editable with upstream seed" case (named here)

`HumanMode` is `"writeable" | "verified"`. Both modes mean "the field is human-editable." What `HumanMode` does *not* say is whether the field has a *seed* — an initial value the human can accept, override, or leave alone.

A seed comes from one of three places:
- A `from_node` source — the upstream node's `finalOutput` flows into this field.
- A `literal` source — the workflow author hardcoded a default.
- A `human` source with no value yet — no seed; the human must provide one.

The third case is a `pending` human field. The first two are seeds. The renderer needs to know whether a seed exists, because the UX differs: a seeded value can be rendered as "Proposed: <value>" or as a confirmation step; an empty value is an empty input.

The lib exposes the seed through `InputSource.kind` (TASK-H) and the human-mode through `HumanMode`. The renderer composes the two to answer "is this a proposal?" The lib does *not* invent a `proposed: boolean` flag (the original D8 suggestion), because the flag conflates the source question ("where did this value come from?") with the editability question ("can the human change it?"). The discriminated union in TASK-S's `getHumanInputDisplay` is the typed join between the two.

This paragraph is named here, in the `HumanMode` plan, because every later human-input discussion needs the seed-vs-no-seed vocabulary and shouldn't have to re-derive it.

## What "done" looks like

### Patches

1. **`docs/design.md`** — schemas section. Add a "runtime implementation" subsection. Explain the clone-and-mutate pattern. Note the Zod 3.x target.

2. **`src/stub.ts`** — replace the `declare module` block with the actual `human()` function. Add the import for `ZodTypeAny` if missing.

3. **`src/stub.ts`** — add a helper `getHumanMode(schema: ZodTypeAny): HumanMode | undefined` that reads the runtime marker. The lib's `init()` (post-Phase-2) uses this to walk the input schema.

### Verification

- `tsc --noEmit` exit 0.
- A unit test (post-Phase-2): `getHumanMode(z.human(z.string())._def)` returns `"writeable"`. `getHumanMode(z.human(z.string()).verified()._def)` returns `"verified"`. `getHumanMode(z.string()._def)` returns `undefined`.

## Session state

*(to be filled in during the design session)*
