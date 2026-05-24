"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";

type DeliverablePhase = Database["future"]["Enums"]["deliverable_phase"];
type SubmissionStatus = Database["future"]["Enums"]["submission_status"];

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
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
 * Captain-callable: saves (or creates) a draft submission for a team+phase.
 * Does NOT require admin auth — uses service role plus the delegate_id passed in.
 */
export async function saveSubmissionDraft(input: {
  teamId: string;
  phase: DeliverablePhase;
  delegateId: string | null;
  formData: FormData;
}): Promise<ActionResult> {
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
        submitted_by_delegate_id: input.delegateId,
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
        submitted_by_delegate_id: input.delegateId,
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
  await requireAuth();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const svc = await createServiceClient();
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
