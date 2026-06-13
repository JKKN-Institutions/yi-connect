"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "./auth";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import type { ActionResult } from "./editions";
import type { Database } from "@/types/yi-future/database";
import { sendPushToSubject } from "@/app/yi-future/actions/push";

type ConsentStatus = Database["future"]["Enums"]["consent_status"];

/**
 * Resolve the host chapter for a consent letter: consent_letters → delegate →
 * chapter_id. Used to scope approve/reject to the delegate's chapter admin.
 */
async function chapterIdForConsentLetter(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  letterId: string
): Promise<string | null> {
  const { data } = await svc
    .schema("future")
    .from("consent_letters")
    .select("delegate_id, delegates(chapter_id)")
    .eq("id", letterId)
    .maybeSingle();
  const row = data as unknown as {
    delegate_id: string | null;
    delegates: { chapter_id: string | null } | null;
  } | null;
  return row?.delegates?.chapter_id ?? null;
}

async function requireDelegate(): Promise<string | null> {
  const session = await readSession();
  if (!session || session.type !== "delegate") return null;
  return session.id;
}

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── DELEGATE: UPLOAD / UPDATE CONSENT ──────────────────────────────
export async function submitConsent(
  formData: FormData
): Promise<ActionResult> {
  const delegateId = await requireDelegate();
  if (!delegateId) return { ok: false, error: "Not signed in as delegate." };

  const parent_name = String(formData.get("parent_name") ?? "").trim() || null;
  const parent_email =
    String(formData.get("parent_email") ?? "").trim() || null;
  const parent_phone =
    String(formData.get("parent_phone") ?? "").trim() || null;
  const parent_address =
    String(formData.get("parent_address") ?? "").trim() || null;
  const emergency_contact_name =
    String(formData.get("emergency_contact_name") ?? "").trim() || null;
  const emergency_contact_phone =
    String(formData.get("emergency_contact_phone") ?? "").trim() || null;
  const travel_consent = formData.get("travel_consent") === "on";
  const medical_consent = formData.get("medical_consent") === "on";
  const liability_consent = formData.get("liability_consent") === "on";
  const signed_pdf_url =
    String(formData.get("signed_pdf_url") ?? "").trim() || null;

  if (signed_pdf_url && !isValidUrl(signed_pdf_url)) {
    return { ok: false, error: "Please enter a valid https URL." };
  }
  if (!parent_name || !parent_phone) {
    return { ok: false, error: "Parent name and phone are required." };
  }
  if (!travel_consent || !medical_consent || !liability_consent) {
    return {
      ok: false,
      error:
        "All three consents (travel, medical, liability) are required.",
    };
  }

  const svc = await createServiceClient();

  // Upsert on delegate_id (PK constraint isOneToOne: true in schema)
  const { data: existing } = await svc
    .schema("future")
    .from("consent_letters")
    .select("id, status")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  const ex = existing as { id: string; status: string | null } | null;

  const payload = {
    delegate_id: delegateId,
    parent_name,
    parent_email,
    parent_phone,
    parent_address,
    emergency_contact_name,
    emergency_contact_phone,
    travel_consent,
    medical_consent,
    liability_consent,
    signed_pdf_url,
    status: (signed_pdf_url ? "uploaded" : "pending") as ConsentStatus,
    uploaded_at: signed_pdf_url ? new Date().toISOString() : null,
    template_version: 1,
    updated_at: new Date().toISOString(),
  };

  if (ex) {
    if (ex.status === "approved") {
      return {
        ok: false,
        error:
          "Already approved. Ask your chapter admin to unlock if a change is needed.",
      };
    }
    const { error } = await svc
      .schema("future")
      .from("consent_letters")
      .update(payload)
      .eq("id", ex.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await svc
      .schema("future")
      .from("consent_letters")
      .insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/yi-future/me/consent");
  revalidatePath("/yi-future/chapter/consent");
  return { ok: true, message: "Consent saved." };
}

// ─── ADMIN: APPROVE / REJECT ────────────────────────────────────────
export async function approveConsent(
  id: string
): Promise<ActionResult> {
  const svc = await createServiceClient();
  // SECURITY: chapter-scoped — only the admin of the delegate's chapter (or a
  // national admin) may approve. Was login-only, letting any delegate approve
  // any consent letter. Resolve the letter's chapter, then gate on it.
  const chapterId = await chapterIdForConsentLetter(svc, id);
  const { userId } = await requireChapterAdmin(chapterId);
  const { error } = await svc
    .schema("future")
    .from("consent_letters")
    .update({
      status: "approved" as ConsentStatus,
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/consent");

  // Fire-and-forget push to the delegate
  try {
    const { data: letter } = await (svc as any)
      .schema("future")
      .from("consent_letters")
      .select("delegate_id")
      .eq("id", id)
      .maybeSingle();
    const delegateId = (letter as { delegate_id: string | null } | null)
      ?.delegate_id;
    if (delegateId) {
      await sendPushToSubject("delegate", delegateId, {
        title: "Consent approved ✓",
        body: "Your parent consent letter has been approved. You're cleared to travel.",
        url: "/me/consent",
      });
    }
  } catch (err) {
    console.error("[push] approveConsent notify delegate failed:", err);
  }

  return { ok: true, message: "Approved." };
}

export async function rejectConsent(
  id: string,
  reason: string | null
): Promise<ActionResult> {
  const svc = await createServiceClient();
  // SECURITY: chapter-scoped — same gate as approveConsent.
  const chapterId = await chapterIdForConsentLetter(svc, id);
  await requireChapterAdmin(chapterId);
  const { error } = await svc
    .schema("future")
    .from("consent_letters")
    .update({
      status: "rejected" as ConsentStatus,
      rejection_reason: reason,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/consent");

  // Fire-and-forget push to the delegate
  try {
    const { data: letter } = await (svc as any)
      .schema("future")
      .from("consent_letters")
      .select("delegate_id")
      .eq("id", id)
      .maybeSingle();
    const delegateId = (letter as { delegate_id: string | null } | null)
      ?.delegate_id;
    if (delegateId) {
      await sendPushToSubject("delegate", delegateId, {
        title: "Consent needs revision",
        body: "Your chapter admin rejected your consent. Check the reason and resubmit.",
        url: "/me/consent",
      });
    }
  } catch (err) {
    console.error("[push] rejectConsent notify delegate failed:", err);
  }

  return { ok: true, message: "Rejected." };
}
