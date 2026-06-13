"use client";

/**
 * Yi Youth Academy guide — optimistic progress hook.
 *
 * Holds the viewer's completed-step set, updates the UI instantly on toggle, and
 * persists + instruments out-of-band. All optional: no `onToggle` → ephemeral
 * (in-memory) progress; no `onEvent` → nothing logged. The server actions are
 * passed in from the page so this stays import-agnostic and fails soft.
 */
import * as React from "react";
import type { GuideEvent, GuideLane } from "@/lib/yuva/guide/content";

export interface GuideProgressApi {
  completed: ReadonlySet<string>;
  /** Toggle one step's completion (optimistic) + persist + emit the event. */
  toggle: (stepKey: string) => void;
  /** Emit an instrumentation event (persona is filled in for you). */
  emit: (event: Omit<GuideEvent, "persona">) => void;
}

export function useGuideProgress(opts: {
  persona: GuideLane;
  surface: GuideEvent["surface"];
  initialCompleted?: string[];
  onToggle?: (
    persona: GuideLane,
    stepKey: string,
    done: boolean
  ) => Promise<unknown> | void;
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
}): GuideProgressApi {
  const { persona, surface, initialCompleted, onToggle, onEvent } = opts;
  const [completed, setCompleted] = React.useState<Set<string>>(
    () => new Set(initialCompleted ?? [])
  );

  const emit = React.useCallback(
    (event: GuideEvent) => {
      try {
        void Promise.resolve(onEvent?.(event)).catch(() => {});
      } catch {
        /* analytics must never break the UI */
      }
    },
    [onEvent]
  );

  const emitPartial = React.useCallback(
    (event: Omit<GuideEvent, "persona">) => emit({ ...event, persona }),
    [emit, persona]
  );

  const toggle = React.useCallback(
    (key: string) => {
      const willBeDone = !completed.has(key);
      // Pure updater — no side effects (React double-invokes updaters in dev).
      setCompleted((prev) => {
        const next = new Set(prev);
        if (willBeDone) next.add(key);
        else next.delete(key);
        return next;
      });
      try {
        void Promise.resolve(onToggle?.(persona, key, willBeDone)).catch(
          () => {}
        );
      } catch {
        /* persistence failure must not block the optimistic UI */
      }
      emit({
        name: willBeDone ? "step_complete" : "step_uncomplete",
        persona,
        surface,
        stepKey: key,
      });
    },
    [completed, persona, surface, onToggle, emit]
  );

  return React.useMemo(
    () => ({ completed, toggle, emit: emitPartial }),
    [completed, toggle, emitPartial]
  );
}
