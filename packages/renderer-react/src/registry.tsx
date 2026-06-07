// @underwai/renderer-react — registry.tsx
//
// The renderer registry: kind -> (state, node) -> ReactElement.
// Consumers register renderers per kind; the auto-render walks
// the DAG and asks the registry for each node's renderer.
import { createContext, createElement, type ReactElement, type ReactNode } from "react"
import type { Node, WorkflowState } from "@underwai/core"

export type KindRenderer = (state: WorkflowState, node: Node) => ReactElement

const registry = new Map<string, KindRenderer>()

export function registerKind(kind: string, fn: KindRenderer): () => void {
  registry.set(kind, fn)
  return () => {
    registry.delete(kind)
  }
}

export function getKindRenderer(kind: string): KindRenderer | undefined {
  return registry.get(kind)
}

export function clearRegistry(): void {
  registry.clear()
}

// Default renderer for unknown kinds: a <pre> with the node's status.
export function defaultRenderer(_state: WorkflowState, node: Node): ReactElement {
  return createElement("pre", { key: (node.id as unknown as string) ?? node.kind },
    `${node.kind} (${node.status.kind})`)
}

// RegistryContext: lets <Provider> install a custom registry per
// subtree. If not provided, the global registry is used.
export const RegistryContext = createContext<Map<string, KindRenderer> | null>(null)

export function useRegistry(): Map<string, KindRenderer> {
  const local = React.useContext(RegistryContext)
  return local ?? registry
}

// React import shim. The actual import is in the test file or in
// the consumer; this avoids pulling React into a server bundle.
import * as React from "react"

// Default-render element. Used by AutoRender when no renderer is
// registered for a node's kind.
export function defaultElement(node: Node): ReactNode {
  return defaultRenderer({} as WorkflowState, node)
}
