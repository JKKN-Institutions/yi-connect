import Link from "next/link";
import { readSession } from "@/app/yi-future/actions/auth";
import { GuideNudge } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yi-future/guide/actions";

export default async function MentorHome() {
  const session = await readSession();
  const guideCompleted = await getCompletedSteps("mentor");
  return (
    <div className="space-y-6">
      <GuideNudge
        guide={GUIDES.lanes.mentor}
        basePath="/yi-future/guide"
        completed={guideCompleted}
        onEvent={logGuideEvent}
      />
      <div>
        <h1 className="text-3xl font-bold text-navy">Mentor Dashboard</h1>
        <p className="mt-1 text-sm text-navy/60">
          {session?.name ?? "Mentor"} · Future 6.0 (2026)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/yi-future/mentor/messages"
          className="bg-white border border-navy/10 rounded-lg p-5 hover:border-yi-gold hover:shadow-sm transition"
        >
          <div className="text-sm font-semibold text-navy">Open messages</div>
          <p className="mt-1 text-xs text-navy/60">
            Reply to your assigned teams.
          </p>
        </Link>
        <Link
          href="/yi-future/mentor/resources"
          className="bg-white border border-navy/10 rounded-lg p-5 hover:border-yi-gold hover:shadow-sm transition"
        >
          <div className="text-sm font-semibold text-navy">Browse resources</div>
          <p className="mt-1 text-xs text-navy/60">
            Mentor briefs, templates, and references.
          </p>
        </Link>
      </div>
    </div>
  );
}
