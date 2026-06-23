"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";

// Admin configuration for the 15 workbook awards (yip.award_definitions). The
// award MATH lives in the results engine's registry keyed by award_key; this
// surface owns the operational knobs — label, how many recipients, on/off. The
// engine reads these on every Compute Results, so changes here are wired live.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AwardDefinition = {
  award_key: string;
  label: string;
  basis_description: string;
  default_recipients: number;
  is_team: boolean;
  is_active: boolean;
  display_order: number;
};

const COLS =
  "award_key, label, basis_description, default_recipients, is_team, is_active, display_order";

export async function listAwardDefinitions(): Promise<AwardDefinition[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_definitions")
    .select(COLS)
    .order("display_order");
  if (error || !data) return [];
  return data as AwardDefinition[];
}

export type AwardDefinitionPatch = {
  label?: string;
  default_recipients?: number;
  is_active?: boolean;
};

export async function updateAwardDefinition(
  awardKey: string,
  patch: AwardDefinitionPatch
): Promise<ActionResult<AwardDefinition>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.label === "string") {
    const label = patch.label.trim();
    if (label.length < 2)
      return { success: false, error: "Award name must be at least 2 characters." };
    if (label.length > 80)
      return { success: false, error: "Award name is too long (max 80)." };
    update.label = label;
  }
  if (typeof patch.default_recipients === "number") {
    const n = Math.round(patch.default_recipients);
    if (n < 1 || n > 50)
      return {
        success: false,
        error: "Recipients must be between 1 and 50.",
      };
    update.default_recipients = n;
  }
  if (typeof patch.is_active === "boolean") update.is_active = patch.is_active;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_definitions")
    .update(update)
    .eq("award_key", awardKey)
    .select(COLS)
    .single();

  if (error || !data)
    return {
      success: false,
      error: error?.message ?? "Failed to update award.",
    };

  revalidatePath("/yip/dashboard/admin/awards");
  return { success: true, data: data as AwardDefinition };
}
