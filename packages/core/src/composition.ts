// @underwai/core — composition.ts
//
// The composition API is the only way to create nodes. It returns
// NodeRef<P> handles, not Node objects. The actual WorkflowState
// construction happens in init() (operations.ts); composition
// describes the DAG shape and types it end-to-end.
//
// Path threading: combinator signatures carry the path through. The
// brand on NodeKey rejects raw strings; the path generic rejects
// "wrong node ref" at the call site. subscribe(state, ref.key, ...)
// is type-checked against the ref's path.
//
// Naming note: this combinator is called `chain` here, not `then`.
// `then` collides with the ESM module namespace's thenable hook
// (Promise.resolve(module).then uses module.then as the resolver),
// which causes vitest/Vite 8 to invoke the function during module
// load. The exported name diverges from the pre-shard stub; the
// design rationale is captured in DEC-CORE-014.
//
// Composing for init(): a consumer wraps the composition expression
// in `compose(() => run(...))`. Inside the wrapper, every run /
// chain / all / thenLoop call records the def (and any bridge) on
// a per-compose Builder. The result of `compose` is a
// CompositionTree: a root NodeRef and a flat list of defs+edges
// that init() walks to build a WorkflowState.

import type { Effect } from "effect";
import type { ZodType, z } from "zod";
import { NodeKey as nodeKeyCtor, type NodeKey } from "./keys.js";
import type { Edge } from "./types.js";

export type NodeRef<Path extends string = string> = {
  readonly key: NodeKey<Path>;
};

export type NodeDefinition<TInput = unknown, TOutput = unknown> = {
  kind: string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  program: (input: TInput) => Effect.Effect<TOutput, Error>;
};

// A captured composition. The root is the final NodeRef; the defs
// map is keyed by the NodeKey string; the edges are the recorded
// chain/bridge/thenLoop connections.
export type CompositionTree = {
  root: NodeRef;
  defs: Map<string, NodeDefinition>;
  edges: ReadonlyArray<Edge>;
};

// Internal: a per-compose builder. Combinators check the module-
// level `currentBuilder` and, if set, record into it.
type Builder = {
  defs: Map<string, NodeDefinition>;
  edges: Edge[];
};

let currentBuilder: Builder | null = null;

// compose: run a composition expression and capture its defs and
// edges. The returned CompositionTree is what init() consumes.
// Composition expressions written outside compose() still work —
// they just don't record into a builder.
export function compose<P extends string>(
  fn: () => NodeRef<P>,
): { tree: CompositionTree; root: NodeRef<P> } {
  const prev = currentBuilder;
  const builder: Builder = { defs: new Map(), edges: [] };
  currentBuilder = builder;
  try {
    const root = fn();
    return {
      tree: { root: root as NodeRef, defs: builder.defs, edges: builder.edges },
      root,
    };
  } finally {
    currentBuilder = prev;
  }
}

function recordDef(
  key: string,
  def: NodeDefinition,
  parentKey: string | null,
  bridge: ((parentOut: unknown) => unknown) | undefined,
): void {
  if (!currentBuilder) return;
  currentBuilder.defs.set(key, def);
  if (parentKey) {
    const edge: Edge = bridge
      ? { from: parentKey as never, to: key as never, bridge }
      : { from: parentKey as never, to: key as never };
    currentBuilder.edges.push(edge);
  }
}

// run: create the root node. The path is "root".
export function run<S extends ZodType>(def: NodeDefinition<z.infer<S>>): NodeRef<"root"> {
  recordDef("root", def, null, undefined);
  return { key: nodeKeyCtor("root") };
}

// chain: connect a child to a parent. The child path is `${P}.${K}`.
// Two overloads: direct match and bridge function.
export function chain<P extends string, K extends string, S extends ZodType>(
  parent: NodeRef<P>,
  def: NodeDefinition<z.infer<S>> & { kind: K },
): NodeRef<`${P}.${K}`>;
export function chain<P extends string, TOut, TIn, K extends string>(
  parent: NodeRef<P>,
  bridge: (parentOut: TOut) => TIn,
  def: NodeDefinition<TIn> & { kind: K },
): NodeRef<`${P}.${K}`>;
export function chain(
  parent: NodeRef,
  arg2: (NodeDefinition<unknown> & { kind: string }) | ((parentOut: unknown) => unknown),
  arg3?: NodeDefinition<unknown> & { kind: string },
): NodeRef {
  let def: NodeDefinition<unknown> & { kind: string };
  let bridge: ((parentOut: unknown) => unknown) | undefined;
  if (typeof arg2 === "function") {
    bridge = arg2 as (parentOut: unknown) => unknown;
    def = arg3 as NodeDefinition<unknown> & { kind: string };
  } else {
    def = arg2 as NodeDefinition<unknown> & { kind: string };
  }
  const childKey = `${parent.key as string}.${def.kind}`;
  recordDef(childKey, def, parent.key as string, bridge);
  return {
    key: nodeKeyCtor(childKey),
  };
}

// all: produce a node whose path is parent's path + ".all".
export function all<P extends string>(
  parent: NodeRef<P>,
  ..._refs: [...NodeRef[]]
): NodeRef<`${P}.all`>;
export function all<P extends string>(
  parent: NodeRef<P>,
  _refs: Record<string, NodeRef>,
): NodeRef<`${P}.all.${string}`>;
export function all(parent: NodeRef, ..._args: unknown[]): NodeRef {
  // For the tree, "all" is treated as a virtual node. We do not
  // record an "all" def because the consumer specifies the
  // children explicitly via _refs / _refs-record. The init() walk
  // treats "all" as a passthrough; the edges are recorded by the
  // chain calls that produced the children.
  return {
    key: nodeKeyCtor(`${parent.key as string}.all`),
  };
}

// thenLoop: produce a family of nodes whose path is parent's path +
// "." + the body's kind. The family enumeration is the runner's
// job; subscribeSet addresses individual iterations.
export function thenLoop<P extends string, K extends string>(
  parent: NodeRef<P>,
  _body: (prev: NodeRef<`${P}.${K}`>) => NodeRef<`${P}.${K}`>,
  _predicate: (current: NodeRef<`${P}.${K}`>) => NodeRef,
  _kind: K,
): NodeRef<`${P}.${K}`> {
  // For the tree, thenLoop records a def keyed at the family path.
  // The body is captured lazily; init() can't run the body. The
  // consumer is expected to pre-populate the family defs in the
  // tree if they want a runnable family.
  const familyKey = `${parent.key as string}.${_kind}`;
  // No def is recorded here; the family is body-driven.
  void _body;
  void _predicate;
  return {
    key: nodeKeyCtor(familyKey) as unknown as NodeKey<`${P}.${K}`>,
  };
}
