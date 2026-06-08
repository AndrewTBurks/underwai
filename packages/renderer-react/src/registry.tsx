// @underwai/renderer-react — registry.tsx
//
// The renderer registry: kind -> (state, node) -> ReactElement.
// Consumers register renderers per kind; the auto-render walks
// the DAG and asks the registry for each node's renderer.
import { createElement, type ReactElement, type ReactNode } from "react";
import type { Node, WorkflowState } from "@underwai/core";

export type KindRenderer = (state: WorkflowState, node: Node) => ReactElement;

const registry = new Map<string, KindRenderer>();

export function registerKind(kind: string, fn: KindRenderer): () => void {
  registry.set(kind, fn);
  return () => {
    registry.delete(kind);
  };
}

export function getKindRenderer(kind: string): KindRenderer | undefined {
  return registry.get(kind);
}

export function clearRegistry(): void {
  registry.clear();
}

// Default renderer for unknown kinds: a <pre> with the node's status.
export function defaultRenderer(_state: WorkflowState, node: Node): ReactElement {
  return createElement(
    "pre",
    { key: (node.id as unknown as string) ?? node.kind },
    `${node.kind} (${node.status.kind})`,
  );
}

// Default-render element. Used by consumers who want to render a
// node without a custom renderer. (The internal auto-render uses
// defaultRenderer directly.)
export function defaultElement(node: Node): ReactNode {
  return defaultRenderer({} as WorkflowState, node);
}
