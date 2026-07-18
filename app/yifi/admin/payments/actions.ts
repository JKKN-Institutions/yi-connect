"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext, hasPermission } from "../_guard";
import { createServiceClient } from "@/lib/yifi/supabase/server";

export type ActionResult = { success: true } | { success: false; error: string };
export type ManualAddResult =
  | { success: true; registrantId: string; accessCode: string }
  | { success: false; error: string };

/** Empty-string → null so the RPC stores NULL, not "" (silent-failure bug). */
function nullableText(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Empty-string / NaN numeric → null. */
function nullableNumber(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Save the edition's fee tiers + payment instructions shown to members. */
export async function setFees(formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return { success: false, error: "You don't have permission to manage payments." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_admin_set_fees", {
    p_edition_id: ctx.editionId,
    p_currency: nullableText(formData.get("currency")) ?? "INR",
    p_early_bird_amount: nullableNumber(formData.get("early_bird_amount")),
    p_early_bird_until: nullableText(formData.get("early_bird_until")),
    p_regular_amount: nullableNumber(formData.get("regular_amount")),
    p_payment_instructions: nullableText(formData.get("payment_instructions")),
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/yifi/admin/payments");
  return { success: true };
}

/** Mark a submitted payment as verified. */
export async function verifyPayment(registrantId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return { success: false, error: "You don't have permission to manage payments." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_admin_verify_payment", {
    p_registrant_id: registrantId,
    p_verified_by: ctx.email,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/yifi/admin/payments");
  return { success: true };
}

/** Waive a registrant's payment (no fee owed). */
export async function waivePayment(registrantId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return { success: false, error: "You don't have permission to manage payments." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_admin_waive_payment", {
    p_registrant_id: registrantId,
    p_verified_by: ctx.email,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/yifi/admin/payments");
  return { success: true };
}

/**
 * Escape hatch: add a real Yi member who is missing from the directory.
 * Returns the generated access code so the organiser can hand it to the member.
 */
export async function manualAddRegistrant(formData: FormData): Promise<ManualAddResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return { success: false, error: "You don't have permission to manage payments." };
  }

  const fullName = nullableText(formData.get("full_name"));
  if (!fullName) {
    return { success: false, error: "Full name is required." };
  }

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_admin_manual_add_registrant", {
    p_edition_id: ctx.editionId,
    p_full_name: fullName,
    p_email: nullableText(formData.get("email")),
    p_phone: nullableText(formData.get("phone")),
  });

  if (error) return { success: false, error: error.message };

  const result = (data ?? {}) as { registrant_id?: string; access_code?: string };
  if (!result.registrant_id || !result.access_code) {
    return { success: false, error: "Could not create the registrant. Please try again." };
  }

  revalidatePath("/yifi/admin/payments");
  return { success: true, registrantId: result.registrant_id, accessCode: result.access_code };
}
