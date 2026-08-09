"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { readSession } from "@/app/yi-future/actions/auth";

type DeliverablePhase = Database["future"]["Enums"]["deliverable_phase"];
type SubmissionStatus = Database["future"]["Enums"]["submission_status"];

/**
 * SECURITY: submission writes are STUDENT-facing and go through the service
 * client (RLS-bypassing), so the delegate identity MUST come from the signed
 * session cookie — a caller-supplied delegateId is attacker-controlled and is
 * ignored. Proves the session delegate actually belongs to `teamId` (a
 * team_members row, or the team's captain/leader for legacy rows).
 */
async function resolveTeamMemberSession(
  teamId: string
): Promise<{ delegateId: string } | { error: string }> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const { data: teamRow } = await svc
    .schema("future")
    .from("teams")
    .select("id, captain_id, leader_delegate_id")
    .eq("id", teamId)
    .maybeSingle();
  const team = teamRow as unknown as {
    id: string;
    captain_id: string | null;
    leader_delegate_id: string | null;
  } | null;
  if (!team) return { error: "Team not found." };

  if (
    team.captain_id !== session.id &&
    team.leader_delegate_id !== session.id
  ) {
    const { data: member } = await svc
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .eq("team_id", teamId)
      .eq("delegate_id", session.id)
      .maybeSingle();
    if (!member) {
      return { error: "You must be on this team to submit deliverables." };
    }
  }

  return { delegateId: session.id };
}

const PHASE_A_FIELDS = ["problem_definition_url"] as const;
const PHASE_B_FIELDS = ["draft_solution_url"] as const;
const PHASE_C_FIELDS = [
  "final_policy_document_url",
  "final_execution_plan_url",
  "final_scalability_model_url",
  "final_presentation_deck_url",
] as const;

type UrlField =
  | (typeof PHASE_A_FIELDS)[number]
  | (typeof PHASE_B_FIELDS)[number]
  | (typeof PHASE_C_FIELDS)[number];

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function collectUrls(
  phase: DeliverablePhase,
  formData: FormData
): { values: Partial<Record<UrlField, string | null>>; errors: string[] } {
  const fields =
    phase === "phase_a"
      ? PHASE_A_FIELDS
      : phase === "phase_b"
        ? PHASE_B_FIELDS
        : PHASE_C_FIELDS;

  const values: Partial<Record<UrlField, string | null>> = {};
  const errors: string[] = [];

  for (const field of fields) {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) {
      values[field] = null;
      continue;
    }
    if (!isValidUrl(raw)) {
      errors.push(`${field} is not a valid http(s) URL.`);
      continue;
    }
    values[field] = raw;
  }
  return { values, errors };
}

// ─── SAVE DRAFT ─────────────────────────────────────────────────────
/**
 * Team-member callable: saves (or creates) a draft submission for a team+phase.
 * NOT an admin action — the writer is the delegate SESSION, and `input.delegateId`
 * is accepted for call-site compatibility but deliberately never trusted.
 */
export async function saveSubmissionDraft(input: {
  teamId: string;
  phase: DeliverablePhase;
  delegateId: string | null;
  formData: FormData;
}): Promise<ActionResult> {
  const auth = await resolveTeamMemberSession(input.teamId);
  if ("error" in auth) return { ok: false, error: auth.error };

  const { values, errors } = collectUrls(input.phase, input.formData);
  if (errors.length) return { ok: false, error: errors.join(" · ") };

  const summary =
    String(input.formData.get("summary") ?? "").trim() || null;

  const svc = await createServiceClient();

  // Upsert on (team_id, phase). If already submitted/approved, keep those fields.
  const { error } = await svc
    .schema("future")
    .from("submissions")
    .upsert(
      {
        team_id: input.teamId,
        phase: input.phase,
        ...values,
        summary,
        status: "draft",
        submitted_by_delegate_id: auth.delegateId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,phase" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/submissions");
  revalidatePath("/yi-future/chapter/submissions");
  return { ok: true, message: "Draft saved." };
}

// ─── SUBMIT (captain action) ────────────────────────────────────────
export async function submitSubmission(input: {
  teamId: string;
  phase: DeliverablePhase;
  delegateId: string;
  formData: FormData;
}): Promise<ActionResult> {
  // Same rule as saveSubmissionDraft: identity comes from the session, not
  // from the caller-supplied delegateId.
  const auth = await resolveTeamMemberSession(input.teamId);
  if ("error" in auth) return { ok: false, error: auth.error };

  const { values, errors } = collectUrls(input.phase, input.formData);
  if (errors.length) return { ok: false, error: errors.join(" · ") };

  // Enforce at least one URL present at submit-time
  const hasAny = Object.values(values).some((v) => !!v);
  if (!hasAny) {
    return {
      ok: false,
      error: "Provide at least one deliverable URL before submitting.",
    };
  }

  // For Phase C require all 4
  if (input.phase === "phase_c") {
    const missing = PHASE_C_FIELDS.filter((f) => !values[f]);
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Phase C requires all 4 artifacts. Missing: ${missing.join(", ")}`,
      };
    }
  }

  const summary =
    String(input.formData.get("summary") ?? "").trim() || null;

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("submissions")
    .upsert(
      {
        team_id: input.teamId,
        phase: input.phase,
        ...values,
        summary,
        status: "submitted" as SubmissionStatus,
        submitted_by_delegate_id: auth.delegateId,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,phase" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/submissions");
  revalidatePath("/yi-future/chapter/submissions");
  return { ok: true, message: "Submitted for review." };
}

// ─── ADMIN REVIEW ──────────────────────────────────────────────────
export async function reviewSubmission(
  submissionId: string,
  decision: "approved" | "rejected",
  feedback: string | null
): Promise<ActionResult> {
  const svc = await createServiceClient();

  // Resolve the submission's OWN chapter and gate on it, so a chair of chapter
  // A cannot approve/reject chapter B's work. Fails CLOSED: an unknown
  // submission yields a null chapter, which requireChapterAdmin denies (unless
  // the caller is national). The gate runs before the not-found return so an
  // anonymous caller can never use this as an id oracle.
  const { data: subRow } = await svc
    .schema("future")
    .from("submissions")
    .select("id, team_id")
    .eq("id", submissionId)
    .maybeSingle();
  const sub = subRow as unknown as { id: string; team_id: string } | null;

  let chapterId: string | null = null;
  if (sub) {
    const { data: teamRow } = await svc
      .schema("future")
      .from("teams")
      .select("chapter_id")
      .eq("id", sub.team_id)
      .maybeSingle();
    chapterId =
      (teamRow as unknown as { chapter_id: string } | null)?.chapter_id ?? null;
  }
  await requireChapterAdmin(chapterId);
  if (!sub) return { ok: false, error: "Submission not found." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await svc
    .schema("future")
    .from("submissions")
    .update({
      status: decision,
      feedback: feedback ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/submissions");
  revalidatePath("/yi-future/me/submissions");
  return {
    ok: true,
    message: decision === "approved" ? "Approved." : "Rejected.",
  };
}
