// @underwai/schema — z.human() runtime.
//
// Target: Zod 3.x. Clone the input schema by reconstructing a new
// instance with the same _def + the human-mode marker. The lib
// reads the marker via getHumanMode() at init() time, so the marker
// has to be on the schema's _def, not just in the type. Zod 4.x
// would use .meta({ human: "..." }) instead.

import type { ZodType, ZodTypeAny } from "zod";

export type HumanMode = "writeable" | "verified";

// HumanSchema re-binds T's generics (Output, Def, Input) so the
// intersection with the marker fields does not collapse them. Without
// the rebind, `z.human(z.string()).parse(...)` infers as unknown
// instead of string. The `~standard` and `_def` properties are
// preserved by inheritance from T.
export type HumanSchema<T extends ZodTypeAny> = ZodType<T["_output"], T["_def"], T["_input"]> & {
  readonly __humanMode: HumanMode;
  verified(): HumanSchema<T>;
};

export function getHumanMode(schema: ZodTypeAny): HumanMode | undefined {
  return (schema._def as { humanMode?: HumanMode } | undefined)?.humanMode;
}

function cloneWithMode<T extends ZodTypeAny>(schema: T, mode: HumanMode): HumanSchema<T> {
  const Ctor = Object.getPrototypeOf(schema).constructor as new (def: object) => T;
  const wrapped = new Ctor({ ...schema._def, humanMode: mode }) as unknown as HumanSchema<T>;
  (wrapped as unknown as { verified: () => HumanSchema<T> }).verified = function (
    this: HumanSchema<T>,
  ) {
    return cloneWithMode(this, "verified");
  };
  return wrapped;
}

export function human<T extends ZodTypeAny>(schema: T): HumanSchema<T> {
  return cloneWithMode(schema, "writeable");
}
