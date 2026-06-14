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
 * lane, so a chapter team can hand the right guide to a delegate, mentor,
 * juror or partner. Each step carries its own deep-link button.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { readSession } from "@/app/yi-future/actions/auth";
import { GUIDES } from "@/lib/yi-future/guide/content";
import { isGuidePersona, type GuidePersona } from "@/lib/yi-future/guide/types";
import { GuideView } from "@/app/yi-future/_components/GuideView";

export const dynamic = "force-dynamic";

export const metadata = { title: "How to use Yi Future 6.0" };

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

  // Anyone may switch to any lane via ?persona= — the page is instructional.
  const persona: GuidePersona = isGuidePersona(requestedRaw)
    ? requestedRaw
    : ownPersona;

  return (
    <main className="min-h-screen bg-ivory">
      {/* Gold top accent */}
      <div className="h-1.5 bg-yi-gold" />

      {/* Header */}
      <header className="border-b border-navy/8 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            href={PERSONA_HOME[ownPersona]}
            className="inline-flex items-center gap-2 text-sm font-medium text-navy/60 transition-colors hover:text-navy"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-navy">
              <span className="text-sm font-bold text-yi-gold">F6</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-navy">Yi Future 6.0</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-yi-gold">
                Young Indians
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <GuideView guides={GUIDES} persona={persona} />
      </div>
    </main>
  );
}
