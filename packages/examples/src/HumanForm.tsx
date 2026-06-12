// HumanForm — legacy single-field form, re-exported as
// `MultiHumanForm` for backward compatibility.
//
// The new component lives at ./HumanForm/index.tsx and supports
// multi-field object schemas. The old single-field scalar form
// is preserved here as `HumanForm` for any external caller
// (none in this repo as of 2026-06-09; tests have been
// updated to use MultiHumanForm).
//
// See ./HumanForm/index.tsx for the canonical implementation.

export {
  MultiHumanForm as HumanForm,
  MultiHumanForm,
  getFormFields,
  unwrapScalarType,
  type FormField,
  type ScalarType,
} from "./HumanForm/index.js";
