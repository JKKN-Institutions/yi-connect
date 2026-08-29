import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import {
  getChapterAssignmentBoard,
  getChapterAssignmentProgress,
  getEventChapterOptions,
} from "@/app/yip/actions/chapter-assign";
import { ChaptersClient } from "./chapters-client";

/**
 * "Which chapter is each student from" — the organiser screen behind
 * /yip/dashboard/events/[id]/chapters.
 *
 * Not linked from the tab nav on purpose: it is a setup chore for regional
 * rounds, run once before recognition is computed, and the nav is already long.
 * A direct URL is enough until someone asks for it there.
 */
export default async function EventChaptersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  // Writing the roster is a manage action, so gate the whole page on canManage
  // rather than canView — a read-only visitor has nothing to do here.
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="You don't have access to this event's chapter assignment. Only this event's chapter chair, its organisers, its regional admin, or a national admin can record which chapter each student came from." />
    );
  }

  const [board, options, progress] = await Promise.all([
    getChapterAssignmentBoard(id),
    getEventChapterOptions(id),
    getChapterAssignmentProgress(id),
  ]);

  // The three reads share the same gate that just passed, so a failure here is
  // a genuine fault (event deleted mid-request, DB down) rather than a denial.
  if (!board.success || !options.success || !progress.success) {
    const error =
      (!board.success && board.error) ||
      (!options.success && options.error) ||
      (!progress.success && progress.error) ||
      "Could not load this event's roster.";
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <ChaptersClient
      eventId={id}
      zone={options.data.zone}
      chapters={options.data.chapters}
      migrationApplied={board.data.migrationApplied}
      schools={board.data.schools}
      noSchool={board.data.noSchool}
      progress={progress.data}
    />
  );
}
