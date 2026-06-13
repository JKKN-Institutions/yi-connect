"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { requirePlatformAdmin } from "./national-admins";
import type { ActionResult } from "./editions";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

type CriterionInput = {
  key: string;
  label: string;
  max: number;
  description?: string;
};

function parseCriteria(raw: string): {
  ok: boolean;
  criteria?: CriterionInput[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "Criteria must be a JSON array." };
    }
    const cleaned: CriterionInput[] = [];
    for (const c of parsed) {
      if (typeof c?.key !== "string" || !c.key) {
        return { ok: false, error: "Each criterion needs a string 'key'." };
      }
      if (typeof c?.label !== "string" || !c.label) {
        return { ok: false, error: "Each criterion needs a 'label'." };
      }
      const max = Number(c.max);
      if (!Number.isFinite(max) || max <= 0) {
        return { ok: false, error: `Invalid max for ${c.key}.` };
      }
      cleaned.push({
        key: c.key,
        label: c.label,
        max,
        description:
          typeof c.description === "string" ? c.description : undefined,
      });
    }
    return { ok: true, criteria: cleaned };
  } catch {
    return { ok: false, error: "Criteria must be valid JSON." };
  }
}

// ─── CREATE RUBRIC ──────────────────────────────────────────────────
export async function createRubric(
  editionId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim() || "chapter_final";
  const threshold_raw = String(
    formData.get("threshold_for_national") ?? ""
  ).trim();
  const threshold_for_national = threshold_raw ? Number(threshold_raw) : null;
  const criteria_raw = String(formData.get("criteria") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };

  const p = parseCriteria(criteria_raw);
  if (!p.ok || !p.criteria) return { ok: false, error: p.error ?? "Bad criteria." };

  const total_max = p.criteria.reduce((sum, c) => sum + c.max, 0);

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("rubrics")
    .insert({
      edition_id: editionId,
      name,
      scope,
      criteria: p.criteria,
      total_max,
      threshold_for_national,
      is_default: false,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/rubrics");
  redirect("/yi-future/national/admin/rubrics");
}

export async function updateRubric(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim() || "chapter_final";
  const threshold_raw = String(
    formData.get("threshold_for_national") ?? ""
  ).trim();
  const threshold_for_national = threshold_raw ? Number(threshold_raw) : null;
  const criteria_raw = String(formData.get("criteria") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };

  const p = parseCriteria(criteria_raw);
  if (!p.ok || !p.criteria) return { ok: false, error: p.error ?? "Bad criteria." };
  const total_max = p.criteria.reduce((sum, c) => sum + c.max, 0);

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("rubrics")
    .update({
      name,
      scope,
      criteria: p.criteria,
      total_max,
      threshold_for_national,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/rubrics");
  redirect("/yi-future/national/admin/rubrics");
}

export async function setDefaultRubric(
  id: string,
  editionId: string,
  scope: string
): Promise<ActionResult> {
  await requireAuth();
  await requirePlatformAdmin();
  const svc = await createServiceClient();
  // Clear other defaults with same scope
  await svc
    .schema("future")
    .from("rubrics")
    .update({ is_default: false })
    .eq("edition_id", editionId)
    .eq("scope", scope);
  // Set this one
  const { error } = await svc
    .schema("future")
    .from("rubrics")
    .update({ is_default: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/national/admin/rubrics");
  return { ok: true, message: "Default updated." };
}

export async function deleteRubric(id: string): Promise<ActionResult> {
  await requireAuth();
  await requirePlatformAdmin();
  const svc = await createServiceClient();
  // Guard: block delete if any evaluations exist
  const { count } = await svc
    .schema("future")
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .eq("rubric_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot delete — ${count} evaluations use this rubric.`,
    };
  }
  const { error } = await svc
    .schema("future")
    .from("rubrics")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/national/admin/rubrics");
  return { ok: true, message: "Rubric removed." };
}
