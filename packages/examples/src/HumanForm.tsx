// HumanForm — a single-field form for a human-paused node.
//
// The lib's human() schema marker is constrained to literal
// primitive types (string, number, boolean, enum). The form
// is a single input with a label and a submit button. The
// value of the input is the node's input value; on submit,
// the shell calls rt.writeHumanInput.

import { useState } from "react";
import type { ZodTypeAny } from "zod";

export function HumanForm({
  schema,
  label,
  onSubmit,
}: {
  schema: ZodTypeAny;
  label: string;
  onSubmit: (value: unknown) => void;
}) {
  const t = unwrapScalarType(schema);
  const [value, setValue] = useState<string>(() =>
    defaultForType(t) as string,
  );
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(coerce(value, t));
  };
  return (
    <form className="human-form" onSubmit={handleSubmit}>
      <label className="human-form__field">
        <span className="human-form__label">{label}</span>
        <ScalarInput type={t} value={value} onChange={setValue} />
      </label>
      <button type="submit" className="human-form__submit">
        submit
      </button>
    </form>
  );
}

function ScalarInput({
  type,
  value,
  onChange,
}: {
  type: ScalarType;
  value: string;
  onChange: (s: string) => void;
}) {
  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === "true"}
        onChange={(e) => onChange(String(e.target.checked))}
      />
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "enum") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="yes">yes</option>
        <option value="no">no</option>
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
    />
  );
}

type ScalarType = "string" | "number" | "boolean" | "enum" | "unknown";

function unwrapScalarType(schema: ZodTypeAny): ScalarType {
  // Zod's internal `_def` is the only public way to inspect
  // the schema variant (ZodString vs ZodNumber vs ZodEffects).
  // The underscore is Zod's convention, not ours.
  // oxlint-disable-next-line eslint(no-underscore-dangle)
  const def = schema._def as
    | { typeName?: string; sourceType?: ZodTypeAny }
    | undefined;
  if (!def) return "unknown";
  if (def.typeName === "ZodEffects" && def.sourceType) {
    return unwrapScalarType(def.sourceType as ZodTypeAny);
  }
  if (def.typeName === "ZodString") return "string";
  if (def.typeName === "ZodNumber") return "number";
  if (def.typeName === "ZodBoolean") return "boolean";
  if (def.typeName === "ZodEnum") return "enum";
  return "unknown";
}

function defaultForType(t: ScalarType): string {
  if (t === "boolean") return "false";
  if (t === "number") return "";
  return "";
}

function coerce(value: string, t: ScalarType): unknown {
  if (t === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (t === "boolean") return value === "true";
  return value;
}
