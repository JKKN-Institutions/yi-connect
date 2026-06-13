/**
 * YIP — "How to use the platform" full-page guide (one smart page).
 *
 * Opens on the VIEWER's own lane, detected from the existing auth surfaces (no
 * new auth logic):
 *   - organiser → Supabase Auth user (lib/yip/supabase/server)
 *   - student / jury / volunteer → the `yip_session` access-code cookie
 *     (lib/yip/auth/yip-session)
 *   - logged-out / unknown → organiser (the sensible default landing lane)
 *
 * The page is reachable by anyone logged in; the persona switcher lets them
 * view (and download the PDF for) any of the four lanes, so a manager can hand
 * the right guide to a student, juror or volunteer. Each step carries its own
 * deep-link button; event-scoped organiser links resolve against the viewer's
 * event when one is in their session, and hide otherwise.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { GUIDES } from "@/lib/yip/guide/content";
import { isGuidePersona, type GuidePersona } from "@/lib/yip/guide/types";
import { GuideView } from "@/app/yip/_components/GuideView";

export const dynamic = "force-dynamic";

export const metadata = { title: "How to use YIP" };

/** Where "Back" returns to, per lane. */
const PERSONA_HOME: Record<GuidePersona, string> = {
  organiser: "/yip/dashboard",
  student: "/yip/me",
  volunteer: "/yip/volunteer",
  jury: "/yip/jury",
};

type DetectedLane = { persona: GuidePersona; eventId: string | null };

async function detectLane(): Promise<DetectedLane> {
  // Organiser identity comes from Supabase Auth.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { persona: "organiser", eventId: null };
  } catch {
    // fall through to cookie detection
  }

  // Students / jury / volunteers carry the yip_session access-code cookie.
  const session = await getYipSession();
  if (session) {
    if (session.type === "participant")
      return { persona: "student", eventId: session.eventId };
    if (session.type === "jury")
      return { persona: "jury", eventId: session.eventId };
    if (session.type === "volunteer")
      return { persona: "volunteer", eventId: session.eventId };
  }

  // Logged-out / unknown → organiser, the sensible default landing lane.
  return { persona: "organiser", eventId: null };
}

export default async function YipGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: requestedRaw } = await searchParams;
  const { persona: ownPersona, eventId } = await detectLane();

  // Anyone may switch to any lane via ?persona= — the page is instructional.
  const persona: GuidePersona = isGuidePersona(requestedRaw)
    ? requestedRaw
    : ownPersona;

  return (
    <main className="min-h-screen bg-[#FEFCF6]">
      {/* Tricolor top bar */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

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
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF9933] to-[#E68A2E]">
              <span className="text-sm font-bold text-white">Y</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-[#1a1a3e]">Young Indians</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#FF9933]">
                Parliament
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <GuideView guides={GUIDES} persona={persona} eventId={eventId} />
      </div>
    </main>
  );
}
