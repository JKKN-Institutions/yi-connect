import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  saveSubmissionDraft,
  submitSubmission,
} from "@/app/yi-future/actions/submissions";
import { DeliverableUpload } from "@/components/yi-future/submissions/DeliverableUpload";
import {
  SUBMISSION_BUCKET,
  type SubmissionFileRow,
  type SubmissionFileView,
} from "@/lib/yi-future/submission-files";
import { SopDownloadCard } from "@/components/yi-future/SopDownloadCard";
import type { Database } from "@/types/yi-future/database";

type DeliverablePhase = Database["future"]["Enums"]["deliverable_phase"];

type Team = {
  id: string;
  team_name: string;
  captain_id: string | null;
  leader_delegate_id: string | null;
  problem_statement_id: string | null;
};

/** The team this delegate files deliverables for, or why none can be shown. */
type TeamLookup =
  | { kind: "team"; team: Team }
  | { kind: "none" }
  | { kind: "several"; count: number }
  | { kind: "failed" };

type Submission = {
  id: string;
  team_id: string;
  phase: DeliverablePhase;
  status: string | null;
  summary: string | null;
  problem_definition_url: string | null;
  draft_solution_url: string | null;
  final_policy_document_url: string | null;
  final_execution_plan_url: string | null;
  final_scalability_model_url: string | null;
  final_presentation_deck_url: string | null;
  submitted_at: string | null;
  feedback: string | null;
};

const TEAM_FIELDS = "id, team_name, captain_id, leader_delegate_id, problem_statement_id";

/**
 * The delegate's team in the ACTIVE edition. Any member may file deliverables:
 * the save, submit and upload actions all accept the captain, the leader or a
 * team_members row. This page used to look up only a team the delegate
 * captained and showed every other member "Captain only", so a team whose
 * captain was away at a deadline could not submit at all.
 *
 * Fails CLOSED. A failed query, or a delegate with no member row who captains or
 * leads more than one team, gets an explicit state — never an arbitrary pick.
 */
async function getMyTeam(delegateId: string): Promise<TeamLookup> {
  const svc = await createServiceClient();
  const { data: editions, error: editionError } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true);
  if (editionError) return { kind: "failed" };
  const editionIds = ((editions as { id: string }[] | null) ?? []).map((e) => e.id);
  if (editionIds.length === 0) return { kind: "none" };

  // Plain queries per route onto a team, each held to the active edition.
  const [memberRows, asCaptain, asLeader] = await Promise.all([
    svc.schema("future").from("team_members").select("team_id").eq("delegate_id", delegateId),
    svc
      .schema("future")
      .from("teams")
      .select(TEAM_FIELDS)
      .in("edition_id", editionIds)
      .eq("captain_id", delegateId),
    svc
      .schema("future")
      .from("teams")
      .select(TEAM_FIELDS)
      .in("edition_id", editionIds)
      .eq("leader_delegate_id", delegateId),
  ]);
  if (memberRows.error || asCaptain.error || asLeader.error) return { kind: "failed" };

  const memberTeamIds = ((memberRows.data as { team_id: string }[] | null) ?? []).map(
    (r) => r.team_id
  );
  let asMember: Team[] = [];
  if (memberTeamIds.length > 0) {
    const { data, error } = await svc
      .schema("future")
      .from("teams")
      .select(TEAM_FIELDS)
      .in("edition_id", editionIds)
      .in("id", memberTeamIds);
    if (error) return { kind: "failed" };
    asMember = (data as unknown as Team[] | null) ?? [];
  }

  // The team_members row decides first. A delegate can hold only one per
  // edition (a unique constraint) and leaving a team deletes it, so it is
  // current. The captain and leader columns can outlive a move: on 2026-09-11
  // all six delegates linked to two teams were captain or leader of a team with
  // NO members, while their member row sat on the team they actually work in.
  // Preferring captain/leader there showed four of them an empty team and
  // refused a captain who could submit before.
  if (asMember.length > 1) return { kind: "several", count: asMember.length };
  if (asMember.length === 1) return { kind: "team", team: asMember[0] };

  // No member row: a team they captain or lead, if there is exactly one.
  const runs = new Map<string, Team>();
  for (const t of [
    ...((asCaptain.data as unknown as Team[] | null) ?? []),
    ...((asLeader.data as unknown as Team[] | null) ?? []),
  ]) {
    runs.set(t.id, t);
  }
  if (runs.size === 0) return { kind: "none" };
  if (runs.size === 1) return { kind: "team", team: [...runs.values()][0] };
  return { kind: "several", count: runs.size };
}

async function getSubmissions(teamId: string): Promise<Submission[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("submissions")
    .select(
      "id, team_id, phase, status, summary, problem_definition_url, draft_solution_url, final_policy_document_url, final_execution_plan_url, final_scalability_model_url, final_presentation_deck_url, submitted_at, feedback"
    )
    .eq("team_id", teamId);
  return (data as unknown as Submission[]) ?? [];
}

/** Files uploaded against these submissions, grouped by (submission, slot). */
async function getSubmissionFiles(
  submissionIds: string[]
): Promise<Map<string, SubmissionFileView[]>> {
  const grouped = new Map<string, SubmissionFileView[]>();
  if (submissionIds.length === 0) return grouped;
  const svc = await createServiceClient();
  // future.submission_files is not in the generated types (as with every table
  // added after the last regen) -> loose client, the established pattern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("submission_files")
    .select("id, submission_id, slot, file_path, file_name, size_bytes, content_type, uploaded_at")
    .in("submission_id", submissionIds)
    .order("uploaded_at", { ascending: true });
  const rows = (data as SubmissionFileRow[] | null) ?? [];

  // A short-lived link per file, so the team can open what they uploaded and
  // check it is the version the jury will read. The bucket stays private.
  const signed = new Map<string, string>();
  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: urls } = await (svc as any).storage
      .from(SUBMISSION_BUCKET)
      .createSignedUrls(rows.map((r) => r.file_path), 60 * 60);
    for (const u of ((urls as { path: string | null; signedUrl: string | null }[] | null) ?? [])) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  for (const row of rows) {
    const key = `${row.submission_id}:${row.slot}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ ...row, signedUrl: signed.get(row.file_path) ?? null });
  }
  return grouped;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-navy/5 text-navy/60",
  submitted: "bg-yi-saffron/10 text-yi-saffron",
  approved: "bg-yi-green/10 text-yi-green",
  rejected: "bg-red-100 text-red-700",
};

/**
 * Where to send a student whose save or submit was refused. The page used to
 * throw the result away, so a refusal looked exactly like a button that did
 * nothing. Capped so the message cannot bloat the URL.
 */
function submissionsRefusal(error: string): string {
  return `/yi-future/me/submissions?error=${encodeURIComponent(error.slice(0, 300))}`;
}

export default async function MySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");
  // A refused save or submit comes back here carrying its reason.
  const pageError = ((await searchParams).error ?? "").slice(0, 300) || null;

  const lookup = await getMyTeam(session.id);
  if (lookup.kind !== "team") {
    // Say exactly why there is nothing to file, instead of a silent bounce.
    const state =
      lookup.kind === "none"
        ? {
            icon: "👥",
            title: "Join a team first",
            body: "Deliverables are filed by a team. Once you are on one, any member can upload and submit here. Anyone can read the submission format above.",
            href: "/yi-future/me/team",
            label: "Go to my team →",
          }
        : lookup.kind === "several"
          ? {
              icon: "⚠️",
              title: "You are on more than one team",
              body: `This year's records list you on ${lookup.count} teams, so this page cannot tell which team's deliverables are yours. Ask your chapter admin to take you off the team you are not part of.`,
              href: "/yi-future/me",
              label: "← Back to dashboard",
            }
          : {
              icon: "⚠️",
              title: "Your team could not be loaded",
              body: "Nothing was changed. Try again in a moment.",
              href: "/yi-future/me/submissions",
              label: "Try again →",
            };
    return (
      <div className="space-y-5">
        <SopDownloadCard />
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">{state.icon}</div>
          <h2 className="text-lg font-bold text-navy">{state.title}</h2>
          <p className="mt-2 text-sm text-navy/60">{state.body}</p>
          <Link
            href={state.href}
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            {state.label}
          </Link>
        </div>
      </div>
    );
  }
  const team = lookup.team;

  /* ── Gate: team must have a problem statement ── */
  if (!team.problem_statement_id) {
    return (
      <div className="space-y-5">
        <div>
          <Link
            href="/yi-future/me"
            className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
          >
            &larr; Dashboard
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-navy">
            Deliverables &middot; {team.team_name}
          </h2>
        </div>
        <SopDownloadCard />
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="text-lg font-bold text-navy">
            Submissions unlock after problem selection
          </h2>
          <p className="mt-2 text-sm text-navy/60">
            Your team needs to pick a problem statement before you can submit
            deliverables.
          </p>
          <Link
            href="/yi-future/me/team"
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            Go to team page &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const submissions = await getSubmissions(team.id);
  const filesBySlot = await getSubmissionFiles(submissions.map((s) => s.id));

  /** Files already attached to one deliverable slot. */
  function slotFiles(sub: Submission | undefined, slot: string): SubmissionFileView[] {
    return sub ? filesBySlot.get(`${sub.id}:${slot}`) ?? [] : [];
  }

  /** A submitted or approved phase is locked, matching the rest of the form. */
  function locked(sub: Submission | undefined): boolean {
    return sub?.status === "submitted" || sub?.status === "approved";
  }
  const byPhase = new Map<DeliverablePhase, Submission>();
  for (const s of submissions) byPhase.set(s.phase, s);

  async function saveDraftA(formData: FormData) {
    "use server";
    const res = await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_a",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }
  async function submitA(formData: FormData) {
    "use server";
    const res = await submitSubmission({
      teamId: team!.id,
      phase: "phase_a",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }
  async function saveDraftB(formData: FormData) {
    "use server";
    const res = await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_b",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }
  async function submitB(formData: FormData) {
    "use server";
    const res = await submitSubmission({
      teamId: team!.id,
      phase: "phase_b",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }
  async function saveDraftC(formData: FormData) {
    "use server";
    const res = await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_c",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }
  async function submitC(formData: FormData) {
    "use server";
    const res = await submitSubmission({
      teamId: team!.id,
      phase: "phase_c",
      delegateId: session!.id,
      formData,
    });
    if (!res.ok) {
      redirect(
        submissionsRefusal(
          "error" in res && res.error ? res.error : "That did not go through — try again."
        )
      );
    }
    // Always land on the clean URL, so an earlier refusal does not linger.
    redirect("/yi-future/me/submissions");
  }

  function PhaseCard({
    phase,
    title,
    summary,
    saveAction,
    submitAction,
    children,
  }: {
    phase: DeliverablePhase;
    title: string;
    summary: string;
    saveAction: (fd: FormData) => Promise<void>;
    submitAction: (fd: FormData) => Promise<void>;
    children: React.ReactNode;
  }): React.JSX.Element {
    const existing = byPhase.get(phase);
    const status = existing?.status ?? "draft";
    const readOnly = status === "approved" || status === "submitted";

    return (
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-navy">{title}</h3>
            <p className="text-xs text-navy/60 mt-0.5">{summary}</p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest ${
              STATUS_STYLE[status] ?? "bg-navy/5 text-navy/60"
            }`}
          >
            {status}
          </span>
        </div>

        {/* A rejection with no reason used to show nothing but the pill, which
            left the team guessing what to fix. */}
        {status === "rejected" && !existing?.feedback?.trim() && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Your chapter admin sent this back without a reason. Ask them what to
            change, then upload a revised file and resubmit.
          </p>
        )}

        {existing?.feedback && (
          <div className="mb-4 p-3 rounded-md bg-navy/5 border border-navy/10">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-1">
              Admin feedback
            </div>
            <p className="text-sm text-navy/80">{existing.feedback}</p>
          </div>
        )}

        <form action={saveAction} className="space-y-4">
          {children}
          <div>
            <label
              htmlFor={`summary_${phase}`}
              className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
            >
              One-paragraph summary
            </label>
            <textarea
              id={`summary_${phase}`}
              name="summary"
              rows={3}
              defaultValue={existing?.summary ?? ""}
              disabled={readOnly}
              placeholder="What did your team do this phase?"
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm disabled:bg-navy/5"
            />
          </div>
          {!readOnly && (
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-navy/10">
              <button
                type="submit"
                formAction={saveAction}
                className="px-4 py-2 rounded-md text-sm font-semibold border border-navy/20 text-navy/70 hover:border-navy/40"
              >
                Save draft
              </button>
              <button
                type="submit"
                formAction={submitAction}
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Submit for review
              </button>
            </div>
          )}
          {readOnly && (
            <p className="text-xs text-navy/50 text-center pt-2 border-t border-navy/10">
              {status === "approved"
                ? "Approved — this deliverable is locked."
                : "Submitted. Wait for chapter admin review."}
            </p>
          )}
        </form>
      </section>
    );
  }

  const subA = byPhase.get("phase_a");
  const subB = byPhase.get("phase_b");
  const subC = byPhase.get("phase_c");

  return (
    <div className="space-y-5">
      {/* A refused save or submit used to leave this page looking unchanged,
          which read as a button that does nothing. */}
      {pageError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError}
        </div>
      )}
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Deliverables · {team.team_name}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          3 phases, each produces a deliverable. Phase C is a final report and a pitch deck.
        </p>
      </div>

      <SopDownloadCard />

      <PhaseCard
        phase="phase_a"
        title="Phase A · Problem Definition"
        summary="Understand the problem — produce a 1-page Problem Definition Note."
        saveAction={saveDraftA}
        submitAction={submitA}
      >
        <DeliverableUpload
          label="Problem Definition Note URL"
          name="problem_definition_url"
          defaultValue={subA?.problem_definition_url ?? ""}
          submissionId={subA?.id ?? null}
          slot="problem_definition"
          files={slotFiles(subA, "problem_definition")}
          readOnly={locked(subA)}
          hint="Public share link (Google Drive, Dropbox, etc.)"
        />
      </PhaseCard>

      <PhaseCard
        phase="phase_b"
        title="Phase B · Draft Framework"
        summary="Build your policy framework and solution outline."
        saveAction={saveDraftB}
        submitAction={submitB}
      >
        <DeliverableUpload
          label="Draft Solution URL"
          name="draft_solution_url"
          defaultValue={subB?.draft_solution_url ?? ""}
          submissionId={subB?.id ?? null}
          slot="draft_solution"
          files={slotFiles(subB, "draft_solution")}
          readOnly={locked(subB)}
          hint="Public share link."
        />
      </PhaseCard>

      <PhaseCard
        phase="phase_c"
        title="Phase C · Final"
        summary="Two things: your final report, and your pitch deck."
        saveAction={saveDraftC}
        submitAction={submitC}
      >
        {/* One report, not three. Teams were pasting the same link into the
            policy / execution / scalability fields anyway (26 of 108 used an
            identical link for all three), and the jury rubric scores criteria
            rather than artifacts — so a single consolidated report loses
            nothing and stops the jury opening the same file three times. */}
        <DeliverableUpload
          label="Final Report"
          name="final_policy_document_url"
          defaultValue={subC?.final_policy_document_url ?? ""}
          submissionId={subC?.id ?? null}
          slot="final_policy_document"
          files={slotFiles(subC, "final_policy_document")}
          readOnly={locked(subC)}
          hint="One document covering your policy, how it would be executed, and how it scales."
          required
        />
        <DeliverableUpload
          label="Presentation Deck"
          name="final_presentation_deck_url"
          defaultValue={subC?.final_presentation_deck_url ?? ""}
          submissionId={subC?.id ?? null}
          slot="final_presentation_deck"
          files={slotFiles(subC, "final_presentation_deck")}
          readOnly={locked(subC)}
          required
        />

        {/* Teams who submitted under the old four-artifact format keep those
            documents; the fields are shown read-only so nothing they uploaded
            silently disappears from their own view. */}
        {(subC?.final_execution_plan_url || subC?.final_scalability_model_url) && (
          <div className="rounded-md border border-navy/10 bg-navy/[0.02] p-3 space-y-2">
            <p className="text-xs text-navy/50">
              Submitted earlier, when Phase C asked for four separate documents.
              These are kept with your submission.
            </p>
            {subC?.final_execution_plan_url && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-navy/60">
                  Execution Plan
                </span>
                <a
                  href={subC.final_execution_plan_url}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-yi-gold hover:underline truncate max-w-[220px]"
                >
                  Open →
                </a>
              </div>
            )}
            {subC?.final_scalability_model_url && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-navy/60">
                  Scalability Model
                </span>
                <a
                  href={subC.final_scalability_model_url}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-yi-gold hover:underline truncate max-w-[220px]"
                >
                  Open →
                </a>
              </div>
            )}
            {/* Preserved on save so switching the form does not erase them. */}
            <input type="hidden" name="final_execution_plan_url" value={subC?.final_execution_plan_url ?? ""} />
            <input type="hidden" name="final_scalability_model_url" value={subC?.final_scalability_model_url ?? ""} />
          </div>
        )}
      </PhaseCard>
    </div>
  );
}
