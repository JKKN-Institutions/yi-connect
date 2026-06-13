/**
 * Yi Youth Academy — "How to use the platform" guide (one smart page).
 *
 * Opens on the VIEWER's own lane (detectGuideLane). Managers who onboard others
 * (national / chapter / coordinator) may switch to and download any lane via
 * ?lane=, so they can hand the right guide to a student or mentor; everyone
 * else stays on their own lane. Any lane is downloadable as a PDF to share.
 *
 * Lives under the public youth-academy root layout (no gate) — the content is
 * instructional only, and the applicant lane is the logged-out default.
 */
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download } from "lucide-react";
import {
  GUIDES,
  GUIDE_LANES,
  isGuideLane,
  type GuideLane,
} from "@/lib/yuva/guide/content";
import { detectGuideLane } from "@/lib/yuva/guide/detect-lane";
import { GuideView } from "@/app/youth-academy/_components/GuideView";
import {
  getCompletedSteps,
  toggleStep,
  logGuideEvent,
} from "@/lib/yuva/guide/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "How to use the platform" };

/** The Supabase-authed lanes that get the persisted setup checklist. Students
 *  (cookie session) and applicants (anonymous) get the plain guide. */
const STAFF_LANES: GuideLane[] = [
  "national",
  "chapter_admin",
  "coordinator",
  "mentor",
];

/** Where "Back" returns to, per lane. */
const LANE_HOME: Record<GuideLane, string> = {
  applicant: "/youth-academy",
  student: "/youth-academy/me",
  mentor: "/youth-academy/mentor",
  coordinator: "/youth-academy/chapter",
  chapter_admin: "/youth-academy/chapter",
  national: "/youth-academy/national",
};

export default async function YouthAcademyGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  const { lane: requestedRaw } = await searchParams;
  const { lane: ownLane, canViewOtherLanes } = await detectGuideLane();

  // A manager may open any lane; everyone else is pinned to their own.
  const requested = isGuideLane(requestedRaw) ? requestedRaw : null;
  const lane: GuideLane =
    requested && (canViewOtherLanes || requested === ownLane)
      ? requested
      : ownLane;

  const content = GUIDES[lane];

  // Checklist + saved progress is a staff setup aid, and only on the viewer's
  // OWN lane (previewing another lane stays read-only).
  const trackProgress = lane === ownLane && STAFF_LANES.includes(ownLane);
  const initialCompleted = trackProgress
    ? await getCompletedSteps(lane)
    : undefined;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#0f2557] text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            href={LANE_HOME[lane]}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <Image
            src="/youth-academy/academy-logo.jpg"
            alt="Yi Youth Academy"
            width={1200}
            height={593}
            className="h-9 w-auto rounded bg-white px-2 py-1"
          />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Manager lane switcher — share the right guide with your team */}
        {canViewOtherLanes && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Guides to share with your team
            </p>
            <div className="flex flex-wrap gap-2">
              {GUIDE_LANES.map((l) => (
                <Link
                  key={l}
                  href={`/youth-academy/guide?lane=${l}`}
                  className={
                    l === lane
                      ? "inline-flex items-center rounded-full bg-[#0f2557] px-3 py-1 text-sm font-medium text-white"
                      : "inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }
                >
                  {GUIDES[l].label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Download PDF */}
        <div className="mb-8 flex justify-end">
          <a
            href={`/youth-academy/guide/pdf?lane=${lane}`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
          >
            <Download className="size-4" />
            Download as PDF
          </a>
        </div>

        <GuideView
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
