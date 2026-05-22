import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  saveEvaluation,
  getOtherJurorEvalsForTeam,
} from "@/app/yi-future/actions/evaluations";
import type { Rubric, CriteriaScores } from "@/lib/yi-future/rubric";

type Team = {
  id: string;
  team_name: string;
  chapter_id: string;
  edition_id: string;
  problem_statements: { title: string; short_description: string } | null;
};

type RubricRow = {
  id: string;
  name: string;
  criteria: Rubric["criteria"];
  total_max: number | null;
  threshold_for_national: number | null;
};

type EvaluationRow = {
  id: string;
  jury_id: string;
  team_id: string;
  event_id: string;
  rubric_id: string;
  status: string | null;
  criteria_scores: CriteriaScores;
  total_score: number;
  comments: string | null;
  q_and_a_notes: string | null;
  key_strengths: string | null;
  key_gaps: string | null;
  scalability_assessment: string | null;
  policy_relevance: string | null;
  recommendation: "strongly_recommend" | "recommend" | "not_recommended" | null;
};

type EventRow = { id: string; name: string };

async function getTeam(id: string): Promise<Team | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, chapter_id, edition_id, problem_statements(title, short_description)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Team) ?? null;
}

async function getRubric(
  editionId: string,
  scope: string
): Promise<RubricRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select("id, name, criteria, total_max, threshold_for_national")
    .eq("edition_id", editionId)
    .eq("scope", scope)
    .eq("is_default", true)
    .maybeSingle();
  return (data as unknown as RubricRow) ?? null;
}

async function getExistingEval(
  juryId: string,
  teamId: string
): Promise<EvaluationRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "id, jury_id, team_id, event_id, rubric_id, status, criteria_scores, total_score, comments, q_and_a_notes, key_strengths, key_gaps, scalability_assessment, policy_relevance, recommendation"
    )
    .eq("jury_id", juryId)
    .eq("team_id", teamId)
    .maybeSingle();
  return (data as unknown as EvaluationRow) ?? null;
}

async function getOrCreatePlaceholderEvent(
  chapterId: string,
  editionId: string
): Promise<EventRow | null> {
  // Use any chapter event for this edition; or fabricate one.
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as EventRow) ?? null;
}

export default async function JuryEvaluationPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await readSession();
  if (!session || session.type !== "jury") redirect("/yi-future/join");

  const { teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();

  // Verify jury assigned to team
  const svc = await createServiceClient();
  const { data: assignment } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .select("team_id")
    .eq("jury_id", session.id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!assignment) redirect("/yi-future/jury");

  const [rubric, existing, event] = await Promise.all([
    getRubric(team.edition_id, "chapter"),
    getExistingEval(session.id, teamId),
    getOrCreatePlaceholderEvent(team.chapter_id, team.edition_id),
  ]);

  if (!rubric) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <h2 className="text-lg font-bold text-navy">
          No rubric configured
        </h2>
        <p className="mt-2 text-sm text-navy/60">
          The Yi National admin needs to set a default &quot;chapter&quot; rubric
          for this edition before you can score.
        </p>
        <Link
          href="/yi-future/jury"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <h2 className="text-lg font-bold text-navy">
          No event configured yet
        </h2>
        <p className="mt-2 text-sm text-navy/60">
          Chapter admin needs to create a chapter final event before scoring.
        </p>
        <Link
          href="/yi-future/jury"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back
        </Link>
      </div>
    );
  }

  const submitted = existing?.status === "submitted";

  // Anti-bias [PRD §5.2]: only fetch others' evals after caller submitted
  const otherEvals = submitted
    ? await getOtherJurorEvalsForTeam({
        juryId: session.id,
        teamId: team.id,
        eventId: event.id,
      })
    : [];

  async function save(formData: FormData) {
    "use server";
    const scores: CriteriaScores = {};
    for (const c of rubric!.criteria) {
      const raw = String(formData.get(`score_${c.key}`) ?? "");
      scores[c.key] = raw ? Number(raw) : 0;
    }
    const comments = String(formData.get("comments") ?? "").trim() || null;
    const qaNotes = String(formData.get("q_and_a_notes") ?? "").trim() || null;
    const keyStrengths = String(formData.get("key_strengths") ?? "").trim() || null;
    const keyGaps = String(formData.get("key_gaps") ?? "").trim() || null;
    const scalabilityAssessment =
      String(formData.get("scalability_assessment") ?? "").trim() || null;
    const policyRelevance =
      String(formData.get("policy_relevance") ?? "").trim() || null;
    const recRaw = String(formData.get("recommendation") ?? "").trim();
    const recommendation =
      recRaw === "strongly_recommend" ||
      recRaw === "recommend" ||
      recRaw === "not_recommended"
        ? recRaw
        : null;
    const submit = formData.get("_submit") === "1";

    await saveEvaluation({
      juryId: session!.id,
      teamId: team!.id,
      eventId: event!.id,
      rubricId: rubric!.id,
      rubric: {
        name: rubric!.name,
        criteria: rubric!.criteria,
        total_max: rubric!.total_max ?? 0,
        threshold_for_national: rubric!.threshold_for_national ?? undefined,
      },
      scores,
      comments,
      qaNotes,
      keyStrengths,
      keyGaps,
      scalabilityAssessment,
      policyRelevance,
      recommendation,
      submit,
    });
  }

  return (
    <div className="space-y-5">
      {!submitted && (
        <div className="bg-navy/5 border border-navy/15 rounded-md p-3 text-xs text-navy/80">
          🛡️ Anonymous panel · Other jurors&apos; scores will be visible only
          after you submit yours. This protects against bias.
        </div>
      )}
      {/* ANTI-BIAS [PRD §5.1]: Jury sees only team_name, problem statement,
          submissions — never delegate/member names. Do NOT add a roster section. */}
      <div>
        <Link
          href="/yi-future/jury"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← All teams
        </Link>
        <h2 className="mt-1 text-xl font-bold text-navy">
          Team {team.team_name}
        </h2>
        <p className="mt-1 text-xs text-navy/60">
          {team.problem_statements?.title ?? "No problem picked"}
        </p>
        {team.problem_statements?.short_description && (
          <p className="mt-2 text-xs text-navy/50 italic">
            {team.problem_statements.short_description}
          </p>
        )}
        <p className="mt-2 text-[10px] uppercase tracking-widest text-navy/40">
          Anonymous panel · member names hidden
        </p>
      </div>

      {submitted && (
        <div className="bg-yi-green/10 border border-yi-green/30 rounded-md p-3 text-sm font-semibold text-yi-green">
          ✓ Submitted — {existing?.total_score}/{rubric.total_max}
        </div>
      )}

      <form action={save} className="space-y-4">
        <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-4">
          {rubric.criteria.map((c) => {
            const existingScore = existing?.criteria_scores?.[c.key];
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <label
                    htmlFor={`score_${c.key}`}
                    className="text-sm font-bold text-navy"
                  >
                    {c.label}
                  </label>
                  <span className="text-[10px] font-mono text-navy/40">
                    max {c.max}
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-navy/50 mb-2">{c.description}</p>
                )}
                <input
                  id={`score_${c.key}`}
                  name={`score_${c.key}`}
                  type="number"
                  min={0}
                  max={c.max}
                  step="0.5"
                  required
                  disabled={submitted}
                  defaultValue={
                    existingScore !== undefined ? String(existingScore) : ""
                  }
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm text-right font-mono font-bold disabled:bg-navy/5"
                />
              </div>
            );
          })}
        </div>

        {/* Yi Judging Kit — structured comments */}
        <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-4">
          <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase">
            Judge Comments
          </div>

          <CommentField
            id="key_strengths"
            label="Key Strengths"
            placeholder="What stood out — depth, clarity, originality, evidence?"
            disabled={submitted}
            defaultValue={existing?.key_strengths ?? ""}
          />
          <CommentField
            id="key_gaps"
            label="Key Gaps"
            placeholder="What was missing — assumptions, data, execution clarity?"
            disabled={submitted}
            defaultValue={existing?.key_gaps ?? ""}
          />
          <CommentField
            id="scalability_assessment"
            label="Scalability Assessment"
            placeholder="Will this work beyond a pilot? Across cities/states/India?"
            disabled={submitted}
            defaultValue={existing?.scalability_assessment ?? ""}
          />
          <CommentField
            id="policy_relevance"
            label="Policy Relevance"
            placeholder="How does this contribute to a national white paper / policy ask?"
            disabled={submitted}
            defaultValue={existing?.policy_relevance ?? ""}
          />
        </div>

        {/* Recommendation */}
        <fieldset className="bg-white border border-navy/10 rounded-lg p-4">
          <legend className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase px-2">
            Recommendation
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {(
              [
                {
                  v: "strongly_recommend",
                  label: "Strongly Recommend",
                  color: "border-yi-green/40 bg-yi-green/5 text-yi-green",
                },
                {
                  v: "recommend",
                  label: "Recommend",
                  color: "border-yi-gold/40 bg-yi-gold/5 text-navy",
                },
                {
                  v: "not_recommended",
                  label: "Not Recommended",
                  color: "border-red-300 bg-red-50 text-red-700",
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex items-center gap-2 p-3 min-h-[44px] rounded-md border-2 cursor-pointer ${opt.color} has-[input:checked]:ring-2 has-[input:checked]:ring-navy ${submitted ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="recommendation"
                  value={opt.v}
                  disabled={submitted}
                  defaultChecked={existing?.recommendation === opt.v}
                  className="accent-navy"
                />
                <span className="text-sm font-semibold">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Optional Q&A capture (kept from old form) */}
        <details className="bg-white border border-navy/10 rounded-lg p-4">
          <summary className="text-[10px] font-semibold tracking-widest text-navy/60 uppercase cursor-pointer">
            Q&amp;A notes &amp; free comments (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <CommentField
              id="q_and_a_notes"
              label="Q&A notes"
              placeholder="Questions you asked, how the team responded."
              disabled={submitted}
              defaultValue={existing?.q_and_a_notes ?? ""}
            />
            <CommentField
              id="comments"
              label="Anything else"
              placeholder="Free notes for the team or chapter admin."
              disabled={submitted}
              defaultValue={existing?.comments ?? ""}
            />
          </div>
        </details>

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

      {submitted && otherEvals.length > 0 && (
        <section className="pt-4 border-t border-navy/10">
          <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-2">
            Other panel scores
          </div>
          <p className="text-xs text-navy/50 mb-3">
            Visible now that you have submitted. {otherEvals.length} other{" "}
            {otherEvals.length === 1 ? "juror has" : "jurors have"} submitted.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherEvals.map((e) => (
              <div
                key={e.id}
                className="bg-white border border-navy/10 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-navy">
                      {e.jury_name ?? "—"}
                    </div>
                    {e.archetype && (
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                        {e.archetype}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-navy text-sm">
                    {e.total_score} / {rubric.total_max}
                  </div>
                </div>
                {e.recommendation && (
                  <div className="text-[11px] font-semibold">
                    {e.recommendation === "strongly_recommend" && (
                      <span className="text-yi-green">
                        Strongly Recommend
                      </span>
                    )}
                    {e.recommendation === "recommend" && (
                      <span className="text-navy">Recommend</span>
                    )}
                    {e.recommendation === "not_recommended" && (
                      <span className="text-red-700">Not Recommended</span>
                    )}
                  </div>
                )}
                {e.key_strengths && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
                      Strengths
                    </div>
                    <p className="text-xs text-navy/80 whitespace-pre-line">
                      {e.key_strengths}
                    </p>
                  </div>
                )}
                {e.key_gaps && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
                      Gaps
                    </div>
                    <p className="text-xs text-navy/80 whitespace-pre-line">
                      {e.key_gaps}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CommentField({
  id,
  label,
  placeholder,
  disabled,
  defaultValue,
}: {
  id: string;
  label: string;
  placeholder: string;
  disabled: boolean;
  defaultValue: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-navy mb-1.5"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={3}
        disabled={disabled}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm disabled:bg-navy/5"
      />
    </div>
  );
}
