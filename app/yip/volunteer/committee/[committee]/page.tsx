import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { CommitteeClient } from "@/app/yip/me/committee/committee-client";

/**
 * Volunteer view of a committee's Room — the SAME surface organisers use, gated
 * by yip.yuva_assignments instead of canManage. A YUVA volunteer assigned to
 * this committee runs it with chair-equivalent powers (director decision
 * 2026-06-28), but ONLY their own committee.
 *
 * Gated fail-closed here AND again in committee-room.ts (resolveRoomAuth) so
 * every action re-checks the assignment server-side.
 */
export default async function VolunteerCommitteeRoomPage({
  params,
}: {
  params: Promise<{ committee: string }>;
}) {
  const { committee } = await params;
  const committeeName = decodeURIComponent(committee);

  const session = await getYipSession();
  if (!session || session.type !== "volunteer") {
    redirect("/yip/join");
  }

  // Fail-closed: the volunteer must be assigned to THIS committee in THIS event.
  const sb = await createServiceClient();
  const { data: assigned } = await sb
    .from("yuva_assignments")
    .select("id")
    .eq("volunteer_id", session.id)
    .eq("event_id", session.eventId)
    .eq("committee_name", committeeName)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* Tricolor top bar — matches the YUVA Desk chrome */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      <header className="border-b border-[#1a1a3e]/5 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Link
            href="/yip/volunteer"
            className="flex items-center gap-1.5 text-sm font-medium text-[#FF9933] hover:underline"
          >
            <ArrowLeft className="size-4" />
            YUVA Desk
          </Link>
          <span className="ml-auto truncate text-xs text-[#1a1a3e]/45">
            {committeeName} Committee
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">
        {assigned ? (
          <CommitteeClient eventId={session.eventId} committeeName={committeeName} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center">
            <p className="text-base font-semibold text-[#1a1a3e]">
              You&apos;re not assigned to this committee
            </p>
            <p className="mt-1 text-sm text-[#1a1a3e]/70">
              You can only manage a committee you&apos;ve been assigned to. Ask an
              organiser to add you to it.
            </p>
            <Link
              href="/yip/volunteer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#FF9933] px-4 py-2 text-sm font-medium text-white"
            >
              <ArrowLeft className="size-4" />
              Back to my desk
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
