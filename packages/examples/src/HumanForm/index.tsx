// MultiHumanForm — a beautiful dynamic form component that
// bundles all human() fields for a single node input.
//
// The lib's `human()` schema marker is a property of the *input
// schema*. A node's input can be a primitive (e.g. z.string()) or
// an object (e.g. z.object({ name: z.string(), email: z.string() })).
// When the marker is on an object, the form renders one field per
// object property. When the marker is on a primitive, the form
// renders a single field.
//
// The form is shown for any node with getHumanMode() !== undefined,
// regardless of the node's status (paused, running, resolved).
// Editing a field updates local form state. Pressing the
// send button calls `onChange` with the current full value,
// which the shell wires to rt.writeHumanInput + a re-dispatch.
// runtime's existing markStale path handles the interrupt: any
// downstream node that depends on this one re-derives from the
// new value.
//
// Visual: each field is a label + input pair. The form is
// wrapped in a fieldset with a status pill (paused / live /
// stale). The "paused" state emphasizes the submit affordance
// (no submit — changes auto-propagate). Inputs use
// currentColor for borders and color-mix() for tinted backgrounds
// so the form follows the surrounding theme without hard-coding
// colors.

import { useCallback, useMemo, useState } from "react";
import type { z, ZodTypeAny } from "zod";
import { getHumanMode } from "@underwai/schema";

// FormField is the introspected shape of one input on the form.
// `label` is the human-readable key, `schema` is the zod schema
// for that field, `mode` is the human mode ("writeable" or
// "verified"), and `fieldKey` is the path within the parent
// object (e.g. "name" or "address.city" for nested objects —
// v1.0 only supports flat objects; nested objects render as
// a single unknown field).
export type FormField = {
  fieldKey: string;
  label: string;
  schema: ZodTypeAny;
  mode: "writeable" | "verified";
  scalar: ScalarType;
};

export type ScalarType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "unknown";

type ZodDefCompat = {
  type?: string | ZodTypeAny;
  typeName?: string;
  sourceType?: ZodTypeAny;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  shape?: Record<string, ZodTypeAny> | (() => Record<string, ZodTypeAny>);
  values?: ReadonlyArray<unknown>;
  entries?: Record<string, unknown>;
};

function getDef(schema: ZodTypeAny): ZodDefCompat | undefined {
  return schema._def as ZodDefCompat | undefined;
}

function getZodKind(schema: ZodTypeAny): string | undefined {
  const def = getDef(schema);
  const rawType = def?.type;
  return typeof rawType === "string" ? rawType : def?.typeName;
}

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  const def = getDef(schema);
  const kind = getZodKind(schema);
  if (
    (kind === "ZodEffects" ||
      kind === "effects" ||
      kind === "ZodOptional" ||
      kind === "optional" ||
      kind === "ZodNullable" ||
      kind === "nullable" ||
      kind === "ZodDefault" ||
      kind === "default") &&
    (def?.sourceType || def?.innerType || def?.schema)
  ) {
    return unwrapSchema((def.sourceType ?? def.innerType ?? def.schema) as ZodTypeAny);
  }
  return schema;
}

function readObjectShape(schema: ZodTypeAny): Record<string, ZodTypeAny> | undefined {
  const shape = getDef(schema)?.shape;
  if (typeof shape === "function") return shape();
  return shape;
}

// unwrapScalarType is a public helper that returns the
// "primitive" shape of a zod schema. The form uses this to
// pick an input element (text/number/checkbox/select/etc).
// Supports both Zod v3 (`_def.typeName`) and Zod v4
// (`_def.type`) internals.
export function unwrapScalarType(schema: ZodTypeAny): ScalarType {
  const unwrapped = unwrapSchema(schema);
  const kind = getZodKind(unwrapped);
  if (kind === "ZodString" || kind === "string") return "string";
  if (kind === "ZodNumber" || kind === "number") return "number";
  if (kind === "ZodBoolean" || kind === "boolean") return "boolean";
  if (kind === "ZodEnum" || kind === "enum") return "enum";
  if (kind === "ZodNativeEnum") return "enum";
  if (kind === "ZodObject" || kind === "object") return "object";
  if (kind === "ZodArray" || kind === "array") return "array";
  return "unknown";
}

export function getEnumOptions(schema: ZodTypeAny): string[] {
  const unwrapped = unwrapSchema(schema);
  const def = getDef(unwrapped);
  if (Array.isArray(def?.values)) return def.values.map(String);
  if (def?.entries && typeof def.entries === "object") return Object.values(def.entries).map(String);
  const enumObject = (unwrapped as unknown as { enum?: Record<string, string>; options?: string[] });
  if (Array.isArray(enumObject.options)) return enumObject.options.map(String);
  if (enumObject.enum && typeof enumObject.enum === "object") return Object.values(enumObject.enum).map(String);
  return [];
}

// getFormFields introspects a human-marked schema and returns
// the form's fields. For a human-marked object, returns one
// field per object property. For a human-marked primitive,
// returns a single field with key "value". For other shapes,
// returns a single field with key "value" and a JSON preview.
export function getFormFields(schema: ZodTypeAny): FormField[] {
  const mode = getHumanMode(schema);
  if (mode === undefined) return [];
  const unwrapped = unwrapSchema(schema);
  const shape = readObjectShape(unwrapped);
  if (unwrapScalarType(unwrapped) === "object" && shape) {
    return Object.entries(shape).map(([key, fieldSchema]) => ({
      fieldKey: key,
      label: key,
      schema: fieldSchema as ZodTypeAny,
      mode,
      scalar: unwrapScalarType(fieldSchema as ZodTypeAny),
    }));
  }
  // Single-field: primitive human input
  return [
    {
      fieldKey: "value",
      label: "value",
      schema,
      mode,
      scalar: unwrapScalarType(schema),
    },
  ];
}

type MultiHumanFormProps = {
  schema: ZodTypeAny;
  initialValue: unknown;
  onChange: (value: unknown) => void;
  paused: boolean;
  // Field labels override. Optional; defaults to the field's
  // object key. Use this to surface the demo's intent for the
  // field (e.g. "name" -> "Your name").
  labels?: Record<string, string>;
};

export function MultiHumanForm({
  schema,
  initialValue,
  onChange,
  paused,
  labels,
}: MultiHumanFormProps) {
  const fields = useMemo(() => getFormFields(schema), [schema]);
  // Local state mirrors the form's current values. The form is
  // "owned" by the user — the runtime's resolved output is a
  // side effect, not the source of truth for the input fields.
  // When the schema changes (e.g. demo switch), the local state
  // resets to the new initialValue.
  const initial: Record<string, unknown> = useMemo(() => {
    if (initialValue && typeof initialValue === "object" && !Array.isArray(initialValue)) {
      return { ...(initialValue as Record<string, unknown>) };
    }
    if (fields.length === 1) return { value: initialValue };
    return {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, initialValue]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);

  // The handle updates local form state only. The explicit
  // send button is what writes the value into the runtime.
  const handleFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [fieldKey]: value }));
    },
    [],
  );

  const sendValues = useCallback(() => {
    if (fields.length === 1 && fields[0]?.fieldKey === "value") {
      onChange(values.value);
      return;
    }
    onChange(values);
  }, [fields, onChange, values]);

  if (fields.length === 0) return null;

  return (
    <fieldset className="multi-human-form" data-paused={paused ? "true" : "false"}>
      <legend className="multi-human-form__legend">
        {paused ? "your input" : "live"}
      </legend>
      <div className="multi-human-form__topline">
        <span>{paused ? "pending runtime write" : "staged edits"}</span>
        <button className="multi-human-form__send" type="button" onClick={sendValues}>
          send values to runtime
        </button>
      </div>
      <div className="multi-human-form__fields">
        {fields.map((field) => (
          <FieldRow
            key={field.fieldKey}
            field={field}
            value={values[field.fieldKey]}
            onChange={(v) => handleFieldChange(field.fieldKey, v)}
            displayLabel={labels?.[field.fieldKey] ?? field.label}
          />
        ))}
      </div>
    </fieldset>
  );
}

type FieldRowProps = {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  displayLabel: string;
};

function FieldRow({ field, value, onChange, displayLabel }: FieldRowProps) {
  const inputId = `mhf-${field.fieldKey}`;
  return (
    <label className="multi-human-form__field">
      <span className="multi-human-form__field-label">{displayLabel}</span>
      <ScalarInput
        type={field.scalar}
        schema={field.schema}
        value={value}
        onChange={onChange}
        inputId={inputId}
      />
    </label>
  );
}

type ScalarInputProps = {
  type: ScalarType;
  schema: ZodTypeAny;
  value: unknown;
  onChange: (v: unknown) => void;
  inputId: string;
};

function ScalarInput({ type, schema, value, onChange, inputId }: ScalarInputProps) {
  // For object/array/unknown, render a JSON textarea. The
  // runtime's input.value is unconstrained unknown, so JSON
  // is the most honest representation. A v1.1+ could use a
  // schema-driven field editor for nested objects.
  if (type === "object" || type === "array" || type === "unknown") {
    const stringified = useStableStringify(value);
    return (
      <textarea
        id={inputId}
        className="multi-human-form__input multi-human-form__input--json"
        value={stringified}
        onChange={(e) => {
          // Best-effort parse: keep the raw string in the
          // textarea state and emit the parsed value to
          // onChange. If the parse fails, onChange still
          // receives the raw string; the runtime's
          // validation (or the next program run) surfaces
          // the failure.
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        rows={4}
        spellCheck={false}
      />
    );
  }
  if (type === "boolean") {
    return (
      <input
        id={inputId}
        type="checkbox"
        className="multi-human-form__input multi-human-form__input--checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (type === "number") {
    return (
      <input
        id={inputId}
        type="number"
        className="multi-human-form__input multi-human-form__input--number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
      />
    );
  }
  if (type === "enum") {
    const options = getEnumOptions(schema);
    return (
      <select
        id={inputId}
        className="multi-human-form__input multi-human-form__input--select"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  // Default: text input. The autoFocus on the first field is
  // intentional for the paused case — the form is the user's
  // entry point.
  return (
    <input
      id={inputId}
      type="text"
      className="multi-human-form__input multi-human-form__input--text"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// useStableStringify memoizes the JSON.stringify of a value
// across re-renders. JSON.stringify is fast, but stable
// identity is the property we need: the textarea's
// controlled value should not change reference on every
// render (causing the cursor to jump).
function useStableStringify(value: unknown): string {
  return useMemo(() => {
    if (value === undefined) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
}
