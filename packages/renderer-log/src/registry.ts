// @underwai/renderer-log — registry.ts
//
// The kind -> text registry. Each renderer takes a Node and an
// indent level (for tree printing) and returns a string. The
// default renderer prints "<indent><kind> (<status>)".
import type { Node } from "@underwai/core";

export type KindTextRenderer = (node: Node, indent: number) => string;

const registry = new Map<string, KindTextRenderer>();

export function registerKind(kind: string, fn: KindTextRenderer): () => void {
  registry.set(kind, fn);
  return () => {
    registry.delete(kind);
  };
}

export function getKindRenderer(kind: string): KindTextRenderer | undefined {
  return registry.get(kind);
}

export function clearRegistry(): void {
  registry.clear();
}

export function defaultRenderer(node: Node, indent: number): string {
  return `${"  ".repeat(indent)}${node.kind} (${node.status.kind})`;
}
