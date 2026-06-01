import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX, PHASE_LABELS } from "@/lib/yi-future/constants";
import { WhatsAppIconButton } from "@/components/whatsapp";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type DelegateLite = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  course: string | null;
  year_of_study: number | null;
  college_id: string | null;
  preferred_track_slug: string | null;
};

type TeamDetail = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  problem_statement_id: string | null;
  chapter_id: string;
  edition_id: string;
  created_at: string | null;
  updated_at: string | null;
  problem_statements:
    | {
        id: string;
        title: string;
        short_description: string | null;
        tracks: { slug: string; name: string; color_hex: string | null } | null;
      }
    | null;
  captain: DelegateLite | null;
  team_members: { delegate_id: string; role_in_team: string | null; joined_at: string | null }[];
};

type ChapterLite = {
  id: string;
  name: string;
  region: string | null;
  city: string | null;
};

type ChairLite = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type SubmissionRow = {
  id: string;
  phase: string;
  status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  summary: string | null;
};

type EvaluationRow = {
  id: string;
  total_score: number | null;
  recommendation: string | null;
  created_at: string | null;
  evaluator_role: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  problem_selected: "Problem Selected",
  phase_a_done: "Phase A Done",
  phase_b_done: "Phase B Done",
  phase_c_done: "Phase C Done",
  shortlisted: "Shortlisted",
  eliminated: "Eliminated",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Data fetchers (server, future.* + yi.chapters via view) ────────────────

async function getTeam(id: string): Promise<TeamDetail | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, captain_id, problem_statement_id, chapter_id, edition_id, created_at, updated_at, problem_statements(id, title, short_description, tracks(slug, name, color_hex)), captain:delegates!teams_captain_id_fkey(id, full_name, email, phone, whatsapp, course, year_of_study, college_id, preferred_track_slug), team_members(delegate_id, role_in_team, joined_at)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as TeamDetail | null) ?? null;
}

async function getChapter(id: string): Promise<ChapterLite | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region, city")
    .eq("id", id)
    .maybeSingle();
  return (data as ChapterLite | null) ?? null;
}

async function getChair(chapterId: string, editionId: string): Promise<ChairLite | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("full_name, email, phone")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("role" as never, "chapter_chair" as never)
    .eq("is_active", true)
    .maybeSingle();
  return (data as ChairLite | null) ?? null;
}

async function getMembers(ids: string[]): Promise<DelegateLite[]> {
  if (ids.length === 0) return [];
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, email, phone, whatsapp, course, year_of_study, college_id, preferred_track_slug")
    .in("id", ids);
  return (data as unknown as DelegateLite[]) ?? [];
}

async function getColleges(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name")
    .in("id", ids);
  const map = new Map<string, string>();
  for (const c of (data as { id: string; name: string }[] | null) ?? []) {
    map.set(c.id, c.name);
  }
  return map;
}

async function getSubmissions(teamId: string): Promise<SubmissionRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("submissions")
    .select("id, phase, status, submitted_at, reviewed_at, summary")
    .eq("team_id", teamId)
    .order("phase", { ascending: true });
  return (data as unknown as SubmissionRow[]) ?? [];
}

async function getEvaluations(teamId: string): Promise<EvaluationRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, total_score, recommendation, created_at, evaluator_role")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  return (data as unknown as EvaluationRow[]) ?? [];
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function NationalAdminTeamDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const team = await getTeam(id);
  if (!team) notFound();

  const [chapter, chair, members, submissions, evaluations] = await Promise.all([
    getChapter(team.chapter_id),
    getChair(team.chapter_id, team.edition_id),
    getMembers(team.team_members.map((m) => m.delegate_id)),
    getSubmissions(team.id),
    getEvaluations(team.id),
  ]);

  const collegeIds = members.map((m) => m.college_id).filter(Boolean) as string[];
  const collegeNames = await getColleges(collegeIds);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const sizeOk = team.team_members.length >= TEAM_SIZE_MIN;
  const trk = team.problem_statements?.tracks ?? null;
  const trackColor = trk?.color_hex ?? "#1a1a3e";
  const st = team.status ?? "registered";

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-1">
            Team detail · National view
          </div>
          <h2 className="text-2xl font-bold text-navy">{team.team_name}</h2>
          <p className="mt-1 text-sm text-navy/60">
            {chapter?.name ?? "Unknown chapter"}
            {chapter?.region ? ` · ${chapter.region}` : ""} · created {fmtDate(team.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/yi-future/national/admin/teams"
            className="text-xs font-semibold px-3 py-1.5 rounded border border-navy/20 text-navy hover:bg-navy/5"
          >
            ← All teams
          </Link>
        </div>
      </div>

      {/* ── Status + Problem panel ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Status
          </div>
          <div className="mt-2 inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-navy/5 text-navy">
            {STATUS_LABELS[st] ?? st}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Members
          </div>
          <div className="mt-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                sizeOk
                  ? "bg-yi-green/10 text-yi-green"
                  : "bg-red-600/10 text-red-600/80"
              }`}
            >
              {team.team_members.length} / {TEAM_SIZE_MAX}
            </span>
            {!sizeOk && (
              <span className="ml-2 text-[11px] text-red-600/70">
                below minimum ({TEAM_SIZE_MIN})
              </span>
            )}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Track
          </div>
          <div className="mt-2">
            {trk ? (
              <span
                className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: trackColor + "1a",
                  color: trackColor,
                  border: `1px solid ${trackColor}33`,
                }}
              >
                {trk.name}
              </span>
            ) : (
              <span className="text-xs text-navy/40">no track yet</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Problem statement card ──────────────────────────────────────── */}
      <div className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-2">
          Problem Statement
        </div>
        {team.problem_statements ? (
          <>
            <div className="text-base font-semibold text-navy">
              {team.problem_statements.title}
            </div>
            {team.problem_statements.short_description && (
              <p className="mt-2 text-sm text-navy/70 leading-relaxed">
                {team.problem_statements.short_description}
              </p>
            )}
          </>
        ) : (
          <div className="text-sm text-red-600/80">
            No problem statement selected yet.
          </div>
        )}
      </div>

      {/* ── Captain + Chair contact panel ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-navy/10 rounded-lg p-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-2">
            Captain
          </div>
          {team.captain ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-navy">
                  {team.captain.full_name}
                </div>
                {(team.captain.whatsapp ?? team.captain.phone) && (
                  <WhatsAppIconButton
                    contact={{
                      phone: waPhone(
                        (team.captain.whatsapp ?? team.captain.phone)!
                      ),
                      name: team.captain.full_name,
                    }}
                    defaultMessage={`Hi ${team.captain.full_name.split(" ")[0]},\n\nThis is from Yi YUVA Future 6.0 regarding your team "${team.team_name}".\n\n`}
                  />
                )}
              </div>
              <div className="mt-1 text-xs text-navy/60">
                {team.captain.email ?? "no email"} · {team.captain.phone ?? "no phone"}
              </div>
            </>
          ) : (
            <div className="text-sm text-red-600/80">No captain assigned.</div>
          )}
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-2">
            Chapter Chair (escalation)
          </div>
          {chair ? (
            <>
              <div className="text-sm font-semibold text-navy">
                {chair.full_name}
              </div>
              <div className="mt-1 text-xs text-navy/60">
                {chair.email ?? "no email"} · {chair.phone ?? "no phone"}
              </div>
            </>
          ) : (
            <div className="text-sm text-navy/50">
              No active chair on record for this chapter + edition.
            </div>
          )}
        </div>
      </div>

      {/* ── Members table ───────────────────────────────────────────────── */}
      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/5 text-[10px] font-semibold uppercase tracking-widest text-navy/50">
          Members ({team.team_members.length})
        </div>
        {team.team_members.length === 0 ? (
          <div className="p-6 text-center text-sm text-navy/50">
            No members yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Email / Phone</th>
                <th className="text-left px-3 py-2 font-semibold">College</th>
                <th className="text-left px-3 py-2 font-semibold">Year</th>
                <th className="text-left px-3 py-2 font-semibold">Role</th>
                <th className="text-left px-3 py-2 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {team.team_members.map((tm) => {
                const m = memberById.get(tm.delegate_id);
                if (!m) {
                  return (
                    <tr key={tm.delegate_id} className="border-t border-navy/5">
                      <td className="px-3 py-2 text-navy/40 italic" colSpan={6}>
                        Delegate {tm.delegate_id.slice(0, 8)}… not found
                      </td>
                    </tr>
                  );
                }
                const isCaptain = m.id === team.captain_id;
                return (
                  <tr key={m.id} className="border-t border-navy/5">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-navy">{m.full_name}</div>
                      {isCaptain && (
                        <div className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-widest text-yi-gold">
                          Captain
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-navy/70">
                      <div>{m.email ?? "—"}</div>
                      <div className="text-navy/50">{m.phone ?? m.whatsapp ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-navy/70">
                      {m.college_id ? collegeNames.get(m.college_id) ?? "—" : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-navy/70">
                      {m.year_of_study ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-navy/60">
                      {tm.role_in_team ?? (isCaptain ? "captain" : "member")}
                    </td>
                    <td className="px-3 py-2 text-xs text-navy/50">
                      {fmtDate(tm.joined_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Submissions ────────────────────────────────────────────────── */}
      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/5 text-[10px] font-semibold uppercase tracking-widest text-navy/50">
          Submissions ({submissions.length})
        </div>
        {submissions.length === 0 ? (
          <div className="p-6 text-center text-sm text-navy/50">
            No submissions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Phase</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Submitted</th>
                <th className="text-left px-3 py-2 font-semibold">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-t border-navy/5">
                  <td className="px-3 py-2 text-navy/80 text-xs">
                    {PHASE_LABELS[s.phase as keyof typeof PHASE_LABELS] ?? s.phase}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-navy/5 text-navy/70">
                      {s.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-navy/60">
                    {fmtDate(s.submitted_at)}
                  </td>
                  <td className="px-3 py-2 text-xs text-navy/60">
                    {fmtDate(s.reviewed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Evaluations ────────────────────────────────────────────────── */}
      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/5 text-[10px] font-semibold uppercase tracking-widest text-navy/50">
          Evaluations ({evaluations.length})
        </div>
        {evaluations.length === 0 ? (
          <div className="p-6 text-center text-sm text-navy/50">
            No scores recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Evaluator</th>
                <th className="text-left px-3 py-2 font-semibold">Score</th>
                <th className="text-left px-3 py-2 font-semibold">Recommendation</th>
                <th className="text-left px-3 py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id} className="border-t border-navy/5">
                  <td className="px-3 py-2 text-navy/80 text-xs">
                    {e.evaluator_role ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-navy">
                    {e.total_score ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-navy/70">
                    {e.recommendation ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-navy/60">
                    {fmtDate(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Audit footer ───────────────────────────────────────────────── */}
      <div className="text-[11px] text-navy/40 px-1">
        Team ID: <code>{team.id}</code> · Last updated {fmtDate(team.updated_at)}
      </div>
    </div>
  );
}
