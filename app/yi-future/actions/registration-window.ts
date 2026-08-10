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

// ─── WAITLIST — REMOVED 2026-08-10 ──────────────────────────────────
// joinRegistrationWaitlist() used to let any unauthenticated visitor write a
// row to future.registration_waitlist. It had no rate limiting, no CAPTCHA and
// no origin check, so on 2026-08-07 between 16:56 and 19:10 UTC a bot inserted
// 2,358,427 faker.js addresses at ~440 rows/second — 99.99% of the table.
//
// The whole write path is deleted rather than merely hidden: a Server Action
// stays a reachable POST endpoint even when no component renders it, so
// removing <WaitlistForm /> alone would NOT have stopped the flood.
//
// The 183 genuine emails collected before the flood are retained in
// future.registration_waitlist and still downloadable via /api/csv/waitlist.
// If a waitlist is ever reinstated it MUST ship with rate limiting on day one.
