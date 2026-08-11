import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteDelegate,
  regenerateAccessCode,
} from "@/app/yi-future/actions/delegates";
import { WhatsAppIconButton } from "@/components/whatsapp";
import { ImportDelegatesButton } from "@/components/yi-future/delegates/ImportDelegatesButton";
import {
  pickCheckInSession,
  formatIst,
  type CheckInSession,
  type CheckIn,
  type CheckInMarker,
} from "@/lib/yi-future/checkin-session";
import { stationLabel } from "@/lib/yi-future/volunteers";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

type Delegate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  course: string | null;
  year_of_study: number | null;
  college_id: string | null;
  is_active: boolean | null;
  colleges: { name: string } | null;
  team_members: { team_id: string; teams: { team_name: string } }[];
};

async function getDelegates(
  chapterId: string,
  editionId: string
): Promise<Delegate[]> {
  const svc = await createServiceClient();
  // Was losing every delegate past PostgREST's ~1000-row cap: the largest
  // chapter has 1900+, so the "registered / on teams / without a team" totals,
  // the filter chips and the table itself were all silently short.
  return await fetchAllRows<Delegate>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select(
        "id, full_name, email, phone, access_code, course, year_of_study, college_id, is_active, colleges(name), team_members(team_id, teams(team_name))"
      )
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: Delegate[] | null;
      error: unknown;
    }>
  );
}

type AttendanceRow = {
  delegate_id: string;
  attended: boolean | null;
  marked_at: string | null;
  marked_by: string | null;
  marked_by_volunteer_id: string | null;
};

/**
 * Every phase event this chapter runs this edition, oldest first.
 *
 * Not wrapped in fetchAllRows on purpose: this is one chapter's journey, which is a
 * handful of rows (the busiest chapter in production has 5), so it cannot approach
 * PostgREST's ~1000-row cap. Indexed by idx_phase_events_chapter_phase
 * (edition_id, chapter_id, phase).
 */
async function getCheckInSessions(
  chapterId: string,
  editionId: string
): Promise<CheckInSession[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, title, scheduled_at")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as CheckInSession[] | null) ?? [];
}

/**
 * Attendance for ONE session.
 *
 * Scoped to a single phase_event_id, never "all attendance joined in memory": the
 * table is national (1,487 rows today and growing every event), so an unfiltered
 * read would silently stop at PostgREST's ~1000-row cap and render checked-in
 * delegates as absent. Filtered this way the result is bounded by the chapter's own
 * delegate count, and fetchAllRows pages past the cap for the chapters that exceed
 * it. Served by phase_event_attendance_pkey (phase_event_id, delegate_id) — no new
 * index needed.
 */
async function getAttendance(phaseEventId: string): Promise<AttendanceRow[]> {
  const svc = await createServiceClient();
  return await fetchAllRows<AttendanceRow>((from, to) =>
    svc
      .schema("future")
      .from("phase_event_attendance")
      .select(
        "delegate_id, attended, marked_at, marked_by, marked_by_volunteer_id"
      )
      .eq("phase_event_id", phaseEventId)
      .order("delegate_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: AttendanceRow[] | null;
      error: unknown;
    }>
  );
}

/**
 * Resolves marker ids to names. Both lookups are over DISTINCT ids only — a session
 * is marked by a desk roster and a core team, not by thousands of people — so
 * neither `.in()` can approach the row cap.
 *
 * The volunteer lookup is pinned to this chapter as well as the id, so a row
 * pointing at another chapter's volunteer resolves to the generic "Desk" label
 * rather than leaking a name across chapters.
 */
async function getMarkers(
  volunteerIds: string[],
  adminUserIds: string[],
  chapterId: string
): Promise<{
  volunteers: Map<string, { name: string; station: string | null }>;
  admins: Map<string, string>;
}> {
  const svc = await createServiceClient();
  // Neither future.volunteers nor yi_directory is in the generated future types →
  // loose client for both (the established cross-schema pattern; see
  // app/yi-future/chapter/volunteers/page.tsx and require-access.ts).
  const loose = svc as any;
  const volunteers = new Map<string, { name: string; station: string | null }>();
  const admins = new Map<string, string>();

  // Names are decoration on a column whose real payload is "a volunteer did this"
  // vs "an admin did this". If a lookup fails — future.volunteers is not installed
  // in every environment yet — fall through to the generic labels rather than
  // failing the whole page.
  const [volRes, adminRes] = await Promise.all([
    volunteerIds.length
      ? loose
          .schema("future")
          .from("volunteers")
          .select("id, full_name, station")
          .eq("chapter_id", chapterId)
          .in("id", volunteerIds)
          .then(
            (r: { data: unknown }) => r,
            () => ({ data: null })
          )
      : Promise.resolve({ data: null }),
    adminUserIds.length
      ? loose
          .schema("yi_directory")
          .from("people")
          .select("user_id, full_name, email")
          .in("user_id", adminUserIds)
          .then(
            (r: { data: unknown }) => r,
            () => ({ data: null })
          )
      : Promise.resolve({ data: null }),
  ]);

  for (const v of (volRes.data as unknown as
    | { id: string; full_name: string | null; station: string | null }[]
    | null) ?? []) {
    volunteers.set(v.id, {
      name: v.full_name ?? "Desk volunteer",
      station: v.station,
    });
  }
  for (const p of (adminRes.data as unknown as
    | { user_id: string | null; full_name: string | null; email: string | null }[]
    | null) ?? []) {
    if (!p.user_id) continue;
    admins.set(p.user_id, p.full_name ?? p.email ?? "Chapter admin");
  }

  return { volunteers, admins };
}

async function removeDelegate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const res = await deleteDelegate(id);
  if (!res.ok) {
    redirect(`/yi-future/chapter/delegates?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/yi-future/chapter/delegates");
}

async function regenCode(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const res = await regenerateAccessCode(id);
  if (res.ok && res.message) {
    redirect(`/yi-future/chapter/delegates?msg=${encodeURIComponent(res.message)}`);
  }
}

export default async function DelegatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    msg?: string;
    team?: string;
    checkin?: string;
    event?: string;
  }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const sp = await searchParams;
  const [allDelegates, sessions] = await Promise.all([
    getDelegates(ctx.chapterId, ctx.editionId),
    getCheckInSessions(ctx.chapterId, ctx.editionId),
  ]);
  const onTeam = allDelegates.filter((d) => d.team_members.length > 0).length;

  // Which session's check-in is on screen. FAIL CLOSED: ?event is matched against
  // this chapter's own sessions and never reaches a query, so an id belonging to
  // another chapter simply falls back to the default rather than fetching it.
  const requestedId = sp.event ?? null;
  const requested = requestedId
    ? (sessions.find((s) => s.id === requestedId) ?? null)
    : null;
  const session = requested ?? pickCheckInSession(sessions);

  // Attendance for that one session, keyed by delegate. Skipped entirely when the
  // chapter has no sessions yet — most chapters don't, and they should not pay for
  // a query that can only return nothing.
  const checkIns = new Map<string, CheckIn>();
  if (session) {
    const rows = await getAttendance(session.id);
    const { volunteers, admins } = await getMarkers(
      [...new Set(rows.map((r) => r.marked_by_volunteer_id).filter((v): v is string => !!v))],
      [...new Set(rows.map((r) => r.marked_by).filter((v): v is string => !!v))],
      ctx.chapterId
    );
    for (const r of rows) {
      let marker: CheckInMarker | null = null;
      if (r.marked_by_volunteer_id) {
        const v = volunteers.get(r.marked_by_volunteer_id);
        // Unresolvable id still means a volunteer did it — say so generically
        // rather than dropping the distinction this column exists to show.
        marker = {
          kind: "volunteer",
          name: v?.name ?? "Desk volunteer",
          station: v?.station ?? null,
        };
      } else if (r.marked_by) {
        marker = {
          kind: "admin",
          name: admins.get(r.marked_by) ?? "Chapter admin",
        };
      }
      checkIns.set(r.delegate_id, {
        attended: r.attended === true,
        markedAt: r.marked_at,
        marker,
      });
    }
  }
  const checkedIn = allDelegates.filter(
    (d) => checkIns.get(d.id)?.attended
  ).length;

  // Field request 2026-07-17: quick teamed / unteamed views.
  const teamFilter =
    sp.team === "teamed" || sp.team === "none" ? sp.team : "all";
  const checkinFilter =
    sp.checkin === "in" || sp.checkin === "out" ? sp.checkin : "all";

  // Two independent axes, so they compose: "on a team AND not checked in" is the
  // question a chair actually asks at the door.
  const delegates = allDelegates
    .filter((d) =>
      teamFilter === "teamed"
        ? d.team_members.length > 0
        : teamFilter === "none"
          ? d.team_members.length === 0
          : true
    )
    .filter((d) =>
      checkinFilter === "in"
        ? checkIns.get(d.id)?.attended === true
        : checkinFilter === "out"
          ? checkIns.get(d.id)?.attended !== true
          : true
    );

  // Keeps the other filter and the picked session when a chip is clicked.
  const chipHref = (next: { team?: string; checkin?: string }): string => {
    const params = new URLSearchParams();
    const team = next.team ?? teamFilter;
    const checkin = next.checkin ?? checkinFilter;
    if (team !== "all") params.set("team", team);
    if (checkin !== "all") params.set("checkin", checkin);
    if (session && sessions.length > 1) params.set("event", session.id);
    const qs = params.toString();
    return `/yi-future/chapter/delegates${qs ? `?${qs}` : ""}`;
  };
  const chipClass = (active: boolean) =>
    `min-h-[36px] inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
      active
        ? "border-navy bg-navy text-ivory"
        : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
    }`;

  return (
    <div className="space-y-6">
      {sp.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.msg && (
        <div className="p-3 rounded-md bg-yi-green/10 border border-yi-green/30 text-sm text-yi-green">
          {sp.msg}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Delegates</h2>
          <p className="mt-1 text-sm text-navy/60">
            {allDelegates.length} registered · {onTeam} on teams ·{" "}
            {allDelegates.length - onTeam} without a team
          </p>
          {/* Attendance is recorded per session, so the session on screen is named
              rather than implied — otherwise yesterday's count reads as today's. */}
          {session ? (
            <p className="mt-1 text-sm text-navy/60">
              <span className="font-semibold text-yi-green">
                {checkedIn} checked in
              </span>{" "}
              of {allDelegates.length} ·{" "}
              <span className="font-semibold text-navy">{session.title}</span> ·{" "}
              {formatIst(session.scheduled_at)} IST
            </p>
          ) : (
            <p className="mt-1 text-sm text-navy/50">
              No session scheduled yet — check-in appears once your chapter adds
              one to the{" "}
              <Link
                href="/yi-future/chapter/journey"
                className="font-semibold text-navy hover:text-yi-gold"
              >
                Journey
              </Link>
              .
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/api/csv/delegates?chapter_id=${ctx.chapterId}`}
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <span>↓</span> CSV
          </Link>
          <ImportDelegatesButton
            chapterId={ctx.chapterId}
            editionId={ctx.editionId}
          />
          <Link
            href="/yi-future/chapter/delegates/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + Register delegate
          </Link>
        </div>
      </div>

      {/* Teamed / unteamed filter chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: `All (${allDelegates.length})` },
            { key: "teamed", label: `In a team (${onTeam})` },
            {
              key: "none",
              label: `No team (${allDelegates.length - onTeam})`,
            },
          ] as const
        ).map((chip) => (
          <Link
            key={chip.key}
            href={chipHref({ team: chip.key })}
            className={chipClass(teamFilter === chip.key)}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {/* Check-in chips, matching the Checked-in / Not-checked-in pair on the YIP
          participants screen. Independent of the team chips above — both apply. */}
      {session && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: `All (${allDelegates.length})` },
              { key: "in", label: `Checked in (${checkedIn})` },
              {
                key: "out",
                label: `Not checked in (${allDelegates.length - checkedIn})`,
              },
            ] as const
          ).map((chip) => (
            <Link
              key={chip.key}
              href={chipHref({ checkin: chip.key })}
              className={chipClass(checkinFilter === chip.key)}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      )}

      {/* Only when the chapter runs more than one session — otherwise the default
          is the only answer and a picker would just be noise. */}
      {sessions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-navy/50">Session:</span>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/yi-future/chapter/delegates?${new URLSearchParams({
                ...(teamFilter !== "all" ? { team: teamFilter } : {}),
                ...(checkinFilter !== "all" ? { checkin: checkinFilter } : {}),
                event: s.id,
              }).toString()}`}
              className={`min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-md text-xs border transition-all ${
                session?.id === s.id
                  ? "border-navy bg-navy/5 text-navy font-semibold"
                  : "border-navy/15 bg-white text-navy/60 hover:border-navy/40"
              }`}
            >
              {s.title}
              <span className="ml-1.5 text-navy/40">
                {formatIst(s.scheduled_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Delegate</th>
              <th className="text-left px-4 py-3 font-semibold">College</th>
              <th className="text-left px-4 py-3 font-semibold">Team</th>
              <th className="text-left px-4 py-3 font-semibold">Code</th>
              <th className="text-left px-4 py-3 font-semibold">Check-in</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {delegates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy/40">
                  {allDelegates.length > 0 ? (
                    // A filter emptied the table, not the chapter — offering
                    // "register one" here would misread as "you have nobody".
                    <p>
                      No delegates match this filter.{" "}
                      <Link
                        href="/yi-future/chapter/delegates"
                        className="text-yi-gold font-semibold"
                      >
                        Show all {allDelegates.length}
                      </Link>
                    </p>
                  ) : (
                    <>
                      <p>
                        No delegates yet.{" "}
                        <Link
                          href="/yi-future/chapter/delegates/new"
                          className="text-yi-gold font-semibold"
                        >
                          Register one
                        </Link>
                        , or bring your whole list in at once.
                      </p>
                      <div className="mt-3 flex justify-center">
                        <ImportDelegatesButton
                          chapterId={ctx.chapterId}
                          editionId={ctx.editionId}
                          variant="empty"
                        />
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              delegates.map((d) => {
                const tm = d.team_members[0];
                const ci = checkIns.get(d.id);
                return (
                  <tr key={d.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{d.full_name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-navy/60">
                        {d.email && <span>{d.email}</span>}
                        {d.email && d.phone && <span> · </span>}
                        {d.phone && <span>{d.phone}</span>}
                        {d.phone && (
                          <WhatsAppIconButton
                            contact={{
                              phone: waPhone(d.phone),
                              name: d.full_name,
                            }}
                            defaultMessage={`Hi ${d.full_name.split(" ")[0]},\n\nThis is from your Yi YUVA Future 6.0 chapter team.\n\n`}
                          />
                        )}
                      </div>
                      {(d.course || d.year_of_study) && (
                        <div className="text-xs text-navy/50">
                          {d.course}
                          {d.course && d.year_of_study && " · "}
                          {d.year_of_study && `Year ${d.year_of_study}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy/70">
                      {d.colleges?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tm ? (
                        <Link
                          href={`/yi-future/chapter/teams/${tm.team_id}`}
                          className="text-navy font-semibold hover:text-yi-gold"
                        >
                          {tm.teams?.team_name ?? "(unnamed)"}
                        </Link>
                      ) : (
                        <span className="text-navy/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                        {d.access_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!session ? (
                        <span className="text-navy/40">—</span>
                      ) : ci?.attended ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center rounded-full bg-yi-green/10 px-2 py-0.5 font-semibold text-yi-green">
                            Checked in
                          </span>
                          {ci.markedAt && (
                            <div className="text-navy/50">
                              {formatIst(ci.markedAt)}
                            </div>
                          )}
                          {/* Desk vs Admin is the whole point of this column: a
                              volunteer marking arrivals at the door is a
                              different fact from an admin ticking a box later. */}
                          {ci.marker &&
                            (ci.marker.kind === "volunteer" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-yi-green/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yi-green">
                                  Desk
                                </span>
                                <span className="text-navy/70">
                                  {ci.marker.name}
                                </span>
                                {ci.marker.station && (
                                  <span className="text-navy/40">
                                    · {stationLabel(ci.marker.station)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/70">
                                  Admin
                                </span>
                                <span className="text-navy/70">
                                  {ci.marker.name}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-navy/15 px-2 py-0.5 text-navy/50">
                          Not checked in
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link
                        href={`/yi-future/chapter/delegates/${d.id}/edit`}
                        className="text-xs font-semibold text-navy hover:text-yi-gold"
                      >
                        Edit
                      </Link>
                      <form action={regenCode} className="inline-block">
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="text-xs text-navy/60 hover:text-navy"
                        >
                          Regen code
                        </button>
                      </form>
                      <form
                        action={removeDelegate}
                        className="inline-block"
                      >
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-600/70 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
