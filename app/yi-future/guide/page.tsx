/**
 * Yi Future 6.0 — "How to use the platform" full-page guide (one smart page).
 *
 * Opens on the VIEWER's own lane, detected from the EXISTING auth surfaces (no
 * new auth logic):
 *   - national → Supabase user with an active future_admin / future_super_admin
 *     / platform_super_admin role (resolveFutureAccessOrNull → isNational)
 *   - chapter  → Supabase user on an active future.chapter_core_team row
 *     (resolveFutureAccessOrNull → chapterIds)
 *   - delegate / mentor / jury / partner → the `yifuture_session` access-code
 *     cookie (readSession)
 *   - logged-out / unknown → delegate (the largest audience, the sensible
 *     default landing lane)
 *
 * Reachable by anyone; the persona switcher lets a viewer read (and print) any
 * lane. The adoption layer (checkable steps + saved progress + a guide_events
 * funnel) is ON: it persists per Supabase-auth user (national / chapter). The
 * access-code personas have no auth.uid(), so for them progress degrades to
 * in-browser/ephemeral — events still log anonymously. (Director decision
 * 2026-06-14: standard install.)
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { readSession } from "@/app/yi-future/actions/auth";
import { GUIDES } from "@/lib/yi-future/guide/content";
import {
  GUIDE_PERSONAS,
  isGuidePersona,
  type GuideBook,
  type GuidePersona,
} from "@/lib/yi-future/guide/types";
import { GuideView } from "@/app/yi-future/_components/GuideView";
import {
  getCompletedSteps,
  toggleStep,
  logGuideEvent,
} from "@/lib/yi-future/guide/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "How to use Yi Future 6.0" };

const BASE_PATH = "/yi-future/guide";

// Activation checklist: checkable steps + progress + instrumentation. Persists
// per Supabase-auth user; degrades gracefully for access-code personas.
const TRACK_PROGRESS = true;

/** Where "Back" returns to, per lane. */
const PERSONA_HOME: Record<GuidePersona, string> = {
  national: "/yi-future/national/admin",
  chapter: "/yi-future/chapter",
  delegate: "/yi-future/me",
  mentor: "/yi-future/mentor",
  jury: "/yi-future/jury",
  partner: "/yi-future/partner",
};

async function detectLane(): Promise<GuidePersona> {
  // National / chapter admins are Supabase Auth users.
  try {
    const access = await resolveFutureAccessOrNull();
    if (access) {
      if (access.isNational) return "national";
      if (access.chapterIds.length > 0) return "chapter";
    }
  } catch {
    // fall through to access-code session detection
  }

  // Delegates / mentors / jury / partners carry the yifuture_session cookie.
  try {
    const session = await readSession();
    if (session) {
      if (session.type === "delegate") return "delegate";
      if (session.type === "mentor") return "mentor";
      if (session.type === "jury") return "jury";
      if (session.type === "partner") return "partner";
    }
  } catch {
    // fall through to default
  }

  // Logged-out / unknown → delegate, the largest-audience default lane.
  return "delegate";
}

export default async function YiFutureGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: requestedRaw } = await searchParams;
  const ownPersona = await detectLane();

  // Every lane is instructional (no `requires` gate) — all six are switchable.
  const visible: GuidePersona[] = [...GUIDE_PERSONAS];
  const persona: GuidePersona = isGuidePersona(requestedRaw)
    ? requestedRaw
    : ownPersona;

  // Completed steps for the active lane (empty for access-code / logged-out).
  const completed = TRACK_PROGRESS ? await getCompletedSteps(persona) : [];

  return (
    <main className="min-h-screen bg-[#FEFCF6]">
      {/* Gold top accent */}
      <div className="h-1.5 bg-[#F5A623]" />

      {/* Header */}
      <header className="border-b border-[#1a1a3e]/8 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            href={PERSONA_HOME[ownPersona]}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1a1a3e]/60 transition-colors hover:text-[#1a1a3e]"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#1a1a3e]">
              <span className="text-sm font-bold text-[#F5A623]">F6</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-[#1a1a3e]">Yi Future 6.0</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#F5A623]">
                Young Indians
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <GuideView
          // Remount per lane: re-seeds progress state + the guide_open /
          // lane_complete effect refs (a ?persona= switch is a soft nav that
          // would otherwise reconcile this instance in place).
          key={persona}
          guides={GUIDES as GuideBook}
          persona={persona}
          visiblePersonas={visible}
          basePath={BASE_PATH}
          scopeFallbackHref={PERSONA_HOME[ownPersona]}
          trackProgress={TRACK_PROGRESS}
          initialCompleted={completed}
          onToggleStep={toggleStep}
          onEvent={logGuideEvent}
        />
      </div>
    </main>
  );
}
