// @underwai/renderer-react — auto-render.tsx
//
// <AutoRender state={...} /> walks the DAG and renders each node
// via the registered kind renderer. Unknown kinds render a default.
import { createElement, type ReactElement } from "react";
import type { WorkflowState } from "@underwai/core";
import { defaultRenderer, getKindRenderer } from "./registry.js";

export function AutoRender({ state }: { state: WorkflowState }): ReactElement {
  const children: ReactElement[] = [];
  for (const [, node] of state.nodes) {
    const renderer = getKindRenderer(node.kind) ?? defaultRenderer;
    children.push(renderer(state, node));
  }
  return createElement("div", { "data-auto-render": "true" }, ...children);
}
