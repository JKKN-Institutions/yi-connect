"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import type { ParliamentRole } from "@/lib/yip/constants";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type SubCriterion = {
  key: string; // dotted "<parentKey>.<childKey>" — unique across the rubric
  label: string;
  max_score: number;
};

export type RubricCriterion = {
  key: string;
  label: string;
  max_score: number;
  description?: string | null;
  /**
   * Handbook p.20: MP rubric has 17 sub-criteria nested in 5 parents.
   * When present, the parent max_score MUST equal the sum of child max_scores.
   * When absent (flat), the parent is scored as a single slot (legacy shape).
   */
  sub_criteria?: SubCriterion[] | null;
};

export type Rubric = {
  id: string;
  name: string;
  target_role: ParliamentRole;
  criteria: RubricCriterion[];
  total_max: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type RubricInput = {
  name: string;
  target_role: ParliamentRole;
  criteria: RubricCriterion[];
  is_default?: boolean;
  is_active?: boolean;
};

const RUBRICS_PATH = "/dashboard/admin/rubrics";
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
// Sub-criterion keys are dotted: "<parentKey>.<childKey>"
const SUB_KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

function normaliseCriteria(
  raw: unknown
): { ok: true; criteria: RubricCriterion[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Criteria must be an array" };
  }
  if (raw.length === 0) {
    return { ok: false, error: "At least one criterion is required" };
  }

  const cleaned: RubricCriterion[] = [];
  const seenKeys = new Set<string>();
  const seenChildKeys = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Partial<RubricCriterion>;
    const key = (row.key ?? "").trim();
    const label = (row.label ?? "").trim();
    const description = (row.description ?? "").toString().trim();

    if (!key) return { ok: false, error: `Row ${i + 1}: key is required` };
    if (!KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error: `Row ${i + 1}: key "${key}" must be lowercase_snake_case (letters, digits, underscores; starts with a letter)`,
      };
    }
    if (seenKeys.has(key)) {
      return { ok: false, error: `Duplicate criterion key: "${key}"` };
    }
    seenKeys.add(key);

    if (!label) return { ok: false, error: `Row ${i + 1}: label is required` };

    // ── Optional nested sub_criteria ────────────────────────────
    const rawSubs = Array.isArray(row.sub_criteria) ? row.sub_criteria : null;
    let cleanSubs: SubCriterion[] | null = null;
    let effectiveMax: number;

    if (rawSubs && rawSubs.length > 0) {
      const subs: SubCriterion[] = [];
      const parentChildKeys = new Set<string>();

      for (let j = 0; j < rawSubs.length; j++) {
        const sub = rawSubs[j] as Partial<SubCriterion>;
        const subKey = (sub.key ?? "").trim();
        const subLabel = (sub.label ?? "").trim();
        const subMax = Number(sub.max_score);

        if (!subKey) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key is required`,
          };
        }
        if (!SUB_KEY_PATTERN.test(subKey)) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key "${subKey}" must be dotted like "${key}.<child>"`,
          };
        }
        if (!subKey.startsWith(`${key}.`)) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key "${subKey}" must start with "${key}."`,
          };
        }
        if (parentChildKeys.has(subKey)) {
          return {
            ok: false,
            error: `Duplicate sub-criterion key within "${key}": "${subKey}"`,
          };
        }
        parentChildKeys.add(subKey);
        if (seenChildKeys.has(subKey)) {
          return {
            ok: false,
            error: `Duplicate sub-criterion key across rubric: "${subKey}"`,
          };
        }
        seenChildKeys.add(subKey);

        if (!subLabel) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: label is required`,
          };
        }
        if (!Number.isFinite(subMax) || subMax < 1) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: max_score must be an integer >= 1`,
          };
        }

        subs.push({
          key: subKey,
          label: subLabel,
          max_score: Math.round(subMax),
        });
      }

      const childSum = subs.reduce((s, sc) => s + sc.max_score, 0);
      // If the incoming parent max_score is present, require it to match the
      // derived child sum. Otherwise default the parent max to the child sum.
      const declaredMax = Number(row.max_score);
      if (Number.isFinite(declaredMax) && declaredMax > 0) {
        if (Math.round(declaredMax) !== childSum) {
          return {
            ok: false,
            error: `Row ${i + 1}: parent max_score (${Math.round(declaredMax)}) must equal sum of sub-criteria max_scores (${childSum})`,
          };
        }
      }
      effectiveMax = childSum;
      cleanSubs = subs;
    } else {
      const max = Number(row.max_score);
      if (!Number.isFinite(max) || max < 1) {
        return {
          ok: false,
          error: `Row ${i + 1}: max_score must be an integer >= 1`,
        };
      }
      effectiveMax = Math.round(max);
    }

    cleaned.push({
      key,
      label,
      max_score: effectiveMax,
      description: description || null,
      sub_criteria: cleanSubs,
    });
  }

  return { ok: true, criteria: cleaned };
}

function validateInput(
  input: RubricInput
):
  | { ok: true; clean: Omit<RubricInput, "criteria"> & { criteria: RubricCriterion[]; total_max: number } }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Name must be at least 3 characters" };
  }
  if (!input.target_role) {
    return { ok: false, error: "Target role is required" };
  }

  const parsed = normaliseCriteria(input.criteria);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const total_max = parsed.criteria.reduce((sum, c) => sum + c.max_score, 0);

  return {
    ok: true,
    clean: {
      name,
      target_role: input.target_role,
      is_default: !!input.is_default,
      is_active: input.is_active !== false,
      criteria: parsed.criteria,
      total_max,
    },
  };
}

function rowToRubric(row: {
  id: string;
  name: string;
  target_role: ParliamentRole;
  criteria: unknown;
  total_max: number;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}): Rubric {
  const criteria = Array.isArray(row.criteria)
    ? (row.criteria as RubricCriterion[]).map((c) => ({
        key: c.key,
        label: c.label,
        max_score: Number(c.max_score),
        description: c.description ?? null,
        sub_criteria: Array.isArray(c.sub_criteria)
          ? c.sub_criteria.map((sc) => ({
              key: sc.key,
              label: sc.label,
              max_score: Number(sc.max_score),
            }))
          : null,
      }))
    : [];
  return {
    id: row.id,
    name: row.name,
    target_role: row.target_role,
    criteria,
    total_max: row.total_max,
    is_default: !!row.is_default,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listRubrics(
  includeInactive: boolean = true
): Promise<Rubric[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("rubrics")
    .select("*")
    .order("target_role", { ascending: true })
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (!includeInactive) q = q.eq("is_active", true);

  const { data } = await q;
  return (data ?? []).map((r) =>
    rowToRubric({
      id: r.id,
      name: r.name,
      target_role: r.target_role,
      criteria: r.criteria,
      total_max: r.total_max,
      is_default: r.is_default,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })
  );
}

export async function getRubric(id: string): Promise<Rubric | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) return null;
  return rowToRubric({
    id: data.id,
    name: data.name,
    target_role: data.target_role,
    criteria: data.criteria,
    total_max: data.total_max,
    is_default: data.is_default,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}

async function clearDefaultForRole(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  role: ParliamentRole,
  exceptId?: string
): Promise<void> {
  let q = supabase
    .from("rubrics")
    .update({ is_default: false })
    .eq("target_role", role)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

export async function createRubric(
  input: RubricInput
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  if (clean.is_default) {
    await clearDefaultForRole(supabase, clean.target_role);
  }

  const { data, error } = await supabase
    .from("rubrics")
    .insert({
      name: clean.name,
      target_role: clean.target_role,
      criteria: clean.criteria as unknown as never,
      total_max: clean.total_max,
      is_default: clean.is_default,
      is_active: clean.is_active,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create rubric" };
  }

  revalidatePath(RUBRICS_PATH);
  return {
    success: true,
    data: rowToRubric({
      id: data.id,
      name: data.name,
      target_role: data.target_role,
      criteria: data.criteria,
      total_max: data.total_max,
      is_default: data.is_default,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }),
  };
}

export async function updateRubric(
  id: string,
  input: RubricInput
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  if (clean.is_default) {
    await clearDefaultForRole(supabase, clean.target_role, id);
  }

  const { data, error } = await supabase
    .from("rubrics")
    .update({
      name: clean.name,
      target_role: clean.target_role,
      criteria: clean.criteria as unknown as never,
      total_max: clean.total_max,
      is_default: clean.is_default,
      is_active: clean.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to update rubric" };
  }

  revalidatePath(RUBRICS_PATH);
  return {
    success: true,
    data: rowToRubric({
      id: data.id,
      name: data.name,
      target_role: data.target_role,
      criteria: data.criteria,
      total_max: data.total_max,
      is_default: data.is_default,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }),
  };
}

export async function cloneRubric(
  id: string,
  opts: { newName: string; newRole?: ParliamentRole }
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const source = await getRubric(id);
  if (!source) return { success: false, error: "Source rubric not found" };

  const newName = (opts.newName ?? "").trim();
  if (newName.length < 3) {
    return { success: false, error: "New name must be at least 3 characters" };
  }

  return createRubric({
    name: newName,
    target_role: opts.newRole ?? source.target_role,
    criteria: source.criteria.map((c) => ({
      ...c,
      sub_criteria: Array.isArray(c.sub_criteria)
        ? c.sub_criteria.map((sc) => ({ ...sc }))
        : null,
    })),
    is_default: false,
    is_active: true,
  });
}

export async function deactivateRubric(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { data: target } = await supabase
    .from("rubrics")
    .select("id, target_role, is_default, is_active")
    .eq("id", id)
    .single();

  if (!target) return { success: false, error: "Rubric not found" };

  if (target.is_default) {
    // Refuse to deactivate a default if no active alternative exists for the role.
    const { data: alternatives } = await supabase
      .from("rubrics")
      .select("id")
      .eq("target_role", target.target_role)
      .eq("is_active", true)
      .neq("id", id);

    if (!alternatives || alternatives.length === 0) {
      return {
        success: false,
        error:
          "Cannot deactivate the only default rubric for this role. Create or activate another rubric first.",
      };
    }
  }

  const { error } = await supabase
    .from("rubrics")
    .update({
      is_active: false,
      is_default: false, // a soft-deleted rubric should never be a default
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}

export async function reactivateRubric(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("rubrics")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}

export async function setAsDefault(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { data: target } = await supabase
    .from("rubrics")
    .select("id, target_role")
    .eq("id", id)
    .single();

  if (!target) return { success: false, error: "Rubric not found" };

  // Clear previous default(s) for this role…
  await clearDefaultForRole(supabase, target.target_role, id);

  // …then set this one as default AND ensure it's active.
  const { error } = await supabase
    .from("rubrics")
    .update({
      is_default: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}
