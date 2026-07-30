"use server";

// National-admin control for the registration open/close window.
// WRITE is platform-tier gated (same strict tier as editions/tracks config);
// the page itself stays viewable by the broad admin tier.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requirePlatformAdmin } from "./national-admins";

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
  if (updErr) return { ok: false, error: updErr.message };

  // Replace the exception list wholesale — it is tiny (≤65 chapters) and a
  // full swap keeps the saved state exactly what the admin sees on screen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySvc = svc as any;
  const { error: delErr } = await anySvc
    .schema("future")
    .from("registration_open_chapters")
    .delete()
    .eq("edition_id", editionId);
  if (delErr) return { ok: false, error: delErr.message };

  const uniqueIds = Array.from(new Set(openChapterIds.filter(Boolean)));
  if (closed && uniqueIds.length > 0) {
    const { error: insErr } = await anySvc
      .schema("future")
      .from("registration_open_chapters")
      .insert(uniqueIds.map((chapter_id) => ({ edition_id: editionId, chapter_id })));
    if (insErr) return { ok: false, error: insErr.message };
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
// team can invite them next time. Response is always the same neutral
// confirmation, and a repeat email is silently accepted (unique index per
// edition), so this never reveals who is already on the list.
export async function joinRegistrationWaitlist(
  email: string
): Promise<{ ok: true; message: string }> {
  const NEUTRAL = "Thanks — we've noted your email.";
  const clean = email?.trim().toLowerCase() ?? "";

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && clean.length <= 255) {
    try {
      const svc = await createServiceClient();
      const { data: edition } = await svc
        .schema("future")
        .from("editions")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();
      if (edition) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc as any)
          .schema("future")
          .from("registration_waitlist")
          .upsert(
            { edition_id: (edition as { id: string }).id, email: clean },
            { onConflict: "edition_id,email", ignoreDuplicates: true }
          );
      }
    } catch (e) {
      console.warn(
        "[waitlist] insert failed:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  return { ok: true, message: NEUTRAL };
}
