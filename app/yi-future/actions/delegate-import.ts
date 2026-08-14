"use server";

// ═══════════════════════════════════════════════════════════════════════
// Bulk delegate import for a chapter, one chunk per call.
//
// Deliberately NOT a loop over createDelegate: that action redirect()s on
// success (which throws NEXT_REDIRECT) and revalidatePath()s twice per row.
// This mirrors what createDelegate WRITES, without its control flow.
//
// Safety rules this encodes, each one earned:
//   • Never creates a college. The 2026-08-07 script created ~65,000 junk
//     colleges by auto-creating one per registration, and deleteCollege
//     refuses once a delegate points at it — so the mess is near-permanent.
//     Unmatched college names leave college_id NULL and are reported.
//   • Skips duplicates rather than failing. Re-uploading the same file is
//     something people always do; it must be harmless.
//   • Sends no email. Every sendEmail writes a notification_log row BEFORE
//     attempting Resend, and a drain cron retries pending rows — with Resend
//     currently failing ~98% of sends, queueing mail here would create
//     thousands of permanently-retrying rows.
//   • registered_at stays NULL, matching admin-created rows, so imports do
//     not register as public sign-ups in the abuse counters.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { normalizePhone } from "@/lib/yi-future/spreadsheet";
import {
  IMPORT_CHUNK_SIZE,
  type ImportChunkResult,
  type ImportDelegateRow,
  type ImportedDelegate,
} from "@/lib/yi-future/delegate-import";
import { safeError } from "@/lib/yi-future/db-error";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Allocate `count` access codes that collide with nothing already stored.
 *
 * The per-row helper in delegates.ts costs one round-trip per code and THROWS
 * when it runs out of attempts — fatal in the middle of a batch. This does one
 * bulk existence check instead and degrades gracefully.
 *
 * Collisions are checked GLOBALLY, not per edition: login resolves an access
 * code with .maybeSingle() and no edition filter, so a code duplicated across
 * editions would break sign-in for both delegates.
 */
async function allocateAccessCodes(svc: Svc, count: number): Promise<string[]> {
  const codes = new Set<string>();
  for (let attempt = 0; attempt < 6 && codes.size < count; attempt++) {
    while (codes.size < count) codes.add(generateAccessCode());

    const candidates = [...codes];
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("access_code")
      .in("access_code", candidates);

    const taken = new Set(
      ((data as { access_code: string | null }[] | null) ?? [])
        .map((r) => r.access_code)
        .filter((c): c is string => !!c)
    );
    if (taken.size === 0) break;
    for (const c of taken) codes.delete(c);
  }
  return [...codes].slice(0, count);
}

export async function importDelegatesChunk(input: {
  chapterId: string;
  editionId: string;
  rows: ImportDelegateRow[];
}): Promise<ImportChunkResult> {
  const { chapterId, editionId } = input;

  // ─── 1. Authorization ─────────────────────────────────────────────────
  // resolveFutureAccessOrNull rather than requireChapterAdmin: the latter
  // redirect()s, which throws mid-batch instead of returning an error the
  // dialog can show.
  const access = await resolveFutureAccessOrNull();
  if (!access) {
    return { ok: false, error: "Please sign in again — your session expired." };
  }
  if (!chapterId || !editionId) {
    return { ok: false, error: "Missing chapter or edition." };
  }
  // Fail closed: a chapter the caller does not administer is denied outright.
  if (!access.isNational && !access.chapterIds.includes(chapterId)) {
    return {
      ok: false,
      error: "You can only import delegates into your own chapter.",
    };
  }

  const rows = input.rows ?? [];
  if (rows.length === 0) return { ok: false, error: "Nothing to import." };
  if (rows.length > IMPORT_CHUNK_SIZE) {
    return { ok: false, error: `Too many rows in one batch (max ${IMPORT_CHUNK_SIZE}).` };
  }

  const svc = await createServiceClient();

  // ─── 2. Normalise ─────────────────────────────────────────────────────
  // createDelegate does neither of these today, which is why an admin-entered
  // "A@B.com" can currently sit alongside a public "a@b.com".
  const cleaned = rows.map((r) => ({
    full_name: (r.full_name ?? "").trim(),
    email: (r.email ?? "").trim().toLowerCase() || null,
    phone: normalizePhone(r.phone) || null,
    college: (r.college ?? "").trim(),
    course: (r.course ?? "").trim() || null,
    year_of_study: Number.isFinite(r.year_of_study) ? r.year_of_study! : null,
    age: Number.isFinite(r.age) ? r.age! : null,
    home_state: (r.home_state ?? "").trim() || null,
  }));

  // ─── 3. Duplicate detection ───────────────────────────────────────────
  // One lookup for the whole chunk. onConflict cannot be used here: PostgREST
  // needs a real UNIQUE constraint to target and uq_delegates_edition_email is
  // a partial EXPRESSION index, which it cannot name.
  const emails = cleaned.map((r) => r.email).filter((e): e is string => !!e);
  const phones = cleaned.map((r) => r.phone).filter((p): p is string => !!p);

  const takenEmails = new Set<string>();
  const takenPhones = new Set<string>();

  if (emails.length > 0) {
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("email")
      .eq("edition_id", editionId)
      .in("email", emails);
    for (const r of ((data as { email: string | null }[] | null) ?? [])) {
      if (r.email) takenEmails.add(r.email.trim().toLowerCase());
    }
  }
  if (phones.length > 0) {
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("phone")
      .eq("edition_id", editionId)
      .in("phone", phones);
    for (const r of ((data as { phone: string | null }[] | null) ?? [])) {
      if (r.phone) takenPhones.add(r.phone);
    }
  }

  // ─── 4. College resolution — match only, never create ─────────────────
  const collegeNames = [
    ...new Set(cleaned.map((r) => r.college).filter(Boolean).map((c) => c.toLowerCase())),
  ];
  const collegeByName = new Map<string, string>();
  if (collegeNames.length > 0) {
    const { data } = await svc
      .schema("future")
      .from("colleges")
      .select("id, name")
      .eq("chapter_id", chapterId);
    for (const c of ((data as { id: string; name: string }[] | null) ?? [])) {
      collegeByName.set(c.name.trim().toLowerCase(), c.id);
    }
  }

  // ─── 5. Decide which rows actually go in ──────────────────────────────
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const toInsert: typeof cleaned = [];
  let skipped = 0;
  const errors: string[] = [];

  for (const r of cleaned) {
    if (!r.full_name) {
      errors.push("A row had no name and was skipped.");
      continue;
    }
    // Already in this edition?
    if (r.email && takenEmails.has(r.email)) {
      skipped++;
      continue;
    }
    if (r.phone && takenPhones.has(r.phone)) {
      skipped++;
      continue;
    }
    // Repeated within this same file?
    if (r.email && seenEmail.has(r.email)) {
      skipped++;
      continue;
    }
    if (r.phone && seenPhone.has(r.phone)) {
      skipped++;
      continue;
    }
    if (r.email) seenEmail.add(r.email);
    if (r.phone) seenPhone.add(r.phone);
    toInsert.push(r);
  }

  if (toInsert.length === 0) {
    return { ok: true, added: 0, skipped, collegeNotMatched: [], errors, created: [] };
  }

  // ─── 6. Insert ────────────────────────────────────────────────────────
  const codes = await allocateAccessCodes(svc, toInsert.length);
  if (codes.length < toInsert.length) {
    return {
      ok: false,
      error: "Could not allocate enough unique access codes. Please try again.",
    };
  }

  const created: ImportedDelegate[] = [];
  const collegeNotMatched: string[] = [];
  let added = 0;

  for (let i = 0; i < toInsert.length; i++) {
    const r = toInsert[i];
    const collegeId = r.college
      ? (collegeByName.get(r.college.toLowerCase()) ?? null)
      : null;
    if (r.college && !collegeId && !collegeNotMatched.includes(r.college)) {
      collegeNotMatched.push(r.college);
    }

    // Per row, not one bulk insert: a single duplicate must cost that row, not
    // the whole chunk. uq_delegates_edition_email is the backstop behind the
    // pre-check above (another admin may have added the same person between
    // the lookup and now).
    const { error } = await svc
      .schema("future")
      .from("delegates")
      .insert({
        chapter_id: chapterId,
        edition_id: editionId,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        age: r.age,
        course: r.course,
        year_of_study: r.year_of_study,
        college_id: collegeId,
        home_state: r.home_state,
        access_code: codes[i],
        is_active: true,
      } as never)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        skipped++;
      } else {
        errors.push(
          `${r.full_name}: ${safeError(error.message, "delegate-import.importDelegatesChunk")}`
        );
      }
      continue;
    }

    added++;
    created.push({
      full_name: r.full_name,
      email: r.email ?? "",
      phone: r.phone ?? "",
      college: r.college,
      access_code: codes[i],
    });

    // ─── 7. Auth user + directory, exactly as createDelegate does ───────
    // Keeps an imported delegate indistinguishable from a manually added one.
    // Errors are swallowed per row there too — a failure here must not undo a
    // delegate who is already saved.
    if (r.email) {
      try {
        const { data: authData } = await svc.auth.admin.createUser({
          email: r.email,
          email_confirm: true,
          user_metadata: { full_name: r.full_name, role: "delegate" },
        });
        // Same loose schema cast delegates.ts uses — yi_directory is not in
        // the Yi-Future generated types.
        await svc
          .schema("yi_directory" as "public")
          .from("people")
          .upsert(
            {
              user_id: authData?.user?.id ?? null,
              full_name: r.full_name,
              email: r.email,
              phone: r.phone,
              is_active: true,
            } as never,
            { onConflict: "email" }
          );
      } catch {
        // Already-registered email, Auth rate limit, transient network — the
        // delegate row is saved and can sign in with their access code.
      }
    }
  }

  revalidatePath("/yi-future/chapter/delegates");

  return { ok: true, added, skipped, collegeNotMatched, errors, created };
}
