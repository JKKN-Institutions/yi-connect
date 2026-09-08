"use server";

// National-admin control for the registration open/close window.
// WRITE is platform-tier gated (same strict tier as editions/tracks config);
// the page itself stays viewable by the broad admin tier.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { checkWaitlistAbuse } from "@/lib/yi-future/waitlist-guard";
import { requirePlatformAdmin } from "./national-admins";
import { safeError } from "@/lib/yi-future/db-error";

export type SaveWindowResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function saveRegistrationWindow(
  editionId: string,
  closed: boolean,
  openChapterIds: string[]
): Promise<SaveWindowResult> {
  await requirePlatformAdmin();

  if (!editionId) return { ok: false, error: "Missing edition." };

  const svc = await createServiceClient();

  const { error: updErr } = await svc
    .schema("future")
    .from("editions")
    .update({ registration_closed: closed } as never)
    .eq("id", editionId);
  if (updErr) return { ok: false, error: safeError(updErr.message, "registration-window.saveRegistrationWindow") };

  // Replace the exception list wholesale — it is tiny (≤65 chapters) and a
  // full swap keeps the saved state exactly what the admin sees on screen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySvc = svc as any;
  const { error: delErr } = await anySvc
    .schema("future")
    .from("registration_open_chapters")
    .delete()
    .eq("edition_id", editionId);
  if (delErr) return { ok: false, error: safeError(delErr.message, "registration-window.saveRegistrationWindow") };

  const uniqueIds = Array.from(new Set(openChapterIds.filter(Boolean)));
  if (closed && uniqueIds.length > 0) {
    const { error: insErr } = await anySvc
      .schema("future")
      .from("registration_open_chapters")
      .insert(uniqueIds.map((chapter_id) => ({ edition_id: editionId, chapter_id })));
    if (insErr) return { ok: false, error: safeError(insErr.message, "registration-window.saveRegistrationWindow") };
  }

  revalidatePath("/yi-future/join");
  revalidatePath("/yi-future/national/admin/registration");

  if (!closed) {
    return { ok: true, message: "Registrations are OPEN for all chapters." };
  }
  return {
    ok: true,
    message:
      uniqueIds.length === 0
        ? "Registrations are CLOSED for every chapter."
        : `Registrations are CLOSED except for ${uniqueIds.length} chapter${uniqueIds.length === 1 ? "" : "s"}.`,
  };
}

// ─── WAITLIST (public — shown when registrations are fully closed) ──
// Unauthenticated by nature: a late student leaves an email so the national
// team can invite them next time. A successful response is always the same
// neutral confirmation, and a repeat email is silently accepted (unique index
// per edition), so this never reveals who is already on the list.
//
// GUARDED since 2026-08-10. This action shipped with no rate limit, no bot
// challenge and no origin check, and on 2026-08-07 a script used it to insert
// 2,358,427 faker.js addresses in 2h14m — 99.99% of the table. checkWaitlistAbuse()
// is now mandatory here; see lib/yi-future/waitlist-guard.ts for the sizing.
//
// When registration reopens, ~120 genuine students on this list are still
// waiting to be told — they were promised exactly that. Export them from
// /api/csv/waitlist and email them before announcing publicly.
export async function joinRegistrationWaitlist(
  email: string,
  turnstileToken?: string | null
): Promise<{ ok: boolean; message: string }> {
  const NEUTRAL = "Thanks — we've noted your email.";
  const clean = email?.trim().toLowerCase() ?? "";

  // A malformed address gets the neutral reply without a write: telling the
  // caller it was rejected would leak that a well-formed one was accepted.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 255) {
    return { ok: true, message: NEUTRAL };
  }

  try {
    const svc = await createServiceClient();
    const { data: edition } = await svc
      .schema("future")
      .from("editions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (!edition) return { ok: true, message: NEUTRAL };

    const editionId = (edition as { id: string }).id;

    const guard = await checkWaitlistAbuse(svc, editionId, turnstileToken ?? null);
    if (!guard.ok) return { ok: false, message: guard.error };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .schema("future")
      .from("registration_waitlist")
      .upsert(
        { edition_id: editionId, email: clean, ip: guard.ip },
        { onConflict: "edition_id,email", ignoreDuplicates: true }
      );
  } catch (e) {
    console.warn(
      "[waitlist] insert failed:",
      e instanceof Error ? e.message : String(e)
    );
  }

  return { ok: true, message: NEUTRAL };
}
