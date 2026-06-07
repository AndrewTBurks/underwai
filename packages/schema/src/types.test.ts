// Compile-time type test for the @underwai/schema package. Tests
// verify the type-level contract; runtime cost is 0.
import { z } from "zod";
import { describe, expectTypeOf, it } from "vitest";
import { human } from "./index.js";

describe("human() type-level", () => {
  it("returns a schema with the HumanSchema brand", () => {
    const s = human(z.string());
    expectTypeOf(s).toHaveProperty("__humanMode");
    expectTypeOf(s.__humanMode).toEqualTypeOf<"writeable" | "verified">();
  });

  it("verified() returns a HumanSchema with verified() method", () => {
    const s = human(z.string()).verified();
    expectTypeOf(s.verified).toBeFunction();
  });

  it("preserves the inferred output via z.infer", () => {
    const s = human(z.object({ x: z.number(), y: z.string() }));
    type Out = z.infer<typeof s>;
    expectTypeOf<Out>().toEqualTypeOf<{ x: number; y: string }>();
  });

  it("chains verified() and preserves types", () => {
    const s = human(z.object({ x: z.number() })).verified();
    type Out = z.infer<typeof s>;
    expectTypeOf<Out>().toEqualTypeOf<{ x: number }>();
  });
});
