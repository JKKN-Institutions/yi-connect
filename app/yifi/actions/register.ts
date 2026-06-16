"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/yifi/supabase/server";

// ── Result shapes ───────────────────────────────────────────────────────────
// Member-gated, paid registration is a TWO-STEP flow:
//   1. resolveMember(email, phone) — RESOLVE the person against yi_directory.people.
//      If not found -> { ok:true, found:false } so the UI shows an EXPLICIT rejection
//      screen ("you're not in the Yi member directory"). We NEVER create an identity
//      and NEVER silently redirect.
//   2. registerMember(...) — record the submitted (offline-paid) registration, set the
//      same yifi_session cookie the access-code door uses, and return the access code.

export type ResolvedMember = {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  chapter_id: string | null;
};

export type Fee = {
  amount: number | null;
  tier: string | null;
  currency: string | null;
  early_bird_until: string | null;
  payment_instructions: string | null;
};

type ResolveResult =
  | { ok: true; found: true; member: ResolvedMember; editionId: string; fee: Fee }
  | { ok: true; found: false }
  | { ok: false; error: string };

type RegisterResult =
  | { ok: true; accessCode: string }
  | { ok: false; error: string };

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function currentEditionId(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string | null> {
  const { data } = await svc.rpc("yifi_current_edition");
  return data?.id ?? null;
}

/**
 * Step 1 — RESOLVE-OR-REJECT.
 *
 * Calls public.yifi_resolve_member, which returns the person from
 * yi_directory.people (with a best-effort chapter_id) or NULL. On NULL we return
 * `found: false` — the register door then renders an explicit rejection screen.
 * On a match we also fetch the current edition + the current fee (public.yifi_current_fee)
 * so the UI can show the amount + payment instructions in the same round-trip.
 */
export async function resolveMember(
  email: string,
  phone: string
): Promise<ResolveResult> {
  const cleanEmail = (email || "").trim();
  const cleanPhone = (phone || "").trim();

  if (!cleanEmail && !cleanPhone) {
    return { ok: false, error: "Enter your email or phone to continue" };
  }

  const svc = await createServiceClient();

  const editionId = await currentEditionId(svc);
  if (!editionId) {
    return { ok: false, error: "Registration is not open yet" };
  }

  const { data, error } = await svc.rpc("yifi_resolve_member", {
    p_email: cleanEmail || null,
    p_phone: cleanPhone || null,
  });

  if (error) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  // NULL == not a Yi member. Explicit rejection (no identity created, no redirect).
  if (!data) {
    return { ok: true, found: false };
  }

  const member = data as ResolvedMember;

  const { data: feeData } = await svc.rpc("yifi_current_fee", {
    p_edition_id: editionId,
  });
  const fee: Fee = (feeData as Fee) ?? {
    amount: null,
    tier: null,
    currency: null,
    early_bird_until: null,
    payment_instructions: null,
  };

  return { ok: true, found: true, member, editionId, fee };
}

/**
 * Step 2 — register a resolved member with a submitted (offline) payment.
 *
 * Calls public.yifi_register_member, which upserts the registrant, sets
 * payment_status='submitted' (pending organiser verification), and mints an access
 * code. On success we set the SAME yifi_session cookie the access-code path uses so
 * the member lands authenticated on /yifi/me, and return the access code to show.
 */
export async function registerMember(formData: FormData): Promise<RegisterResult> {
  const editionId = str(formData.get("edition_id"));
  const personId = str(formData.get("person_id"));
  const fullName = str(formData.get("full_name"));
  const email = str(formData.get("email"));
  const phone = str(formData.get("phone"));
  const paymentReference = str(formData.get("payment_reference"));
  const amountRaw = str(formData.get("amount_due"));
  const amountDue = amountRaw ? Number(amountRaw) : null;

  if (!editionId || !personId) {
    return { ok: false, error: "Your session expired. Please look yourself up again." };
  }
  if (!fullName) {
    return { ok: false, error: "Please enter your name" };
  }
  if (!paymentReference) {
    return {
      ok: false,
      error: "Enter the UPI / transaction reference for your payment to continue",
    };
  }

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_register_member", {
    p_edition_id: editionId,
    p_person_id: personId,
    p_full_name: fullName,
    p_email: email || null,
    p_phone: phone || null,
    p_payment_reference: paymentReference,
    p_amount_due: amountDue,
  });

  if (error || !data) {
    return { ok: false, error: "Could not save your registration. Please try again." };
  }

  const result = data as {
    error?: string;
    registrant_id?: string;
    access_code?: string;
  };

  if (result.error) return { ok: false, error: result.error };
  if (!result.registrant_id || !result.access_code) {
    return { ok: false, error: "Could not save your registration. Please try again." };
  }

  // Auto-login with a session scoped to the row we just upserted (same cookie shape
  // as the access-code door — see app/yifi/actions/auth.ts).
  const cookieStore = await cookies();
  cookieStore.set(
    "yifi_session",
    JSON.stringify({
      type: "member",
      id: result.registrant_id,
      name: fullName,
      editionId,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    }
  );

  return { ok: true, accessCode: result.access_code };
}
