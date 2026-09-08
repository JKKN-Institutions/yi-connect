/**
 * Resolving the person behind a participant row.
 *
 * A `yip.participants` row is one student's appearance at ONE event; the person
 * lives in `yip.contestants`, and `participants.person_id` is the link that lets
 * their rounds add up into a career.
 *
 * ─── WHY THIS IS A LIB AND NOT A SERVER ACTION ─────────────────────────────
 * This used to live in `app/yip/actions/people.ts`. Every other export in that
 * file carries `requireSuperAdmin()`; this one carried no gate at all — and in a
 * `"use server"` file every exported async function is a callable HTTP endpoint.
 * While it had no callers that was inert. As the identity spine it is not:
 * anyone able to mint a contestant row could pre-create one matching a target
 * student's name and school, and the next import would link that student's
 * rounds, scores and awards onto an attacker-chosen record.
 *
 * Living here it is reachable only from server code that has already run its own
 * authorization (addParticipant / quickAddWalkIn / importParticipants each gate
 * on getYipEventAccess first), and is not an endpoint at all.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";

export type PersonInput = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  parent_phone?: string | null;
  class?: number | null;
  section?: string | null;
  school_id?: string | null;
  school_name?: string | null;
  home_state?: string | null;
  city?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  notes?: string | null;
};

export type FindOrCreateResult =
  | { success: true; data: { id: string; matched: boolean } }
  | { success: false; error: string };

export function normPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits;
}

export function sanitizePersonInput(input: PersonInput): PersonInput {
  return {
    full_name: input.full_name?.trim() ?? "",
    phone: normPhone(input.phone ?? null),
    email: input.email?.trim().toLowerCase() || null,
    parent_phone: normPhone(input.parent_phone ?? null),
    class: input.class ?? null,
    section: input.section?.trim() || null,
    school_id: input.school_id ?? null,
    school_name: input.school_name?.trim() || null,
    home_state: input.home_state?.trim() || null,
    city: input.city?.trim() || null,
    photo_url: input.photo_url?.trim() || null,
    bio: input.bio?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

/**
 * Escape a literal string for use as an ILIKE pattern.
 *
 * Without this, `_` and `%` inside a student's name or school are treated as
 * wildcards: "A_ha" would match "Asha" and "Aisha" alike, quietly folding two
 * children into one person.
 */
export function ciPattern(literal: string): string {
  return literal.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Idempotent upsert by email, else (school, normalized name).
 * Never creates a duplicate: if a match exists, returns that row's id.
 *
 * ─── DELIBERATELY NOT MATCHED ON PHONE ────────────────────────────────────
 * This used to try `phone` first. That is unsafe for schoolchildren: rosters
 * carry both `phone` and `parent_phone`, and siblings at one school share a
 * parent's number — so phone-first silently merges two different children into
 * a single career record, which is the one failure mode with real consequences
 * here. The youth-academy applicant path made the same call for the same reason
 * (see app/youth-academy/actions/applications.ts, resolveApplicantPerson).
 *
 * A missed match costs one duplicate row, which the people-linking review
 * screen can merge later. A wrong match puts one child's rounds, scores and
 * awards inside another child's record. Those are not symmetric, so this errs
 * toward creating a duplicate.
 */
export async function findOrCreatePerson(
  input: PersonInput
): Promise<FindOrCreateResult> {
  const clean = sanitizePersonInput(input);
  if (!clean.full_name || clean.full_name.length < 2) {
    return { success: false, error: "Name required" };
  }

  const supabase = await createServiceClient();

  // Each lookup takes the OLDEST active match rather than `.maybeSingle()`.
  // maybeSingle ERRORS on 2+ rows, and because that error was discarded the old
  // code fell straight through to "create fresh" — so an existing duplicate
  // caused a third one. Oldest-wins is also stable under concurrent imports.
  const namePattern = ciPattern(clean.full_name);

  // 1. Email — the only genuinely per-person identifier on a YIP roster.
  if (clean.email) {
    const { data } = await supabase
      .from("contestants")
      .select("id")
      .eq("is_active", true)
      .ilike("email", ciPattern(clean.email))
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]) return { success: true, data: { id: data[0].id, matched: true } };
  }

  // 2. school_id + name
  if (clean.school_id) {
    const { data } = await supabase
      .from("contestants")
      .select("id")
      .eq("is_active", true)
      .eq("school_id", clean.school_id)
      .ilike("full_name", namePattern)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]) return { success: true, data: { id: data[0].id, matched: true } };
  }

  // 3. school_name + name
  if (clean.school_name) {
    const { data } = await supabase
      .from("contestants")
      .select("id")
      .eq("is_active", true)
      .ilike("school_name", ciPattern(clean.school_name))
      .ilike("full_name", namePattern)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]) return { success: true, data: { id: data[0].id, matched: true } };
  }

  // Create fresh
  const { data, error } = await supabase
    .from("contestants")
    .insert(clean)
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: { id: data.id, matched: false } };
}
