import { describe, expect, it } from "vitest";
import { z } from "zod";
import { human } from "@underwai/schema";
import { getEnumOptions, getFormFields, unwrapScalarType } from "./index.js";

describe("HumanForm zod schema mapping", () => {
  it("maps primitive zod schemas to form scalar types", () => {
    expect(unwrapScalarType(z.string())).toBe("string");
    expect(unwrapScalarType(z.number())).toBe("number");
    expect(unwrapScalarType(z.boolean())).toBe("boolean");
    expect(unwrapScalarType(z.enum(["Engineering", "Design"]))).toBe("enum");
    expect(unwrapScalarType(z.object({ name: z.string() }))).toBe("object");
    expect(unwrapScalarType(z.array(z.string()))).toBe("array");
  });

  it("extracts enum options from zod enum schemas", () => {
    const schema = z.enum(["Engineering", "Design", "Product", "Operations"]);

    expect(getEnumOptions(schema)).toEqual([
      "Engineering",
      "Design",
      "Product",
      "Operations",
    ]);
  });

  it("maps human object fields to their correct form scalar types", () => {
    const schema = human(
      z.object({
        name: z.string(),
        age: z.number(),
        verified: z.boolean(),
        department: z.enum(["Engineering", "Design"]),
        tags: z.array(z.string()),
      }),
    );

    expect(
      Object.fromEntries(getFormFields(schema).map((field) => [field.fieldKey, field.scalar])),
    ).toEqual({
      name: "string",
      age: "number",
      verified: "boolean",
      department: "enum",
      tags: "array",
    });
  });
});
