/**
 * YiFi — "How to use the platform" guide (one smart page, dark YiFi theme).
 *
 * Opens on the VIEWER's own lane (detectGuideLane). An organiser may switch to
 * the founder guide via ?lane= (so they can hand it to a founder); a founder
 * stays on their own lane. Lives under the public /yifi root layout (no gate):
 * the content is instructional only, and the participant lane is the logged-out
 * default.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  GUIDES,
  GUIDE_LANES,
  isGuideLane,
  type GuideLane,
} from "@/lib/yifi/guide/content";
import { detectGuideLane } from "@/lib/yifi/guide/detect-lane";
import { GuideView } from "@/app/yifi/_components/GuideView";
import {
  getCompletedSteps,
  toggleStep,
  logGuideEvent,
} from "@/lib/yifi/guide/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "How to use YiFi" };

/** The Supabase-authed lane that gets the persisted setup checklist. Founders
 *  (access-code cookie) get the plain guide. */
const STAFF_LANES: GuideLane[] = ["organiser"];

/** Where "Back" returns to, per lane. */
const LANE_HOME: Record<GuideLane, string> = {
  participant: "/yifi/me",
  organiser: "/yifi/admin",
};

export default async function YiFiGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  const { lane: requestedRaw } = await searchParams;
  const { lane: ownLane, canViewOtherLanes } = await detectGuideLane();

  // An organiser may open any lane; a founder is pinned to their own.
  const requested = isGuideLane(requestedRaw) ? requestedRaw : null;
  const lane: GuideLane =
    requested && (canViewOtherLanes || requested === ownLane)
      ? requested
      : ownLane;

  const content = GUIDES[lane];

  // The checklist + saved progress is an organiser setup aid, and only on the
  // viewer's OWN lane (previewing the other lane stays read-only).
  const trackProgress = lane === ownLane && STAFF_LANES.includes(ownLane);
  const initialCompleted = trackProgress
    ? await getCompletedSteps(lane)
    : undefined;

  return (
    <main className="min-h-screen bg-[#000066]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            href={LANE_HOME[lane]}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <Link href="/yifi" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Organiser lane switcher — view the founder guide to share it */}
        {canViewOtherLanes && (
          <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Guides
            </p>
            <div className="flex flex-wrap gap-2">
              {GUIDE_LANES.map((l) => (
                <Link
                  key={l}
                  href={`/yifi/guide?lane=${l}`}
                  className={
                    l === lane
                      ? "inline-flex items-center rounded-full bg-[#FD7215] px-3 py-1 text-sm font-medium text-white"
                      : "inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-sm font-medium text-white/70 hover:border-white/40 hover:text-white"
                  }
                >
                  {GUIDES[l].label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <GuideView
          // Remount per lane so the progress useState re-seeds and the
          // guide_open/lane_complete event refs reset (invariant: key={activeLane}).
          key={lane}
          content={content}
          trackProgress={trackProgress}
          initialCompleted={initialCompleted}
          onToggleStep={toggleStep}
          onEvent={logGuideEvent}
        />
      </div>
    </main>
  );
}
