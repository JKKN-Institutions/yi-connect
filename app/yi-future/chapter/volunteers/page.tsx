import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import type { FutureVolunteer } from "@/lib/yi-future/volunteers";
import { VolunteersClient } from "./volunteers-client";

/**
 * /yi-future/chapter/volunteers — the chair's desk-staff roster.
 *
 * The layout above already runs requireFutureAdmin(); every mutation on this
 * page is independently gated by requireChapterAdmin() inside
 * app/yi-future/actions/volunteers.ts (fail closed, denies via
 * /yi-future/forbidden).
 *
 * This page must survive the migration being UNAPPLIED — it ships before the
 * SQL runs, so a missing table is reported in words instead of a 500.
 */

type LoadResult =
  | { state: "ok"; volunteers: FutureVolunteer[] }
  | { state: "not_installed" }
  | { state: "error"; message: string };

async function getVolunteers(
  chapterId: string,
  editionId: string
): Promise<LoadResult> {
  const svc = await createServiceClient();
  // future.volunteers is new and not in the generated types → loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .schema("future")
    .from("volunteers")
    .select(
      "id, edition_id, chapter_id, full_name, phone, email, station, access_code, is_active, arrived, arrived_at, notes"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("station", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    // 42P01 undefined_table / 42501 insufficient_privilege (missing GRANT) both
    // mean "the migration has not been applied here yet".
    if (error.code === "42P01" || error.code === "42501") {
      return { state: "not_installed" };
    }
    return { state: "error", message: error.message };
  }
  return { state: "ok", volunteers: (data as FutureVolunteer[]) ?? [] };
}

export default async function ChapterVolunteersPage() {
  const ctx = await getChapterContext();

  // Explicit, not a silent redirect to /yi-future/chapter.
  if (!ctx) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
        <h2 className="text-lg font-bold text-navy">No chapter assigned</h2>
        <p className="mt-2 text-sm text-navy/60">
          Your account is not on an active chapter core team for the current
          edition, so there is no chapter to staff. Ask a Yi-Future national
          admin to add you.
        </p>
      </div>
    );
  }

  const load = await getVolunteers(ctx.chapterId, ctx.editionId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Check-in Volunteers</h2>
        <p className="mt-1 text-sm text-navy/60">
          Desk staff sign in at <strong>/yi-future/access</strong> with the
          6-character code below — no email, no password — and mark delegates
          present on their phone.
        </p>
      </div>

      {load.state === "not_installed" && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <p className="text-sm font-bold text-amber-900">
            Volunteers are not switched on in this environment yet.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            The migration{" "}
            <code className="font-mono">
              supabase/migrations/future_volunteers_checkin.sql
            </code>{" "}
            has not been applied. Nothing on this page will save until it is.
          </p>
        </div>
      )}

      {load.state === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-bold text-red-700">
            Could not load volunteers.
          </p>
          <p className="mt-1 text-xs text-red-700">{load.message}</p>
        </div>
      )}

      <VolunteersClient
        chapterId={ctx.chapterId}
        editionId={ctx.editionId}
        chapterName={ctx.chapterName}
        volunteers={load.state === "ok" ? load.volunteers : []}
        disabled={load.state !== "ok"}
      />
    </div>
  );
}
