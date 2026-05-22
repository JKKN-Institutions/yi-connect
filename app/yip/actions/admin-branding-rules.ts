"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AdminBrandingCategory =
  | "logo"
  | "backdrop"
  | "collateral"
  | "fund"
  | "invitation"
  | "recognition";

export type AdminBrandingSeverity = "blocker" | "warning" | "advisory";

export type AdminBrandingRule = {
  id: string;
  rule_key: string;
  category: AdminBrandingCategory;
  title: string;
  description: string;
  handbook_page: number | null;
  requires_evidence: boolean;
  severity: AdminBrandingSeverity;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type BrandingRuleInput = {
  rule_key: string;
  category: AdminBrandingCategory;
  title: string;
  description: string;
  handbook_page?: number | null;
  requires_evidence?: boolean;
  severity?: AdminBrandingSeverity;
  sort_order?: number;
  is_active?: boolean;
};

const BRANDING_RULES_PATH = "/dashboard/admin/branding-rules";
const RULE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const VALID_CATEGORIES: AdminBrandingCategory[] = [
  "logo",
  "backdrop",
  "collateral",
  "fund",
  "invitation",
  "recognition",
];
const VALID_SEVERITIES: AdminBrandingSeverity[] = [
  "blocker",
  "warning",
  "advisory",
];

// ─── Validation ─────────────────────────────────────────────────

type CleanedInput = {
  rule_key: string;
  category: AdminBrandingCategory;
  title: string;
  description: string;
  handbook_page: number | null;
  requires_evidence: boolean;
  severity: AdminBrandingSeverity;
  sort_order: number;
  is_active: boolean;
};

function validateInput(
  input: BrandingRuleInput
): { ok: true; clean: CleanedInput } | { ok: false; error: string } {
  const rule_key = (input.rule_key ?? "").trim();
  if (!rule_key) return { ok: false, error: "rule_key is required" };
  if (!RULE_KEY_PATTERN.test(rule_key)) {
    return {
      ok: false,
      error: `rule_key "${rule_key}" must be lowercase_snake_case (letters, digits, underscores; starts with a letter)`,
    };
  }

  if (!VALID_CATEGORIES.includes(input.category)) {
    return {
      ok: false,
      error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
    };
  }

  const title = (input.title ?? "").trim();
  if (title.length < 3) {
    return { ok: false, error: "Title must be at least 3 characters" };
  }

  const description = (input.description ?? "").trim();
  if (description.length < 10) {
    return { ok: false, error: "Description must be at least 10 characters" };
  }

  const severity: AdminBrandingSeverity = input.severity ?? "warning";
  if (!VALID_SEVERITIES.includes(severity)) {
    return {
      ok: false,
      error: `severity must be one of: ${VALID_SEVERITIES.join(", ")}`,
    };
  }

  const handbook_page =
    input.handbook_page == null || Number.isNaN(Number(input.handbook_page))
      ? null
      : Math.round(Number(input.handbook_page));
  if (handbook_page !== null && handbook_page < 1) {
    return { ok: false, error: "handbook_page must be >= 1" };
  }

  return {
    ok: true,
    clean: {
      rule_key,
      category: input.category,
      title,
      description,
      handbook_page,
      requires_evidence: !!input.requires_evidence,
      severity,
      sort_order:
        typeof input.sort_order === "number" && Number.isFinite(input.sort_order)
          ? Math.round(input.sort_order)
          : 0,
      is_active: input.is_active !== false,
    },
  };
}

function mapRow(row: Record<string, unknown>): AdminBrandingRule {
  return {
    id: row.id as string,
    rule_key: row.rule_key as string,
    category: row.category as AdminBrandingCategory,
    title: row.title as string,
    description: row.description as string,
    handbook_page: (row.handbook_page as number | null) ?? null,
    requires_evidence: !!row.requires_evidence,
    severity: (row.severity as AdminBrandingSeverity) ?? "warning",
    sort_order: (row.sort_order as number | null) ?? 0,
    is_active: row.is_active !== false,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

// ─── List ───────────────────────────────────────────────────────

export async function adminListBrandingRules(
  includeInactive: boolean = true
): Promise<AdminBrandingRule[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("branding_rules")
    .select(
      "id, rule_key, category, title, description, handbook_page, requires_evidence, severity, sort_order, is_active, created_at, updated_at"
    )
    .order("sort_order", { ascending: true })
    .order("rule_key", { ascending: true });

  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

// ─── Create ─────────────────────────────────────────────────────

export async function adminCreateBrandingRule(
  input: BrandingRuleInput
): Promise<ActionResult<AdminBrandingRule>> {
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  // Uniqueness pre-check for a cleaner error message (the UNIQUE index
  // still guards against races).
  const { data: existing } = await supabase
    .from("branding_rules")
    .select("id")
    .eq("rule_key", clean.rule_key)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `A rule with key "${clean.rule_key}" already exists`,
    };
  }

  // Default sort_order to end-of-list + 10 if caller passed 0 (new rule).
  let sort_order = clean.sort_order;
  if (!sort_order) {
    const { data: maxRows } = await supabase
      .from("branding_rules")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const currentMax =
      Array.isArray(maxRows) && maxRows[0]
        ? (maxRows[0] as { sort_order: number | null }).sort_order ?? 0
        : 0;
    sort_order = currentMax + 10;
  }

  const { data, error } = await supabase
    .from("branding_rules")
    .insert({
      rule_key: clean.rule_key,
      category: clean.category,
      title: clean.title,
      description: clean.description,
      handbook_page: clean.handbook_page,
      requires_evidence: clean.requires_evidence,
      severity: clean.severity,
      sort_order,
      is_active: clean.is_active,
    })
    .select(
      "id, rule_key, category, title, description, handbook_page, requires_evidence, severity, sort_order, is_active, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create branding rule",
    };
  }

  revalidatePath(BRANDING_RULES_PATH);
  return { success: true, data: mapRow(data as Record<string, unknown>) };
}

// ─── Update ─────────────────────────────────────────────────────

export async function adminUpdateBrandingRule(
  id: string,
  input: BrandingRuleInput
): Promise<ActionResult<AdminBrandingRule>> {
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  // Uniqueness pre-check: another row with the same rule_key but different id.
  const { data: collision } = await supabase
    .from("branding_rules")
    .select("id")
    .eq("rule_key", clean.rule_key)
    .neq("id", id)
    .maybeSingle();

  if (collision) {
    return {
      success: false,
      error: `Another rule with key "${clean.rule_key}" already exists`,
    };
  }

  const { data, error } = await supabase
    .from("branding_rules")
    .update({
      rule_key: clean.rule_key,
      category: clean.category,
      title: clean.title,
      description: clean.description,
      handbook_page: clean.handbook_page,
      requires_evidence: clean.requires_evidence,
      severity: clean.severity,
      sort_order: clean.sort_order,
      is_active: clean.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id, rule_key, category, title, description, handbook_page, requires_evidence, severity, sort_order, is_active, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update branding rule",
    };
  }

  revalidatePath(BRANDING_RULES_PATH);
  return { success: true, data: mapRow(data as Record<string, unknown>) };
}

// ─── Deactivate (soft delete) ───────────────────────────────────

export async function adminDeactivateBrandingRule(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("branding_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(BRANDING_RULES_PATH);
  return { success: true, data: null };
}

// ─── Reactivate ─────────────────────────────────────────────────

export async function adminReactivateBrandingRule(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("branding_rules")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(BRANDING_RULES_PATH);
  return { success: true, data: null };
}

// ─── Reorder ────────────────────────────────────────────────────
// sort_order is not UNIQUE so a single-phase update suffices.

export async function adminReorderBrandingRules(
  orderedIds: string[]
): Promise<ActionResult<{ reordered: number }>> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: true, data: { reordered: 0 } };
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("branding_rules")
      .update({ sort_order: (i + 1) * 10, updated_at: now })
      .eq("id", orderedIds[i]);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(BRANDING_RULES_PATH);
  return { success: true, data: { reordered: orderedIds.length } };
}
