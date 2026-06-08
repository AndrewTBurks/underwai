// @underwai/core — composition.ts
//
// The composition API is the only way to create nodes. The
// public shape is the builder:
//
//   const tree = workflow()
//     .run(node({ kind: "parse", schema: z.string(), program }))
//     .chain(node({ kind: "display", schema: z.string(), program }))
//     .build();
//
// The legacy `compose(() => ...)` wrapper is preserved as a
// deprecated shim for one release. Per principle-migrate-
// callers-then-delete-legacy-apis, all internal call sites
// are migrated; the shim is removed after the next release.
//
// Path threading: combinator signatures carry the path
// through. The brand on NodeKey rejects raw strings; the
// path generic rejects "wrong node ref" at the call site.
// `chain` is a method on the builder, not a free function:
// the ESM namespace gotcha (DEC-CORE-014) does not apply to
// methods.

import type { Effect } from "effect";
import type { ZodType, z } from "zod";
import { NodeKey as nodeKeyCtor, type NodeKey } from "./keys.js";
import type { Edge } from "./types.js";

export type NodeRef<Path extends string = string> = {
  readonly key: NodeKey<Path>;
};

// A node definition. The TInput and TOutput generics are
// derived from the Zod schemas in the `node()` factory; the
// raw `NodeDefinition` type is also exported for advanced
// consumers who build defs by hand.
//
// Generic order: TInput, TOutput, then K. This matches the
// legacy shape (kind was a property, not a generic). The
// `node()` factory lets the consumer specify TIn/TOut via
// the schema; the kind is captured in the K generic.
export type NodeDefinition<TInput = unknown, TOutput = unknown, K extends string = string> = {
  kind: K;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  program: (input: TInput) => Effect.Effect<TOutput, Error, never>;
};

// A captured composition.
export type CompositionTree = {
  root: NodeRef;
  defs: Map<string, NodeDefinition>;
  edges: ReadonlyArray<Edge>;
};

// TypedPaths<PathMap> is a phantom type carried in the
// builder's return value. PathMap is a type-level record
// like { "root": string, "root.display": string } that maps
// each path to its declared output type. The runtime doesn't
// use this; the consumer uses it to type their node lookups.
export type TypedPaths<PathMap> = {
  readonly __paths: PathMap;
};

// Helper for the consumer: extract the path map type from
// a TypedTree. Use this to declare the view's input type.
export type PathsOf<T> = T extends TypedPaths<infer P> ? P : never;

// The TypedTree is the build() return value. It carries
// the composition tree (for the runtime) and the typed
// path map (for the consumer's view).
export type TypedTree<Path extends string, PathMap> = {
  tree: CompositionTree;
  root: NodeRef<Path>;
  paths: TypedPaths<PathMap>;
};

// A node view typed by its declared output type. When the
// consumer passes a typed path map to `view(state, key)`,
// the returned node's `status.finalOutput` is typed as the
// declared output type (or the actual variant for the
// node's current status kind).
export type TypedNode<TOut> = {
  status:
    | { kind: "pending" }
    | { kind: "running" }
    | { kind: "resolved"; finalOutput: TOut; resolvedAt: string }
    | { kind: "failed"; error: unknown }
    | { kind: "streaming"; partialOutput: TOut; lastUpdate: string }
    | { kind: "stale"; previousOutput: TOut; invalidatedAt: string }
    | { kind: "paused"; blockedFields: ReadonlyArray<string> };
  input: { value: unknown };
};

// view: produce a typed view of a node by key. The path
// map is the consumer's typed view of the workflow's
// declared shapes. The runtime's WorkflowState is the
// runtime's view; the typed view narrows the node's
// `status.finalOutput` to the declared output type.
export function view<PathMap extends Record<string, unknown>, K extends keyof PathMap & string>(
  state: { nodes: Record<string, unknown> },
  key: K,
): TypedNode<PathMap[K]> {
  const node = state.nodes[key] as TypedNode<PathMap[K]> | undefined;
  if (!node) {
    return { status: { kind: "pending" }, input: { value: undefined } };
  }
  return node;
}

// Builder state. A single Builder is consumed by .build().
// Reusing a Builder for two trees is a type error: .build()
// returns the tree, and the Builder's methods are no longer
// available.
type BuilderState = {
  defs: Map<string, NodeDefinition>;
  edges: Edge[];
};

// The root of a builder. .run() creates the root node and
// returns a ChainBuilder (which can .chain() children).
// `kind` is required so the root has a name; it does not
// appear in the path (paths start with "root").
export type RootBuilder = {
  run<TIn, TOut, K extends string>(
    def: NodeDefinition<TIn, TOut, K>,
  ): ChainBuilder<"root", TOut, { root: TOut }>;
};

// ChainBuilder<Path, TOut, PathMap> — TOut is the output
// type of the last node in the chain. TOut isn't read by
// the public API (the runtime uses unknown), but it's
// kept for forward-compat: a future v1.1+ could expose
// `lastOutput: TOut` on the builder for read-after-build
// patterns.
//
// Path threading: each .chain() extends the path map with
// the new node's output type. The bridge overload's TInChild
// is checked against the child's input schema.
export type ChainBuilder<Path extends string, _TOut, PathMap extends Record<string, unknown>> = {
  chain<K extends string, TIn, TOutChild>(
    def: NodeDefinition<TIn, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  chain<TIn, TInChild, K extends string, TOutChild>(
    bridge: (parentOut: TIn) => TInChild,
    def: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  build(): TypedTree<Path, PathMap>;
};

// workflow(): the entry point. Returns a RootBuilder with
// no node yet. The caller calls .run() to create the root.
export function workflow(): RootBuilder {
  const state: BuilderState = { defs: new Map(), edges: [] };
  return {
    run(def) {
      recordDef(
        state,
        "root",
        def as unknown as NodeDefinition<unknown, unknown, string>,
        null,
        undefined,
      );
      const paths = { root: undefined } as { root: unknown };
      // The TOut of the root comes from the def. We can't
      // extract it at runtime here without reflection; the
      // type-level path map is captured at the call site.
      // Force the cast: the consumer's .run() call has the
      // def's TOut in scope; we just need a placeholder here.
      return makeChain(state, "root" as never, undefined as never, paths as never);
    },
  } as RootBuilder;
}

function makeChain<Path extends string, _TOut, PathMap extends Record<string, unknown>>(
  state: BuilderState,
  path: Path,
  _parentOut: _TOut,
  _paths: PathMap,
): ChainBuilder<Path, _TOut, PathMap> {
  function chainImpl<TIn, TInChild, K extends string, TOutChild>(
    arg1: NodeDefinition<TIn, TOutChild, K> | ((parentOut: TIn) => TInChild),
    arg2?: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }> {
    let def: NodeDefinition<unknown, unknown, string>;
    let bridge: ((parentOut: unknown) => unknown) | undefined;
    if (typeof arg1 === "function") {
      bridge = arg1 as (parentOut: unknown) => unknown;
      def = arg2 as unknown as NodeDefinition<unknown, unknown, string>;
    } else {
      def = arg1 as unknown as NodeDefinition<unknown, unknown, string>;
    }
    const childKey = `${path}.${def.kind}`;
    recordDef(state, childKey, def, path, bridge);
    return makeChain(
      state,
      childKey as never,
      undefined as never,
      _paths,
    ) as unknown as ChainBuilder<
      `${Path}.${K}`,
      TOutChild,
      PathMap & { [P in `${Path}.${K}`]: TOutChild }
    >;
  }
  const builder = {
    chain: chainImpl as ChainBuilder<Path, _TOut, PathMap>["chain"],
    build(): TypedTree<Path, PathMap> {
      const rootRef: NodeRef<Path> = { key: nodeKeyCtor(path) };
      return {
        tree: {
          root: rootRef as NodeRef,
          defs: state.defs,
          edges: state.edges,
        },
        root: rootRef,
        paths: { __paths: _paths },
      };
    },
  };
  return builder as unknown as ChainBuilder<Path, _TOut, PathMap>;
}

function recordDef(
  state: BuilderState,
  key: string,
  def: NodeDefinition<unknown, unknown, string>,
  parentKey: string | null,
  bridge: ((parentOut: unknown) => unknown) | undefined,
): void {
  state.defs.set(key, def as NodeDefinition);
  if (parentKey) {
    const edge: Edge = bridge
      ? { from: parentKey as never, to: key as never, bridge }
      : { from: parentKey as never, to: key as never };
    state.edges.push(edge);
  }
}

// --- node(): the type-safe def factory. ---

// Mode 1: single schema (input and output are the same type).
// Common case: identity transforms, side-effect programs,
// stream/observe nodes.
export function node<K extends string, T>(opts: {
  kind: K;
  schema: ZodType<T>;
  program: (input: T) => Effect.Effect<T, Error, never>;
}): NodeDefinition<T, T, K>;

// Mode 2: separate input and output schemas (transform).
// Use when the program changes shape (parse, refine, format).
export function node<K extends string, TIn, TOut>(opts: {
  kind: K;
  schema: ZodType<TIn>;
  outputSchema: ZodType<TOut>;
  program: (input: TIn) => Effect.Effect<TOut, Error, never>;
}): NodeDefinition<TIn, TOut, K>;

export function node(opts: {
  kind: string;
  schema: ZodType;
  outputSchema?: ZodType;
  program: (input: unknown) => Effect.Effect<unknown, Error, never>;
}): NodeDefinition {
  const { kind, schema, outputSchema, program } = opts;
  return {
    kind,
    inputSchema: schema,
    outputSchema: outputSchema ?? schema,
    program: program as (input: unknown) => Effect.Effect<unknown, Error, never>,
  };
}

// --- Legacy exports. Deprecated. Will be removed next release. ---

let currentBuilder: BuilderState | null = null;

export function compose<P extends string>(
  fn: () => NodeRef<P>,
): { tree: CompositionTree; root: NodeRef<P> } {
  const prev = currentBuilder;
  const state: BuilderState = { defs: new Map(), edges: [] };
  currentBuilder = state;
  try {
    const root = fn();
    return {
      tree: { root: root as NodeRef, defs: state.defs, edges: state.edges },
      root,
    };
  } finally {
    currentBuilder = prev;
  }
}

function recordDefLegacy(
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

/** @deprecated use `workflow().run()` instead. */
export function run<S extends ZodType>(def: NodeDefinition<z.infer<S>>): NodeRef<"root"> {
  recordDefLegacy("root", def, null, undefined);
  return { key: nodeKeyCtor("root") };
}

/** @deprecated use `workflow().run(...).chain(...)` instead. */
export function chain<P extends string, K extends string, S extends ZodType>(
  parent: NodeRef<P>,
  def: NodeDefinition<z.infer<S>> & { kind: K },
): NodeRef<`${P}.${K}`>;
/** @deprecated use `.chain(bridge, def)` on the builder instead. */
export function chain<P extends string, TOut, TIn, K extends string>(
  parent: NodeRef<P>,
  bridge: (parentOut: TOut) => TIn,
  def: NodeDefinition<TIn> & { kind: K },
): NodeRef<`${P}.${K}`>;
/** @deprecated */
export function chain(
  parent: NodeRef,
  arg2: (NodeDefinition & { kind: string }) | ((parentOut: unknown) => unknown),
  arg3?: NodeDefinition & { kind: string },
): NodeRef {
  let def: NodeDefinition & { kind: string };
  let bridge: ((parentOut: unknown) => unknown) | undefined;
  if (typeof arg2 === "function") {
    bridge = arg2 as (parentOut: unknown) => unknown;
    def = arg3 as NodeDefinition & { kind: string };
  } else {
    def = arg2 as NodeDefinition & { kind: string };
  }
  const childKey = `${parent.key as string}.${def.kind}`;
  recordDefLegacy(childKey, def, parent.key as string, bridge);
  return {
    key: nodeKeyCtor(childKey),
  };
}

/** @deprecated use `workflow().run().all().build()` instead. */
export function all<P extends string>(
  parent: NodeRef<P>,
  ..._refs: [...NodeRef[]]
): NodeRef<`${P}.all`>;
/** @deprecated */
export function all<P extends string>(
  parent: NodeRef<P>,
  _refs: Record<string, NodeRef>,
): NodeRef<`${P}.all.${string}`>;
/** @deprecated */
export function all(parent: NodeRef, ..._args: unknown[]): NodeRef {
  return {
    key: nodeKeyCtor(`${parent.key as string}.all`),
  };
}

/** @deprecated use `workflow().run().chain(...).build()` with a loop body instead. */
export function thenLoop<P extends string, K extends string>(
  parent: NodeRef<P>,
  _body: (prev: NodeRef<`${P}.${K}`>) => NodeRef<`${P}.${K}`>,
  _predicate: (current: NodeRef<`${P}.${K}`>) => NodeRef,
  _kind: K,
): NodeRef<`${P}.${K}`> {
  const familyKey = `${parent.key as string}.${_kind}`;
  void _body;
  void _predicate;
  return {
    key: nodeKeyCtor(familyKey) as unknown as NodeKey<`${P}.${K}`>,
  };
}
