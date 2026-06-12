import type { NodeKey as NodeKeyT, TypedTree, WorkflowState } from "@underwai/core";

export type ScenarioKind =
  | "research-triage"
  | "incident-join"
  | "data-qa"
  | "human-loop"
  | "linear"
  | "streaming"
  | "wall";

export type Demo<PathMap extends Record<string, unknown> = Record<string, unknown>> = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly differentiator?: string;
  readonly keyMutation?: string;
  readonly scenario?: ScenarioKind;
  readonly built: TypedTree<string, PathMap>;
  readonly setup: () => WorkflowState;
  readonly leafKey: keyof PathMap & string;
  readonly panel:
    | { kind: "input"; label: string; default: string; writeTo: NodeKeyT }
    | { kind: "none" };
  readonly maxConcurrent?: number;
};
