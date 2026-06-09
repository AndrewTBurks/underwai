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
// The legacy compose/run/chain shims were removed (TASK-40). Per
// principle-migrate-callers-then-delete-legacy-apis, the migration
// happens in the same wave that drops the shims.
//
// Type safety: TIn/TOut are derived from the Zod schemas in the
// `node()` factory. The bridge's TInChild is checked against the
// child's input schema. Path threading: each .chain() extends the
// path map with the new node's output type. The `view` method on
// the typed tree reads a node by key with the declared output type.

import type { Effect } from "effect";
import type { z, ZodTypeAny, ZodTypeDef } from "zod";
import { NodeKey as nodeKeyCtor, type NodeKey } from "./keys.js";
import type {
  CompositionTree,
  Edge,
  NodeDefinition,
  NodeRef,
  WorkflowState,
} from "./types.js";

export type { NodeDefinition, NodeRef } from "./types.js";

// Re-export for ergonomic import.
export type { CompositionTree, WorkflowState } from "./types.js";

// Keys are imported by name (no re-export — keys.ts owns them).

// `ZodType<T, ZodTypeDef, T>` is the three-arg form: Output, Def,
// Input. Pinning Output = Input = T tells TS to infer T as the
// *literal* schema output (e.g. `{ name: string }`), not the loose
// ZodObject's internal type. Without this, z.object({ name:
// z.string() }) infers T as `{ [x: string]: any; name?: unknown }`
// because Zod's input vs. output distinction bleeds into the
// simple `ZodType<T>` form.
type StrictZodType<T> = z.ZodType<T, ZodTypeDef, T>;

// TypedPaths<PathMap> is a phantom type carried in the builder's
// return value. PathMap is a type-level record like { root:
// string, "root.display": string } that maps each path to its
// declared output type.
export type TypedPaths<PathMap> = {
  readonly __paths: PathMap;
};

// Helper: extract the path map type from a TypedPaths.
export type PathsOf<T> = T extends TypedPaths<infer P> ? P : never;

// A typed view of a node. The runtime's WorkflowState stores
// status.finalOutput as unknown; the typed view narrows it to
// the declared output type. The TypedTree's `view` method picks
// the right TOut from the path map.
export type TypedNode<TOut> = {
  status:
    | { kind: "pending" }
    | { kind: "running" }
    | { kind: "resolved"; finalOutput: TOut; resolvedAt: string }
    | { kind: "failed"; error: unknown }
    | { kind: "streaming"; output: TOut; outputPartial: boolean }
    | { kind: "stale"; previousOutput?: TOut }
    | { kind: "paused"; pausedAt: string };
  input: { value: unknown };
};

// The TypedTree is the build() return value. It carries the
// composition tree (for the runtime) and the typed path map
// (for the consumer's view). view() is a method on this object.
export type TypedTree<Path extends string, PathMap extends Record<string, unknown>> = {
  tree: CompositionTree;
  root: NodeRef<Path>;
  paths: TypedPaths<PathMap>;
  view<K extends keyof PathMap & string>(
    state: WorkflowState,
    key: K,
  ): TypedNode<PathMap[K]>;
};

// Builder state. A single Builder is consumed by .build().
type BuilderState = {
  defs: Map<NodeKey, NodeDefinition>;
  edges: Edge[];
};

// The root of a builder. .run() creates the root node and returns
// a ChainBuilder (which can .chain() children). `kind` is required
// so the root has a name; it does not appear in the path (paths
// start with "root").
export type RootBuilder = {
  run<TIn, TOut, K extends string>(
    def: NodeDefinition<TIn, TOut, K>,
  ): ChainBuilder<"root", TOut, { root: TOut }>;
};

// ChainBuilder<Path, TOut, PathMap> — TOut is the output type of
// the last node in the chain. TOut isn't read by the public API
// (the runtime uses unknown), but it's kept for forward-compat:
// a future v1.1+ could expose `lastOutput: TOut` on the builder
// for read-after-build patterns.
export type ChainBuilder<
  Path extends string,
  _TOut,
  PathMap extends Record<string, unknown>,
> = {
  chain<K extends string, TInChild, TOutChild>(
    def: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  chain<TIn, TInChild, K extends string, TOutChild>(
    bridge: (parentOut: TIn) => TInChild,
    def: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  // fork: create a sibling of the current node. The sibling
  // is fed from the same parent (if any). Use fork to express
  // true parallel branches. The new sibling becomes the new
  // chain path (further .chain() / .join() extend from the
  // sibling).
  fork<K extends string, TInChild, TOutChild>(
    def: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  fork<TIn, TInChild, K extends string, TOutChild>(
    bridge: (parentOut: TIn) => TInChild,
    def: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
  build(): TypedTree<Path, PathMap>;
  /**
   * join: combine the current node's output with sibling node
   * outputs into a single composite input. The keys in
   * `siblings` are the names under which each parent's value
   * appears in the composite.
   *
   * The child def's input type must be a record type matching
   * the shape produced by the runtime's resolveInput (a record
   * mapping each parent's path to its resolved output). The
   * consumer writes this shape explicitly; the type system
   * doesn't try to infer it from the siblings.
   */
  join<TComposite, K extends string, TOutChild>(
    siblings: Record<string, NodeRef>,
    def: NodeDefinition<TComposite, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }>;
};

// workflow(): the entry point. Returns a RootBuilder with no
// node yet. The caller calls .run() to create the root.
export function workflow(): RootBuilder {
  return {
    run(def) {
      const state: BuilderState = { defs: new Map(), edges: [] };
      recordDef(state, nodeKeyCtor("root"), def, null, undefined);
      return makeChain(state, nodeKeyCtor("root"), { root: undefined as never }) as never;
    },
  };
}function makeChain<Path extends string, _TOut, PathMap extends Record<string, unknown>>(
  state: BuilderState,
  path: NodeKey<Path>,
  _paths: PathMap,
): ChainBuilder<Path, _TOut, PathMap> {
  function chainImpl<TIn, TInChild, K extends string, TOutChild>(
    arg1:
      | NodeDefinition<TInChild, TOutChild, K>
      | ((parentOut: TIn) => TInChild),
    arg2?: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }> {
    let def: NodeDefinition<TInChild, TOutChild, K> & { kind: K };
    let bridge: ((parentOut: unknown) => unknown) | undefined;
    if (typeof arg1 === "function") {
      bridge = arg1 as (parentOut: unknown) => unknown;
      def = arg2 as NodeDefinition<TInChild, TOutChild, K> & { kind: K };
    } else {
      def = arg1;
    }
    const childKey = `${path as unknown as string}.${def.kind}` as NodeKey<
      `${Path}.${K}`
    >;
    recordDef(state, childKey, def, path, bridge);
    return makeChain(state, childKey, _paths) as never;
  }
  // fork: create a sibling of the current node, both fed from
  // the same parent. This produces a true parallel branch.
  // The sibling's path is the same prefix but with the new
  // kind appended. The composite paths in PathMap are also
  // updated.
  function forkImpl<TIn, TInChild, K extends string, TOutChild>(
    arg1:
      | NodeDefinition<TInChild, TOutChild, K>
      | ((parentOut: TIn) => TInChild),
    arg2?: NodeDefinition<TInChild, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }> {
    let def: NodeDefinition<TInChild, TOutChild, K> & { kind: K };
    let bridge: ((parentOut: unknown) => unknown) | undefined;
    if (typeof arg1 === "function") {
      bridge = arg1 as (parentOut: unknown) => unknown;
      def = arg2 as NodeDefinition<TInChild, TOutChild, K> & { kind: K };
    } else {
      def = arg1;
    }
    // The fork's child path is the same shape as chain's,
    // but its parent in the edges is the *parent of the
    // current node* — making it a sibling, not a descendant.
    const childKey = `${path as unknown as string}.${def.kind}` as NodeKey<
      `${Path}.${K}`
    >;
    // Find the parent of `path` by looking up its incoming edge.
    let parentKey: NodeKey<string> | null = null;
    for (const e of state.edges) {
      if (e.to === path) {
        parentKey = e.from as NodeKey<string>;
        break;
      }
    }
    if (parentKey) {
      // Sibling: same parent, with a bridge from the parent.
      recordDef(state, childKey, def, parentKey, bridge);
    } else {
      // path is the root; fork is also a root child (root's
      // own chain is allowed, but two root children would
      // mean two roots — fall back to a child of root).
      recordDef(state, childKey, def, path, bridge);
    }
    return makeChain(state, childKey, _paths) as never;
  }
  function joinImpl<TComposite, K extends string, TOutChild>(
    siblings: Record<string, NodeRef>,
    def: NodeDefinition<TComposite, TOutChild, K> & { kind: K },
  ): ChainBuilder<`${Path}.${K}`, TOutChild, PathMap & { [P in `${Path}.${K}`]: TOutChild }> {
    const childKey = `${path as unknown as string}.${def.kind}` as NodeKey<
      `${Path}.${K}`
    >;
    if (!state.defs.has(childKey)) {
      state.defs.set(childKey, def as unknown as NodeDefinition);
    }
    // Build a set of upstream keys to dedupe: the chain's
    // current path is one upstream; the named siblings are
    // additional upstreams. If a sibling is the same as the
    // chain path, we don't add a duplicate edge.
    const upstreamKeys = new Set<NodeKey<string>>();
    upstreamKeys.add(path as NodeKey<string>);
    for (const sib of Object.values(siblings)) {
      upstreamKeys.add(sib.key as NodeKey<string>);
    }
    for (const from of upstreamKeys) {
      const edge: Edge = { from, to: childKey };
      state.edges.push(edge);
    }
    return makeChain(state, childKey, _paths) as never;
  }
  const builder = {
    chain: chainImpl as ChainBuilder<Path, _TOut, PathMap>["chain"],
    join: joinImpl as ChainBuilder<Path, _TOut, PathMap>["join"],
    fork: forkImpl as ChainBuilder<Path, _TOut, PathMap>["chain"],
    build(): TypedTree<Path, PathMap> {
      const rootRef: NodeRef<Path> = { key: path };
      return {
        tree: {
          root: rootRef,
          defs: state.defs,
          edges: state.edges,
        },
        root: rootRef,
        paths: { __paths: _paths },
        view(state, key) {
          const k = key as unknown as NodeKey;
          const node = state.nodes.get(k);
          if (!node) {
            return { status: { kind: "pending" }, input: { value: undefined } };
          }
          return node as unknown as TypedNode<PathMap[typeof key]>;
        },
      };
    },
  };
  return builder as ChainBuilder<Path, _TOut, PathMap>;
}

function recordDef<TIn, TOut, K extends string>(
  state: BuilderState,
  key: NodeKey<string>,
  def: NodeDefinition<TIn, TOut, K>,
  parentKey: NodeKey<string> | null,
  bridge: ((parentOut: unknown) => unknown) | undefined,
): void {
  state.defs.set(key as NodeKey, def as unknown as NodeDefinition<unknown, unknown, string>);
  if (parentKey) {
    const edge: Edge = bridge ? { from: parentKey as NodeKey, to: key as NodeKey, bridge } : { from: parentKey as NodeKey, to: key as NodeKey };
    state.edges.push(edge);
  }
}

// --- node(): the type-safe def factory. ---

// Mode 1: single schema (input and output are the same type).
export function node<K extends string, T>(opts: {
  kind: K;
  schema: StrictZodType<T>;
  program: (input: T) => Effect.Effect<T, Error, never>;
}): NodeDefinition<T, T, K>;

// Mode 2: separate input and output schemas (transform).
export function node<K extends string, TIn, TOut>(opts: {
  kind: K;
  schema: StrictZodType<TIn>;
  outputSchema: StrictZodType<TOut>;
  program: (input: TIn) => Effect.Effect<TOut, Error, never>;
}): NodeDefinition<TIn, TOut, K>;

export function node(opts: {
  kind: string;
  schema: z.ZodType;
  outputSchema?: z.ZodType;
  program: (input: unknown) => Effect.Effect<unknown, Error, never>;
}): NodeDefinition {
  const { kind, schema, outputSchema, program } = opts;
  return {
    kind,
    inputSchema: schema as ZodTypeAny,
    outputSchema: (outputSchema ?? schema) as ZodTypeAny,
    program: program as (input: unknown) => Effect.Effect<unknown, Error, never>,
  };
}
