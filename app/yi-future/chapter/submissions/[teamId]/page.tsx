import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { SUBMISSION_BUCKET } from "@/lib/yi-future/submission-files";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { reviewSubmission } from "@/app/yi-future/actions/submissions";
import { PHASES, PHASE_LABELS, type Phase } from "@/lib/yi-future/constants";

type Team = {
  id: string;
  chapter_id: string;
  team_name: string;
  captain_id: string | null;
  problem_statements: { title: string } | null;
};

type Submission = {
  id: string;
  team_id: string;
  phase: Phase;
  status: string | null;
  summary: string | null;
  submitted_at: string | null;
  feedback: string | null;
  problem_definition_url: string | null;
  draft_solution_url: string | null;
  final_policy_document_url: string | null;
  final_execution_plan_url: string | null;
  final_scalability_model_url: string | null;
  final_presentation_deck_url: string | null;
  submitted_by_delegate_id: string | null;
  delegates: { full_name: string } | null;
};

async function getTeam(id: string): Promise<Team | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, chapter_id, team_name, captain_id, problem_statements(title)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Team) ?? null;
}

type SignedFile = { id: string; file_name: string; signedUrl: string | null };

/**
 * Uploaded files for these submissions, each with a short-lived signed URL.
 *
 * Signed rather than public: the bucket holds students' own documents, and a
 * public object URL would be permanently replayable by anyone who saw it once.
 * One hour is plenty for a juror to open and read.
 */
async function getSignedFiles(
  submissionIds: string[]
): Promise<Map<string, SignedFile[]>> {
  const out = new Map<string, SignedFile[]>();
  if (submissionIds.length === 0) return out;

  const svc = await createServiceClient();
  // future.submission_files is not in the generated types -> loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("submission_files")
    .select("id, submission_id, slot, file_path, file_name")
    .in("submission_id", submissionIds)
    .order("uploaded_at", { ascending: true });

  for (const row of ((data as {
    id: string;
    submission_id: string;
    slot: string;
    file_path: string;
    file_name: string;
  }[] | null) ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: signed } = await (svc as any).storage
      .from(SUBMISSION_BUCKET)
      .createSignedUrl(row.file_path, 60 * 60);
    const key = `${row.submission_id}:${row.slot}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push({
      id: row.id,
      file_name: row.file_name,
      signedUrl: (signed as { signedUrl?: string } | null)?.signedUrl ?? null,
    });
  }
  return out;
}

async function getSubmissions(teamId: string): Promise<Submission[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("submissions")
    .select(
      "id, team_id, phase, status, summary, submitted_at, feedback, problem_definition_url, draft_solution_url, final_policy_document_url, final_execution_plan_url, final_scalability_model_url, final_presentation_deck_url, submitted_by_delegate_id, delegates:delegates!submissions_submitted_by_delegate_id_fkey(full_name)"
    )
    .eq("team_id", teamId);
  return (data as unknown as Submission[]) ?? [];
}

function ArtifactRow({
  label,
  url,
  files = [],
}: {
  label: string;
  url: string | null;
  /** Files the team uploaded for this slot, each with a ready signed URL.
   *  These open immediately — no Drive access request, which is the whole
   *  reason uploads exist. */
  files?: { id: string; file_name: string; signedUrl: string | null }[];
}): React.JSX.Element {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-navy/70">
          {label}
        </span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="text-sm font-mono text-yi-gold hover:underline truncate max-w-[300px]"
          >
            Open link →
          </a>
        ) : files.length === 0 ? (
          <span className="text-xs text-navy/30">—</span>
        ) : null}
      </div>
      {files.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-end gap-2">
              {f.signedUrl ? (
                <a
                  href={f.signedUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-yi-green font-semibold hover:underline truncate max-w-[300px]"
                >
                  ⬇ {f.file_name}
                </a>
              ) : (
                <span className="text-xs text-red-600">
                  {f.file_name} — could not be opened
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (team.chapter_id !== ctx.chapterId) redirect("/yi-future/chapter/submissions");

  const subs = await getSubmissions(teamId);
  const signedFiles = await getSignedFiles(subs.map((x) => x.id));
  const slotFiles = (sub: Submission | undefined, slot: string): SignedFile[] =>
    sub ? signedFiles.get(`${sub.id}:${slot}`) ?? [] : [];
  const byPhase = new Map<Phase, Submission>();
  for (const s of subs) byPhase.set(s.phase, s);

  async function approve(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const fb = String(formData.get("feedback") ?? "").trim() || null;
    await reviewSubmission(id, "approved", fb);
  }

  async function reject(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const fb = String(formData.get("feedback") ?? "").trim() || null;
    await reviewSubmission(id, "rejected", fb);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/chapter/submissions"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Submissions
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-navy">
          {team.team_name}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {team.problem_statements?.title ?? "No problem picked"}
        </p>
      </div>

      {PHASES.map((p) => {
        const s = byPhase.get(p);
        return (
          <section
            key={p}
            className="bg-white border border-navy/10 rounded-lg p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-navy">{PHASE_LABELS[p]}</h3>
                {s?.submitted_at && (
                  <div className="text-xs text-navy/50 mt-0.5">
                    Submitted{" "}
                    {new Date(s.submitted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {s.delegates && (
                      <span> by {s.delegates.full_name}</span>
                    )}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  s?.status === "approved"
                    ? "bg-yi-green/10 text-yi-green"
                    : s?.status === "submitted"
                      ? "bg-yi-saffron/10 text-yi-saffron"
                      : s?.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-navy/5 text-navy/50"
                }`}
              >
                {s?.status ?? "not started"}
              </span>
            </div>

            {!s ? (
              <p className="text-sm text-navy/40 italic">
                No submission yet.
              </p>
            ) : (
              <>
                <div className="border border-navy/10 rounded-md p-3 bg-navy/[0.02] mb-3">
                  {p === "phase_a" && (
                    <ArtifactRow
                      label="Problem Definition"
                      url={s.problem_definition_url}
                      files={slotFiles(s, "problem_definition")}
                    />
                  )}
                  {p === "phase_b" && (
                    <ArtifactRow
                      label="Draft Solution"
                      url={s.draft_solution_url}
                      files={slotFiles(s, "draft_solution")}
                    />
                  )}
                  {p === "phase_c" && (
                    <>
                      <ArtifactRow
                        label="Final Report"
                        url={s.final_policy_document_url}
                        files={slotFiles(s, "final_policy_document")}
                      />
                      <ArtifactRow
                        label="Presentation Deck"
                        url={s.final_presentation_deck_url}
                        files={slotFiles(s, "final_presentation_deck")}
                      />
                      {/* Phase C used to ask for four separate documents. These
                          two rows are shown ONLY where a team actually filled
                          them, so nothing already submitted disappears from the
                          jury's view, while new submissions stay to two rows. */}
                      {(s.final_execution_plan_url ||
                        slotFiles(s, "final_execution_plan").length > 0) && (
                        <ArtifactRow
                          label="Execution Plan (earlier format)"
                          url={s.final_execution_plan_url}
                          files={slotFiles(s, "final_execution_plan")}
                        />
                      )}
                      {(s.final_scalability_model_url ||
                        slotFiles(s, "final_scalability_model").length > 0) && (
                        <ArtifactRow
                          label="Scalability Model (earlier format)"
                          url={s.final_scalability_model_url}
                          files={slotFiles(s, "final_scalability_model")}
                        />
                      )}
                    </>
                  )}
                </div>

                {s.summary && (
                  <div className="mb-3 p-3 border border-navy/10 rounded-md bg-white">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-1">
                      Team summary
                    </div>
                    <p className="text-sm text-navy/80">{s.summary}</p>
                  </div>
                )}

                {s.feedback && (
                  <div className="mb-3 p-3 border border-yi-gold/30 rounded-md bg-yi-gold/5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold mb-1">
                      Your feedback
                    </div>
                    <p className="text-sm text-navy/80">{s.feedback}</p>
                  </div>
                )}

                {s.status === "submitted" && (
                  <form className="space-y-2 pt-3 border-t border-navy/10">
                    <input type="hidden" name="id" value={s.id} />
                    <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1">
                      Feedback (optional for approve, recommended for reject)
                    </label>
                    <textarea
                      name="feedback"
                      rows={2}
                      placeholder="Notes for the team…"
                      className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        formAction={reject}
                        className="px-4 py-2 rounded-md text-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Reject
                      </button>
                      <button
                        type="submit"
                        formAction={approve}
                        className="px-4 py-2 rounded-md bg-yi-green text-ivory text-sm font-semibold hover:opacity-90"
                      >
                        Approve
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
