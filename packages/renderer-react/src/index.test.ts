// @underwai/renderer-react tests. Per the audit: skip React
// Testing Library; assert on the *call* to render, not the
// rendered DOM. We import React's createElement to inspect
// element types.
import { describe, expect, it, beforeEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { AutoRender, clearRegistry, getKindRenderer, registerKind } from "./index.js";
import { LiveSubscriptionRegistry, NodeKey, WorkflowId } from "@underwai/core";
import type { Node, WorkflowState } from "@underwai/core";
import { z } from "zod";

function makeState(): WorkflowState {
  const make = (k: string): Node => ({
    id: NodeKey(k),
    kind: k,
    inputSchema: z.unknown(),
    input: { value: undefined, schema: z.unknown(), humanFields: new Map() },
    outputSchema: z.unknown(),
    status: { kind: "pending" },
    actor: "system",
    createdAt: "T",
    updatedAt: "T",
  });
  return {
    id: WorkflowId("wf-1"),
    version: 1,
    status: "running",
    nodes: {
      root: make("root"),
      "root.a": make("root.a"),
      "root.b": make("root.b"),
    },
    edges: [],
    edgesByTarget: {},
    edgesByFrom: {},
    createdAt: "T",
    updatedAt: "T",
  };
}

describe("renderer-react", () => {
  beforeEach(() => clearRegistry());

  it("registerKind adds a renderer; getKindRenderer returns it", () => {
    const fn = (_s: WorkflowState, _n: Node) => createElement("div", null, "root");
    registerKind("root", fn);
    const got = getKindRenderer("root");
    expect(got).toBe(fn);
  });

  it("AutoRender walks the DAG and calls each registered kind renderer", () => {
    const calls: string[] = [];
    registerKind("root", (_s, n) => {
      calls.push(n.kind);
      return createElement("div", { "data-kind": "root" });
    });
    registerKind("root.a", (_s, n) => {
      calls.push(n.kind);
      return createElement("div", { "data-kind": "root.a" });
    });
    registerKind("root.b", (_s, n) => {
      calls.push(n.kind);
      return createElement("div", { "data-kind": "root.b" });
    });
    const result: ReactElement = AutoRender({ state: makeState() });
    expect(calls.toSorted()).toEqual(["root", "root.a", "root.b"]);
    expect((result.props as Record<string, unknown>)["data-auto-render"]).toBe("true");
  });

  it("AutoRender uses defaultRenderer for unknown kinds", () => {
    const element: ReactElement = AutoRender({ state: makeState() });
    const children = (element.props as { children: ReactElement[] }).children;
    expect(children.length).toBe(3);
    // Default renders a <pre> with the kind and status.
    expect(children[0]?.type).toBe("pre");
  });
});
