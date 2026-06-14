"use client";

/**
 * Smart Guide — per-module first-entry welcome.
 *
 * The first time someone opens a specific module, this greets them with one
 * dismissible card: what the module is for + a "Show me how" link into its first
 * step. It appears ONCE, then stays out of the way — but the Onboarding launcher
 * can replay it, and a module the user never opened still welcomes them whenever
 * they finally arrive (it's entry-triggered, not first-login-triggered).
 *
 * "Seen" is remembered in the SAME guide_progress table as real steps, under a
 * synthetic `welcomeSeenKey(moduleKey)` (so it syncs across devices), with a
 * localStorage fallback for anonymous / no-progress-layer installs.
 *
 * Two non-negotiables, both encoded below:
 *   - It is a CARD above the content, never a blocking modal — it must never gate
 *     the module. If the seen-check can't be resolved, it fails to HIDDEN (don't
 *     nag), never to a crash.
 *   - It emits `welcome_shown` exactly once (a ref guard survives StrictMode's
 *     double-invoke), and every hook runs before the early return.
 */

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";

import {
  type GuidePersona,
  type GuideEvent,
} from "@/lib/guide/types"; // ← adjust path

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Render `**bold**` spans; everything else is plain text. */
function renderBold(text: string): React.ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

interface ModuleWelcomeProps {
  /** Stable id for THIS module's welcome, e.g. "events" or "finance". */
  moduleKey: string;
  persona: GuidePersona;
  /** Heading, e.g. "Welcome to Events". */
  title: string;
  /** One or two plain sentences. May contain `**bold**`. */
  body: string;
  /** "Show me how" target — the module's first step or its guide section. */
  cta?: { label: string; href: string };
  /**
   * Server-known "already seen" — `completed.has(welcomeSeenKey(moduleKey))`.
   * When defined it is authoritative and localStorage is NOT consulted. Omit it
   * (anonymous / no progress layer) to fall back to localStorage.
   */
  seen?: boolean;
  /** Persist "seen". Install wires this to
   *  `toggleStep(persona, welcomeSeenKey(moduleKey), true)`. */
  onSeen?: () => Promise<unknown> | void;
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  className?: string;
}

const LS_PREFIX = "smartguide:welcome:";

export function ModuleWelcome({
  moduleKey,
  persona,
  title,
  body,
  cta,
  seen,
  onSeen,
  onEvent,
  className,
}: ModuleWelcomeProps) {
  // "pending" until the client resolves seen-state — server renders nothing, so
  // there's no hydration mismatch and no flash of a welcome that's already seen.
  const [phase, setPhase] = React.useState<"pending" | "show" | "hide">("pending");
  const announced = React.useRef(false);

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

  React.useEffect(() => {
    // Resolve "seen" — server prop wins; else localStorage; either failing
    // resolves to HIDDEN (never nag, never crash).
    let alreadySeen: boolean;
    if (seen !== undefined) {
      alreadySeen = seen;
    } else {
      try {
        alreadySeen = window.localStorage.getItem(LS_PREFIX + moduleKey) === "1";
      } catch {
        alreadySeen = true; // can't read → assume seen so we don't nag
      }
    }
    if (alreadySeen) {
      setPhase("hide");
      return;
    }
    setPhase("show");
    if (!announced.current) {
      announced.current = true; // ref guard → fires once even under StrictMode
      emit({ name: "welcome_shown", persona, surface: "welcome", stepKey: moduleKey });
    }
  }, [seen, moduleKey, persona, emit]);

  const markSeen = React.useCallback(() => {
    setPhase("hide");
    // Persist out-of-band; a failure must not break navigation or the UI.
    try {
      if (onSeen) {
        void Promise.resolve(onSeen()).catch(() => {});
      } else {
        window.localStorage.setItem(LS_PREFIX + moduleKey, "1");
      }
    } catch {
      /* best-effort; re-shows at worst */
    }
  }, [onSeen, moduleKey]);

  if (phase !== "show") return null;

  return (
    <div
      role="note"
      aria-label={title}
      className={cx(
        "flex items-start gap-3 rounded-xl border bg-primary/5 p-4",
        className
      )}
    >
      <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{renderBold(body)}</p>
        {cta && (
          <Link
            href={cta.href}
            onClick={() => {
              emit({ name: "nudge_click", persona, surface: "welcome", stepKey: moduleKey });
              markSeen();
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {cta.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          emit({ name: "guide_dismiss", persona, surface: "welcome", stepKey: moduleKey });
          markSeen();
        }}
        aria-label={`Dismiss the ${title} intro`}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
