import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  saveMentorEvaluation,
  getMentorEvaluations,
} from "@/app/yi-future/actions/mentor-evaluations";
import {
  MENTOR_RUBRIC,
  type MentorScores,
  MENTOR_CRITERION_KEYS,
} from "@/lib/yi-future/rubric-mentor";

type Team = {
  id: string;
  team_name: string;
  chapter_id: string;
  edition_id: string;
  chapters: { name: string; city: string } | null;
  problem_statements: { title: string; short_description: string } | null;
};

type PhaseEventRow = {
  id: string;
  title: string;
  phase: string;
  type: string;
  scheduled_at: string;
};

type ExistingMentorEval = {
  id: string;
  team_id: string;
  mentor_id: string;
  phase_event_id: string | null;
  participation: number | null;
  submission_quality: number | null;
  progress: number | null;
  engagement: number | null;
  growth: number | null;
  total_score: number | null;
  notes: string | null;
  status: string | null;
};

async function getTeam(id: string): Promise<Team | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, chapter_id, edition_id, chapters(name, city), problem_statements(title, short_description)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Team) ?? null;
}

async function getPhaseEvents(
  editionId: string,
  chapterId: string
): Promise<PhaseEventRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, title, phase, type, scheduled_at")
    .eq("edition_id", editionId)
    .eq("chapter_id", chapterId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as PhaseEventRow[]) ?? [];
}

async function getExistingForPhase(
  mentorId: string,
  teamId: string,
  phaseEventId: string | null
): Promise<ExistingMentorEval | null> {
  const svc = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (svc as any)
    .schema("future")
    .from("mentor_evaluations")
    .select(
      "id, team_id, mentor_id, phase_event_id, participation, submission_quality, progress, engagement, growth, total_score, notes, status"
    )
    .eq("mentor_id", mentorId)
    .eq("team_id", teamId);
  const q = phaseEventId
    ? base.eq("phase_event_id", phaseEventId)
    : base.is("phase_event_id", null);
  const { data } = await q.maybeSingle();
  return (data as unknown as ExistingMentorEval) ?? null;
}

function fmtPhaseEventLabel(pe: PhaseEventRow): string {
  const date = new Date(pe.scheduled_at);
  const dateStr = isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
  return `${pe.phase} · ${pe.title}${dateStr ? ` (${dateStr})` : ""}`;
}

export default async function MentorScoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ phase_event_id?: string }>;
}) {
  const session = await readSession();
  if (!session || session.type !== "mentor") redirect("/yi-future/join");

  const { teamId } = await params;
  const { phase_event_id: rawPhaseEventId } = await searchParams;
  const team = await getTeam(teamId);
  if (!team) notFound();

  // Edition must match
  if (team.edition_id !== session.edition_id) redirect("/yi-future/mentor");

  // Verify mentor↔team assignment if any exist for this team
  const svc = await createServiceClient();
  const { data: assignments } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .select("mentor_id")
    .eq("team_id", teamId);
  const list = (assignments ?? []) as { mentor_id: string }[];
  if (list.length > 0 && !list.some((a) => a.mentor_id === session.id)) {
    redirect("/yi-future/mentor");
  }

  const [phaseEvents, history] = await Promise.all([
    getPhaseEvents(team.edition_id, team.chapter_id),
    getMentorEvaluations(teamId),
  ]);

  const selectedPhaseEventId =
    rawPhaseEventId && phaseEvents.some((pe) => pe.id === rawPhaseEventId)
      ? rawPhaseEventId
      : null;

  const existing = await getExistingForPhase(
    session.id,
    teamId,
    selectedPhaseEventId
  );

  const submitted = existing?.status === "submitted";

  async function save(formData: FormData) {
    "use server";
    const sess = await readSession();
    if (!sess || sess.type !== "mentor") return;

    const phaseRaw = String(formData.get("phase_event_id") ?? "").trim();
    const phaseEventId = phaseRaw === "" ? null : phaseRaw;

    const scores: MentorScores = {
      participation: Number(formData.get("score_participation") ?? 0),
      submission_quality: Number(formData.get("score_submission_quality") ?? 0),
      progress: Number(formData.get("score_progress") ?? 0),
      engagement: Number(formData.get("score_engagement") ?? 0),
      growth: Number(formData.get("score_growth") ?? 0),
    };
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const submit = formData.get("_submit") === "1";

    await saveMentorEvaluation({
      teamId: teamId!,
      mentorId: sess.id,
      phaseEventId,
      scores,
      notes,
      submit,
    });
  }

  const phaseEventLabelMap = new Map<string, string>(
    phaseEvents.map((pe) => [pe.id, fmtPhaseEventLabel(pe)])
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/mentor"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Back
        </Link>
        <h2 className="mt-1 text-xl font-bold text-navy">{team.team_name}</h2>
        <p className="mt-1 text-xs text-navy/60">
          {team.chapters?.name ?? "Chapter"}
          {team.chapters?.city ? ` · ${team.chapters.city}` : ""}
        </p>
        <p className="mt-2 text-xs text-navy/60">
          {team.problem_statements?.title ?? "No problem picked yet"}
        </p>
        {team.problem_statements?.short_description && (
          <p className="mt-1 text-xs text-navy/50 italic">
            {team.problem_statements.short_description}
          </p>
        )}
      </div>

      {submitted && (
        <div className="bg-yi-green/10 border border-yi-green/30 rounded-md p-3 text-sm font-semibold text-yi-green">
          ✓ Submitted — {existing?.total_score ?? 0}/{MENTOR_RUBRIC.total_max}
        </div>
      )}

      {/* Phase event selector — GET form so URL drives selection + reload of existing */}
      <form
        method="get"
        className="bg-white border border-navy/10 rounded-lg p-4"
      >
        <label
          htmlFor="phase_event_id_select"
          className="block text-xs font-semibold text-navy mb-1.5"
        >
          This evaluation is for
        </label>
        <select
          id="phase_event_id_select"
          name="phase_event_id"
          defaultValue={selectedPhaseEventId ?? ""}
          className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
        >
          <option value="">Overall (no specific phase event)</option>
          {phaseEvents.map((pe) => (
            <option key={pe.id} value={pe.id}>
              {fmtPhaseEventLabel(pe)}
            </option>
          ))}
        </select>
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="text-xs font-semibold text-navy hover:text-yi-gold"
          >
            Load this scope →
          </button>
        </div>
      </form>

      <form action={save} className="space-y-4">
        {/* Hidden mirror so the save action knows which phase scope this submission is for */}
        <input
          type="hidden"
          name="phase_event_id"
          value={selectedPhaseEventId ?? ""}
        />

        <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-4">
          <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase">
            {MENTOR_RUBRIC.name}
          </div>
          {MENTOR_RUBRIC.criteria.map((c) => {
            const fieldName = `score_${c.key}`;
            const existingScore = existing
              ? (existing[c.key as keyof ExistingMentorEval] as number | null)
              : null;
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <label
                    htmlFor={fieldName}
                    className="text-sm font-bold text-navy"
                  >
                    {c.label}
                  </label>
                  <span className="text-[10px] font-mono text-navy/40">
                    max {c.max}
                  </span>
                </div>
                <p className="text-xs text-navy/50 mb-2 whitespace-pre-line">
                  {c.description}
                </p>
                <input
                  id={fieldName}
                  name={fieldName}
                  type="number"
                  min={0}
                  max={c.max}
                  step="1"
                  required
                  disabled={submitted}
                  defaultValue={
                    existingScore !== null && existingScore !== undefined
                      ? String(existingScore)
                      : ""
                  }
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm text-right font-mono font-bold disabled:bg-navy/5"
                />
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <label
            htmlFor="notes"
            className="block text-xs font-semibold text-navy mb-1.5"
          >
            Mentor notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            disabled={submitted}
            defaultValue={existing?.notes ?? ""}
            placeholder="What went well, what to push next week, blockers, anything the chapter admin should know."
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm disabled:bg-navy/5"
          />
        </div>

        {!submitted && (
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-navy/10">
            <button
              type="submit"
              name="_submit"
              value="0"
              className="px-4 py-2 rounded-md text-sm font-semibold border border-navy/20 text-navy/70 hover:border-navy/40"
            >
              Save draft
            </button>
            <button
              type="submit"
              name="_submit"
              value="1"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Submit evaluation
            </button>
          </div>
        )}
      </form>

      {/* History — past submitted evaluations across all phase events */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-navy/60 uppercase mb-2">
          Submitted history
        </div>
        {history.length === 0 ? (
          <div className="bg-white border border-navy/10 rounded-lg p-4 text-xs text-navy/50 text-center">
            No submitted evaluations yet for this team.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => {
              const scopeLabel = h.phase_event_id
                ? phaseEventLabelMap.get(h.phase_event_id) ??
                  "Phase event (unknown)"
                : "Overall";
              const isMine = h.mentor_id === session.id;
              return (
                <li
                  key={h.id}
                  className="bg-white border border-navy/10 rounded-lg p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-semibold text-navy">
                      {scopeLabel}
                    </div>
                    <div className="text-xs font-mono font-bold text-navy">
                      {h.total_score ?? 0}/{MENTOR_RUBRIC.total_max}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-navy/60">
                    {MENTOR_CRITERION_KEYS.map((k) => (
                      <span
                        key={k}
                        className="px-1.5 py-0.5 rounded bg-navy/5 font-mono"
                      >
                        {k}: {h[k] ?? 0}
                      </span>
                    ))}
                  </div>
                  {h.notes && (
                    <p className="mt-2 text-xs text-navy/70 whitespace-pre-line">
                      {h.notes}
                    </p>
                  )}
                  <div className="mt-1 text-[10px] text-navy/40">
                    {isMine ? "By you" : "By another mentor"}
                    {h.submitted_at
                      ? ` · ${new Date(h.submitted_at).toLocaleString("en-IN")}`
                      : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
