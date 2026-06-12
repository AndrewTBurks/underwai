import { useEffect, useMemo, useRef, useState } from "react";
import { Effect } from "effect";
import type { NodeKey as NodeKeyT, WorkflowState } from "@underwai/core";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import type { WorkflowEvent } from "@underwai/transport";
import { capture } from "./EventLog.js";
import type { Demo } from "./demo-types.js";

export type DemoRuntimeController = {
  readonly state: WorkflowState | null;
  readonly events: WorkflowEvent[];
  readonly input: string;
  readonly setInput: (value: string) => void;
  readonly run: () => void;
  readonly writeHumanInput: (key: NodeKeyT, value: unknown) => void;
  readonly isPaused: boolean;
  readonly lastEvent: WorkflowEvent | null;
};

export function useDemoRuntime<PathMap extends Record<string, unknown>>(
  demo: Demo<PathMap>,
): DemoRuntimeController {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [input, setInput] = useState(
    demo.panel.kind === "input" ? demo.panel.default : "",
  );
  const [eventTick, setEventTick] = useState(0);
  const [runId, setRunId] = useState(0);
  const prevStateRef = useRef<WorkflowState | null>(null);
  const runtimeRef = useRef<{
    layer: ReturnType<typeof WorkflowRuntimeLive>;
    state: WorkflowState;
    cb: (s: WorkflowState) => void;
  } | null>(null);
  const cbRef = useRef<((s: WorkflowState) => void) | null>(null);

  useEffect(() => {
    setState(null);
    setEvents([]);
    prevStateRef.current = null;
    setInput(demo.panel.kind === "input" ? demo.panel.default : "");
    setRunId(0);
    runtimeRef.current = null;
  }, [demo]);

  useEffect(() => {
    if (runId === 0) return;
    void runDemo(demo, input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function runDemo(d: typeof demo, writeValue: string) {
    if (!runtimeRef.current) {
      const initial = d.setup();
      const layer = WorkflowRuntimeLive({ state: initial });
      const cb = (s: WorkflowState) => {
        if (cbRef.current !== cb) return;
        const prevState = prevStateRef.current;
        prevStateRef.current = s;
        setState(s);
        setEvents((prev) => capture(prev, s, prevState));
        setEventTick((t) => t + 1);
        runtimeRef.current = { layer, state: s, cb };
      };
      cbRef.current = cb;
      runtimeRef.current = { layer, state: initial, cb };
    }
    const { layer, cb } = runtimeRef.current;

    const setupSub = Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      yield* rt.subscribe(cb);
      if (d.panel.kind === "input") {
        yield* rt.write(d.panel.writeTo, writeValue);
      }
      const current = runtimeRef.current?.state ?? d.setup();
      const opts: Parameters<typeof rt.run>[0] =
        d.maxConcurrent === undefined
          ? { state: current }
          : { state: current, maxConcurrent: d.maxConcurrent };
      const s = yield* rt.run(opts);
      if (cbRef.current === cb) {
        const prevState = prevStateRef.current;
        prevStateRef.current = s;
        setState(s);
        setEvents((prev) => capture(prev, s, prevState));
        setEventTick((t) => t + 1);
        if (runtimeRef.current) {
          runtimeRef.current = { layer, state: s, cb };
        }
      }
    });
    await Effect.runPromise(setupSub.pipe(Effect.provide(layer))).catch(
      (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[useDemoRuntime] run failed", e);
      },
    );
  }

  function run() {
    setRunId((r) => r + 1);
  }

  function writeHumanInput(key: NodeKeyT, value: unknown) {
    if (!runtimeRef.current) return;
    const { layer } = runtimeRef.current;
    const effect = Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      const postWrite = yield* rt.writeHumanInput(key, value);
      const current = runtimeRef.current?.state ?? postWrite;
      const opts: Parameters<typeof rt.run>[0] =
        demo.maxConcurrent === undefined
          ? { state: current }
          : { state: current, maxConcurrent: demo.maxConcurrent };
      const result = yield* rt.run(opts);
      return result;
    });
    void Effect.runPromise(effect.pipe(Effect.provide(layer))).catch(
      (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[useDemoRuntime] live edit failed", e);
      },
    );
  }

  const isPaused = useMemo(() => {
    if (!state) return false;
    for (const node of state.nodes.values()) {
      if (node.status.kind === "paused") return true;
    }
    return false;
  }, [state, eventTick]);

  const lastEvent = useMemo<WorkflowEvent | null>(
    () => (events.length > 0 ? (events[0] as WorkflowEvent) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, eventTick],
  );

  return {
    state,
    events,
    input,
    setInput,
    run,
    writeHumanInput,
    isPaused,
    lastEvent,
  };
}
