/**
 * Chapter — Mentor YUVA Network management screen (Phase 6).
 * Spec: docs/yi-youth-academy-spec.md → "Chapter — Mentor YUVA Network"
 * (/youth-academy/chapter/mentors).
 *
 * Gate (defense-in-depth on top of the chapter layout): chapter admin sees
 * THEIR chapter's roster; national sees all chapters. Institution
 * coordinators are explicitly DENIED — the mentor network is chapter-owned
 * ("cannot invite mentors to the chapter network"). Mentors/others: denied
 * with the explicit capability reason — never a silent redirect.
 */

import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { YUVA_APP, ROLE_MENTOR } from "@/lib/yuva/constants";
import { publicUrl } from "@/lib/yuva/storage";
import { createServiceClient as createYuvaService } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema (donor
// cross-schema access path — app/yip/actions/chapter-roles.ts).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { MentorInviteDialog } from "@/components/yuva/mentors/mentor-invite-dialog";
import {
  MentorRoster,
  type MentorRosterRow,
} from "@/components/yuva/mentors/mentor-roster";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mentor YUVA Network",
};

type PersonEmbed = {
  full_name: string;
  email: string | null;
  is_active: boolean | null;
};

type SessionSlice = {
  mentor_person_id: string | null;
  scheduled_at: string | null;
  status: string;
};

/** Aggregate upcoming (scheduled, future) / delivered (completed) per mentor. */
function countSessions(
  sessions: SessionSlice[]
): Map<string, { upcoming: number; delivered: number }> {
  const counts = new Map<string, { upcoming: number; delivered: number }>();
  const now = Date.now();
  for (const s of sessions) {
    if (!s.mentor_person_id) continue;
    const entry = counts.get(s.mentor_person_id) ?? { upcoming: 0, delivered: 0 };
    if (s.status === "completed") {
      entry.delivered += 1;
    } else if (
      s.status === "scheduled" &&
      s.scheduled_at &&
      Date.parse(s.scheduled_at) > now
    ) {
      entry.upcoming += 1;
    }
    counts.set(s.mentor_person_id, entry);
  }
  return counts;
}

export default async function ChapterMentorsPage() {
  const access = await getYuvaAccess();
  if (!access.isNational && !access.chapterAdminOf) {
    return (
      <Forbidden403
        reason={`The Mentor YUVA Network is managed by the chapter team. ${access.reason}.`}
      />
    );
  }

  const chapter = access.chapterAdminOf; // null ⇒ national (all chapters)

  // 1. Active mentor role rows (canonical source: yi_directory).
  const dir = await createDirService();
  let rolesQuery = dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, yi_chapter, person:people!inner(full_name, email, is_active)")
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR)
    .eq("is_active", true);
  if (chapter) rolesQuery = rolesQuery.eq("yi_chapter", chapter);
  const { data: roleRows } = await rolesQuery;

  const activeRoles = (roleRows ?? []).filter((r) => {
    const p = r.person as unknown as PersonEmbed;
    return p && p.is_active !== false;
  });
  const personIds = Array.from(new Set(activeRoles.map((r) => r.person_id)));

  // 2. App-side profiles + session counts (yuva schema).
  const yuva = await createYuvaService();

  type ProfileRow = {
    person_id: string;
    expertise: string[];
    organization: string | null;
    photo_storage_path: string | null;
    is_public: boolean;
    updated_at: string;
  };
  let profilesByPerson = new Map<string, ProfileRow>();
  let sessionCounts = new Map<string, { upcoming: number; delivered: number }>();

  if (personIds.length > 0) {
    const { data: profiles } = await yuva
      .from("mentor_profiles")
      .select("person_id, expertise, organization, photo_storage_path, is_public, updated_at")
      .in("person_id", personIds);
    profilesByPerson = new Map(
      (profiles ?? []).map((p) => [p.person_id, p as ProfileRow])
    );

    let sessionsQuery = yuva
      .from("run_sessions")
      .select("id, mentor_person_id, scheduled_at, status, runs!inner(chapter)")
      .in("mentor_person_id", personIds);
    if (chapter) sessionsQuery = sessionsQuery.eq("runs.chapter", chapter);
    const { data: sessions } = await sessionsQuery;
    sessionCounts = countSessions(sessions ?? []);
  }

  const rows: MentorRosterRow[] = activeRoles
    .map((r) => {
      const person = r.person as unknown as PersonEmbed;
      const profile = profilesByPerson.get(r.person_id);
      const counts = sessionCounts.get(r.person_id) ?? {
        upcoming: 0,
        delivered: 0,
      };
      return {
        assignmentId: r.id,
        personId: r.person_id,
        name: person?.full_name ?? "—",
        email: person?.email ?? null,
        chapter: r.yi_chapter,
        organization: profile?.organization ?? null,
        expertise: profile?.expertise ?? [],
        photoUrl: profile?.photo_storage_path
          ? `${publicUrl(profile.photo_storage_path)}?v=${Date.parse(profile.updated_at) || 0}`
          : null,
        isPublic: profile?.is_public ?? false,
        upcomingSessions: counts.upcoming,
        deliveredSessions: counts.delivered,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const publicCount = rows.filter((r) => r.isPublic).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
            {chapter ? `Yi ${chapter}` : "All chapters"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Mentor YUVA Network
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} mentor{rows.length === 1 ? "" : "s"} in the network ·{" "}
            {publicCount} shown on the{" "}
            <a
              href="/youth-academy/mentors"
              className="font-medium text-emerald-700 hover:underline"
            >
              public network page
            </a>
            . Mentors can be anyone — no Yi membership needed.
          </p>
        </div>
        <MentorInviteDialog chapter={chapter} />
      </div>

      <MentorRoster rows={rows} showChapterColumn={!chapter} />
    </div>
  );
}
