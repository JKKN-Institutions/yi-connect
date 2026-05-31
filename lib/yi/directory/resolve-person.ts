// FOUNDATION — fields are a starting point; domain review needed before production use.
//
// The ONE shared find-or-create primitive (yi-directory consolidation plan,
// 2026-05-31, §4 "The one shared primitive"). Every app's "add a delegate /
// student / member" flow calls resolvePerson() to get a yi_directory.people id,
// then writes its OWN relationship row (e.g. yip.participations). Identity is
// deduped AT THE SOURCE so the same human is never copied per-app.
//
// chapter-roles.ts (ensurePerson) is the reference implementation this extracts
// from — same service-client + .schema("yi_directory") casting approach. The
// difference: that path also provisions an auth login (role-HOLDERS sign in);
// this primitive does NOT, because subjects (delegates, students, minors) may
// have no login at all. linkPersonToUser() wires a login later if/when needed.

import { createServiceClient } from "@/lib/yip/supabase/server";

const norm = (s: string) => s.trim().toLowerCase();

// Normalize a phone to its last 10 digits (drops +91 / leading 0 / spaces /
// dashes) so "+91 97910 05881", "097910-05881" and "9791005881" all match.
// Stored normalized so future matches are consistent. Returns null if too short
// to be a usable dedupe key. NOTE: tuned for India (10-digit mobiles); revisit
// for international numbers when a delegate UI needs them.
function normPhone(s: string): string | null {
  const d = s.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// yi_directory is not in the generated YIP Database types, so we cast the
// schema accessor the same way the rest of the codebase does for un-typed
// schemas. Shape the rows we touch ourselves.
type PeopleRow = { id: string };

function directoryPeople(svc: Svc) {
  return (
    svc.schema("yi_directory" as never) as unknown as {
      from: (table: "people") => {
        select: (cols: string) => {
          ilike: (
            col: string,
            val: string
          ) => { maybeSingle: () => Promise<{ data: PeopleRow | null }> };
          eq: (
            col: string,
            val: string
          ) => { maybeSingle: () => Promise<{ data: PeopleRow | null }> };
        };
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: PeopleRow | null;
              error: { message: string } | null;
            }>;
          };
        };
        update: (row: Record<string, unknown>) => {
          eq: (
            col: string,
            val: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  ).from("people");
}

/**
 * Find-or-create a yi_directory.people identity for a person.
 *
 * 1. If `email` given, match an existing row by lower(email).
 * 2. Else if `phone` given, match by phone.
 * 3. If found, return its id (dedupe at the source — no new identity).
 * 4. Else INSERT a new people row and return the new id.
 *
 * Returns the yi_directory.people id. Throws on insert failure so callers
 * surface a real error rather than silently writing an orphaned relationship.
 */
export async function resolvePerson(input: {
  full_name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string> {
  const fullName = input.full_name.trim();
  const email = input.email ? norm(input.email) : null;
  const phone = input.phone ? normPhone(input.phone) : null;

  const svc = await createServiceClient();

  // 1. Match by email (strongest dedupe key).
  if (email) {
    const { data } = await directoryPeople(svc)
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (data) return data.id;
  }

  // 2. Fallback to phone — decision 2026-05-31: identity = email OR phone, so we
  //    try phone even when an email was given but did not match.
  if (phone) {
    const { data } = await directoryPeople(svc)
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data) return data.id;
  }

  // 3. No identifying match — create one identity row (subjects carry no
  //    user_id / no login). Decision 2026-05-31: if NEITHER email nor phone was
  //    provided we cannot safely dedupe, so flag the row for human review rather
  //    than risk silent duplicates (the failure mode that caused the 6-RM mess).
  const needsReview = !email && !phone;
  const { data: created, error } = await directoryPeople(svc)
    .insert({
      full_name: fullName,
      email,
      phone,
      is_active: true,
      needs_identity_review: needsReview,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(
      `resolvePerson: failed to create directory person: ${error?.message ?? "unknown"}`
    );
  }
  return created.id;
}

/**
 * Link an existing identity to an auth user (e.g. a delegate later becomes
 * staff and gets a login). Idempotent set of people.user_id; does not create
 * the auth user — that stays with the role-grant flow (chapter-roles.ts).
 */
export async function linkPersonToUser(
  personId: string,
  userId: string
): Promise<void> {
  const svc = await createServiceClient();
  const { error } = await directoryPeople(svc)
    .update({ user_id: userId })
    .eq("id", personId);
  if (error) {
    throw new Error(`linkPersonToUser: failed to link person: ${error.message}`);
  }
}
