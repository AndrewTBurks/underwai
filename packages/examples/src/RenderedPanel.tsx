import type { NodeKey, WorkflowState } from "@underwai/core";
import type { Demo } from "./demo-types.js";
import { ScenarioSurface } from "./ScenarioSurface.js";

export function RenderedPanel<PathMap extends Record<string, unknown>>({
  demo,
  state,
  input,
  onInputChange,
  onRerun,
  onHumanInputChange,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  input: string;
  onInputChange: (s: string) => void;
  onRerun: () => void;
  onHumanInputChange: (key: NodeKey, value: unknown) => void;
  isPaused: boolean;
  scrollToKey: string | null;
  onScrolled: () => void;
}) {
  return (
    <ScenarioSurface
      demo={demo}
      state={state}
      input={input}
      onInputChange={onInputChange}
      onRerun={onRerun}
      onHumanInputChange={onHumanInputChange}
    />
  );
}
