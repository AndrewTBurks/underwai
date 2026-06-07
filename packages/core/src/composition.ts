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

import type { Effect } from "effect"
import type { ZodType, z } from "zod"
import { NodeKey as nodeKeyCtor, type NodeKey } from "./keys.js"

export type NodeRef<Path extends string = string> = {
  readonly key: NodeKey<Path>
}

export type NodeDefinition<TInput = unknown, TOutput = unknown> = {
  kind: string
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  program: (input: TInput) => Effect.Effect<TOutput, Error, never>
}

// run: create the root node. The path is "root".
export function run<S extends ZodType>(
  _def: NodeDefinition<z.infer<S>, unknown>,
): NodeRef<"root"> {
  return { key: nodeKeyCtor("root") as NodeKey<"root"> }
}

// chain: connect a child to a parent. The child path is `${P}.${K}`.
// Two overloads: direct match and bridge function.
export function chain<P extends string, K extends string, S extends ZodType>(
  parent: NodeRef<P>,
  def: NodeDefinition<z.infer<S>, unknown> & { kind: K },
): NodeRef<`${P}.${K}`>
export function chain<P extends string, TOut, TIn, K extends string>(
  parent: NodeRef<P>,
  _bridge: (parentOut: TOut) => TIn,
  def: NodeDefinition<TIn, unknown> & { kind: K },
): NodeRef<`${P}.${K}`>
export function chain(
  parent: NodeRef<string>,
  arg2:
    | (NodeDefinition<unknown, unknown> & { kind: string })
    | ((parentOut: unknown) => unknown),
  arg3?: NodeDefinition<unknown, unknown> & { kind: string },
): NodeRef<string> {
  const def = (arg3 ?? (arg2 as NodeDefinition<unknown, unknown>)) as
    | NodeDefinition<unknown, unknown>
    & { kind: string }
  return {
    key: nodeKeyCtor(`${parent.key as string}.${def.kind}`) as NodeKey<string>,
  }
}

// all: produce a node whose path is parent's path + ".all".
export function all<P extends string>(
  parent: NodeRef<P>,
  ..._refs: [...NodeRef[]]
): NodeRef<`${P}.all`>
export function all<P extends string>(
  parent: NodeRef<P>,
  _refs: Record<string, NodeRef>,
): NodeRef<`${P}.all.${string}`>
export function all(
  parent: NodeRef<string>,
  ..._args: unknown[]
): NodeRef<string> {
  return {
    key: nodeKeyCtor(`${parent.key as string}.all`) as NodeKey<string>,
  }
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
  return {
    key: nodeKeyCtor(`${parent.key as string}.${_kind}`) as NodeKey<`${P}.${K}`>,
  }
}
