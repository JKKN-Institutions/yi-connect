import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  saveSubmissionDraft,
  submitSubmission,
} from "@/app/yi-future/actions/submissions";
import { DeliverableUpload } from "@/components/yi-future/submissions/DeliverableUpload";
import { SopDownloadCard } from "@/components/yi-future/SopDownloadCard";
import type { Database } from "@/types/yi-future/database";

type DeliverablePhase = Database["future"]["Enums"]["deliverable_phase"];

type Team = {
  id: string;
  team_name: string;
  captain_id: string | null;
  problem_statement_id: string | null;
};

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

async function getCaptainTeam(delegateId: string): Promise<Team | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name, captain_id, problem_statement_id")
    .eq("captain_id", delegateId)
    .maybeSingle();
  return (data as unknown as Team) ?? null;
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

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-navy/5 text-navy/60",
  submitted: "bg-yi-saffron/10 text-yi-saffron",
  approved: "bg-yi-green/10 text-yi-green",
  rejected: "bg-red-100 text-red-700",
};

export default async function MySubmissionsPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const team = await getCaptainTeam(session.id);
  if (!team) {
    return (
      <div className="space-y-5">
        <SopDownloadCard />
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="text-lg font-bold text-navy">Captain only</h2>
          <p className="mt-2 text-sm text-navy/60">
            Only captains can file deliverables for their team — but anyone can
            read the submission format above.
          </p>
          <Link
            href="/yi-future/me"
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

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
  const byPhase = new Map<DeliverablePhase, Submission>();
  for (const s of submissions) byPhase.set(s.phase, s);

  async function saveDraftA(formData: FormData) {
    "use server";
    await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_a",
      delegateId: session!.id,
      formData,
    });
  }
  async function submitA(formData: FormData) {
    "use server";
    await submitSubmission({
      teamId: team!.id,
      phase: "phase_a",
      delegateId: session!.id,
      formData,
    });
  }
  async function saveDraftB(formData: FormData) {
    "use server";
    await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_b",
      delegateId: session!.id,
      formData,
    });
  }
  async function submitB(formData: FormData) {
    "use server";
    await submitSubmission({
      teamId: team!.id,
      phase: "phase_b",
      delegateId: session!.id,
      formData,
    });
  }
  async function saveDraftC(formData: FormData) {
    "use server";
    await saveSubmissionDraft({
      teamId: team!.id,
      phase: "phase_c",
      delegateId: session!.id,
      formData,
    });
  }
  async function submitC(formData: FormData) {
    "use server";
    await submitSubmission({
      teamId: team!.id,
      phase: "phase_c",
      delegateId: session!.id,
      formData,
    });
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
          3 phases, each produces a deliverable. Phase C produces 4 artifacts.
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
          hint="Public share link."
        />
      </PhaseCard>

      <PhaseCard
        phase="phase_c"
        title="Phase C · Final"
        summary="Four artifacts required: policy doc, execution plan, scalability model, and pitch deck."
        saveAction={saveDraftC}
        submitAction={submitC}
      >
        <DeliverableUpload
          label="Final Policy Document"
          name="final_policy_document_url"
          defaultValue={subC?.final_policy_document_url ?? ""}
          required
        />
        <DeliverableUpload
          label="Final Execution Plan"
          name="final_execution_plan_url"
          defaultValue={subC?.final_execution_plan_url ?? ""}
          required
        />
        <DeliverableUpload
          label="Scalability Model"
          name="final_scalability_model_url"
          defaultValue={subC?.final_scalability_model_url ?? ""}
          required
        />
        <DeliverableUpload
          label="Presentation Deck"
          name="final_presentation_deck_url"
          defaultValue={subC?.final_presentation_deck_url ?? ""}
          required
        />
      </PhaseCard>
    </div>
  );
}
