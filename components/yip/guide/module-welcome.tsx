"use client";

/**
 * YIP guide — per-module first-entry welcome.
 *
 * The first time someone opens a module, one dismissible card greets them with
 * what it's for + "Show me how". Shows ONCE (then stays gone), but the Onboarding
 * launcher can replay it, and it's entry-triggered — a module an organiser never
 * opened still welcomes them whenever they finally arrive.
 *
 * "Seen" persists in the SAME guide_progress table under welcomeSeenKey(moduleKey)
 * (syncs across devices) with a localStorage fallback for anonymous viewers.
 * It is a CARD above the content, never a blocking modal — and if its seen-state
 * can't be resolved it fails to HIDDEN (never nag, never crash). `welcome_shown`
 * fires exactly once (a ref guard survives StrictMode); every hook is above the
 * early return.
 *
 * YIP-branded (saffron #FF9933) to match components/yip/guide/* + GuideView.
 */

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";

import { type GuidePersona, type GuideEvent } from "@/lib/yip/guide/types";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Render `**bold**` spans; everything else is plain text. */
function renderBold(text: string): React.ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[#1a1a3e]">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

const LS_PREFIX = "yipguide:welcome:";

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
}: {
  /** Stable id for THIS module's welcome, e.g. "events". */
  moduleKey: string;
  persona: GuidePersona;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  /** Server-known "already seen" — completed.includes(welcomeSeenKey(moduleKey)).
   *  When defined it is authoritative; omit it to fall back to localStorage. */
  seen?: boolean;
  /** Persist "seen": toggleStep(persona, welcomeSeenKey(moduleKey), true). */
  onSeen?: () => Promise<unknown> | void;
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  className?: string;
}) {
  // "pending" until the client resolves seen-state — server renders nothing, so
  // there's no hydration mismatch and no flash of an already-seen welcome.
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
    let alreadySeen: boolean;
    if (seen !== undefined) {
      alreadySeen = seen;
    } else {
      try {
        alreadySeen = window.localStorage.getItem(LS_PREFIX + moduleKey) === "1";
      } catch {
        alreadySeen = true; // can't read → assume seen so we never nag
      }
    }
    if (alreadySeen) {
      setPhase("hide");
      return;
    }
    setPhase("show");
    if (!announced.current) {
      announced.current = true; // fires once even under StrictMode
      emit({ name: "welcome_shown", persona, surface: "welcome", stepKey: moduleKey });
    }
  }, [seen, moduleKey, persona, emit]);

  const markSeen = React.useCallback(() => {
    setPhase("hide");
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
        "flex items-start gap-3 rounded-xl border border-[#FF9933]/30 bg-[#FF9933]/8 p-4",
        className
      )}
    >
      <Sparkles className="mt-0.5 size-5 shrink-0 text-[#FF9933]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1a1a3e]">{title}</p>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">{renderBold(body)}</p>
        {cta && (
          <Link
            href={cta.href}
            onClick={() => {
              emit({ name: "nudge_click", persona, surface: "welcome", stepKey: moduleKey });
              markSeen();
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FF9933] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
        className="shrink-0 rounded-md p-1 text-[#1a1a3e]/40 hover:bg-[#1a1a3e]/8"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
