"use server";

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import { notifyRegistrationConfirmed } from "@/lib/yi-future/email-triggers";
import {
  getRegistrationWindow,
  isChapterOpenForRegistration,
} from "@/lib/yi-future/registration-window";
import { checkRegistrationAbuse } from "@/lib/yi-future/registration-guard";
import { checkDelegateLookupAbuse } from "@/lib/yi-future/delegate-lookup-guard";

// ─── TYPES ──────────────────────────────────────────────────────────

export type RegisterDelegateInput = {
  // Section 1 — Details
  full_name: string;
  email: string;
  mobile: string;
  whatsapp: string;
  gender: "male" | "female";
  is_yi_yuva_member: boolean;
  chapter_id: string;
  // Section 2 — Academic
  college_name: string;
  college_city: string;
  course: string;
  specialization?: string;
  year_of_study: 1 | 2 | 3 | 4 | 5; // 5 = PG
  age: number;
  // Section 3 — Opportunities
  interest_internships: boolean;
  interest_jobs: boolean;
  interest_workshops: boolean;
  travel_commitment: boolean;
  // Section 4 — Declaration
  declaration_accepted: boolean;
  // Auth
  password: string;
  // Quiz pre-select (optional — set when user took quiz before registering)
  preferred_track_slug?: string;
  /** Cloudflare Turnstile token from the public form. Optional and
   *  back-compatible: only enforced once TURNSTILE_SECRET_KEY is set. */
  turnstile_token?: string | null;
};

export type RegisterDelegateResult =
  | { ok: true; redirect: string; access_code: string; returning: boolean }
  | { ok: false; error: string };

// ─── RETURNING DELEGATE LOOKUP ─────────────────────────────────────

export type PreviousProfile = {
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  gender: "male" | "female" | null;
  is_yi_yuva_member: boolean | null;
  chapter_id: string | null;
  chapter_name: string | null;
  college_name: string | null;
  college_city: string | null;
  course: string | null;
  specialization: string | null;
  year_of_study: number | null;
  age: number | null;
  edition_slug: string | null;
};

/** Outcome of a returning-delegate lookup.
 *
 *  `{ ok: true, profile: null }` means "checked, no previous registration" and
 *  `{ ok: false }` means "not checked at all". Collapsing those two into a bare
 *  `null` — which is what this action returned before the rate limit — would
 *  hide every refusal behind a normal-looking empty result, so a limited caller
 *  would be told nothing and a broken guard would look identical to a working
 *  one. They are kept distinct so the form can say which happened. */
export type LookupResult =
  | { ok: true; profile: PreviousProfile | null }
  | { ok: false; error: string };

/**
 * Pre-fill helper for a returning delegate on the PUBLIC join form.
 *
 * RATE LIMIT (added 2026-08-11): defence in depth on top of the fix below.
 * `checkDelegateLookupAbuse` applies a per-IP cap and a platform-wide burst
 * breaker before any delegate row is read, and fails CLOSED — no resolvable
 * caller IP, or a counter that cannot be read, means no lookup. The cost of a
 * false denial is one student typing details they could have had auto-filled.
 *
 * SECURITY (tightened 2026-08-10): this is an unauthenticated action that
 * returns a full personal profile — name, phone, WhatsApp, gender, college,
 * course, age. It previously matched on email OR phone, so anyone could type
 * a single email address and receive that student's phone number back. With
 * 16,708 delegates on file, all with phone numbers, that was a bulk personal-
 * data lookup open to the internet.
 *
 * Both identifiers are now required AND must belong to the SAME delegate row.
 * That makes enumeration useless: knowing only an email returns nothing, and
 * guessing the matching 10-digit mobile is a 10^10 search. Anyone who can
 * satisfy the check already holds both pieces of data it returns.
 *
 * This costs genuine users nothing — the form only calls this after section 1
 * validates, and section 1 requires both email and mobile.
 */
export async function lookupReturningDelegate(
  email: string,
  phone: string
): Promise<LookupResult> {
  const cleanEmail = email?.trim().toLowerCase() ?? "";
  const cleanPhone = normalizeMobile(phone ?? "");

  // Fail closed: a missing or malformed half means no lookup at all. Reported
  // as a successful check with no match, because that is what it is — the form
  // never reaches here without both fields validating client-side.
  if (!EMAIL_RE.test(cleanEmail) || !INDIA_MOBILE_RE.test(cleanPhone)) {
    return { ok: true, profile: null };
  }

  const svc = await createServiceClient();

  // Rate limit BEFORE the read, so a refused call costs two indexed counts
  // rather than a 4-way join across 16,712 delegates.
  const guard = await checkDelegateLookupAbuse(svc);
  if (!guard.ok) {
    return { ok: false, error: guard.error };
  }

  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "full_name, email, phone, whatsapp, gender, is_yi_yuva_member, chapter_id, chapters(name), course, specialization, year_of_study, age, college_id, colleges(name, city), editions(slug)"
    )
    .eq("email", cleanEmail)
    .eq("phone", cleanPhone)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: true, profile: null };
  const d = data as unknown as {
    full_name: string;
    email: string;
    phone: string | null;
    whatsapp: string | null;
    gender: string | null;
    is_yi_yuva_member: boolean | null;
    chapter_id: string | null;
    chapters: { name: string } | null;
    course: string | null;
    specialization: string | null;
    year_of_study: number | null;
    age: number | null;
    colleges: { name: string; city: string | null } | null;
    editions: { slug: string } | null;
  };

  return {
    ok: true,
    profile: {
      full_name: d.full_name,
      email: d.email,
      phone: d.phone,
      whatsapp: d.whatsapp,
      gender: (d.gender === "male" || d.gender === "female") ? d.gender : null,
      is_yi_yuva_member: d.is_yi_yuva_member,
      chapter_id: d.chapter_id,
      chapter_name: d.chapters?.name ?? null,
      college_name: d.colleges?.name ?? null,
      college_city: d.colleges?.city ?? null,
      course: d.course,
      specialization: d.specialization,
      year_of_study: d.year_of_study,
      age: d.age,
      edition_slug: d.editions?.slug ?? null,
    },
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

function normalizeMobile(raw: string): string {
  return raw.replace(/[^\d]/g, "").replace(/^91(?=\d{10}$)/, "");
}

// Resolve college: find an APPROVED match in this chapter (case-insensitive
// name + city), else insert a new row with is_approved=false so chapter
// admin can review/merge it from /chapter/colleges.
async function findOrCreatePendingCollege(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  chapterId: string,
  name: string,
  city: string
): Promise<string | null> {
  const cleanName = name.trim();
  const cleanCity = city.trim();
  if (!cleanName) return null;

  const { data: existing } = await svc
    .schema("future")
    .from("colleges")
    .select("id, is_approved")
    .eq("chapter_id", chapterId)
    .ilike("name", cleanName)
    .ilike("city", cleanCity || "%")
    .limit(1);

  const rows = (existing as { id: string; is_approved: boolean }[] | null) ?? [];
  if (rows.length > 0) return rows[0].id;

  const { data: inserted, error } = await svc
    .schema("future")
    .from("colleges")
    .insert({
      chapter_id: chapterId,
      name: cleanName,
      city: cleanCity || null,
      is_approved: false,
    } as never)
    .select("id")
    .maybeSingle();
  if (error || !inserted) return null;
  return (inserted as { id: string }).id;
}

async function uniqueAccessCode(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate a unique access code after 25 tries.");
}

// ─── REGISTER ───────────────────────────────────────────────────────

export async function registerDelegate(
  input: RegisterDelegateInput
): Promise<RegisterDelegateResult> {
  const full_name = input.full_name?.trim();
  const email = input.email?.trim().toLowerCase();
  const mobile = normalizeMobile(input.mobile ?? "");
  const whatsapp = normalizeMobile(input.whatsapp ?? "");

  if (!full_name) return { ok: false, error: "Please enter your full name." };
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!INDIA_MOBILE_RE.test(mobile)) {
    return { ok: false, error: "Mobile must be a 10-digit Indian number." };
  }
  if (!INDIA_MOBILE_RE.test(whatsapp)) {
    return { ok: false, error: "WhatsApp must be a 10-digit Indian number." };
  }
  if (input.gender !== "male" && input.gender !== "female") {
    return { ok: false, error: "Please pick a gender." };
  }
  if (typeof input.is_yi_yuva_member !== "boolean") {
    return { ok: false, error: "Please answer the Yi YUVA question." };
  }
  if (!input.chapter_id) {
    return { ok: false, error: "Please pick your Yi chapter." };
  }
  if (!input.college_name?.trim()) {
    return { ok: false, error: "Please enter your college name." };
  }
  if (!input.college_city?.trim()) {
    return { ok: false, error: "Please enter your college city." };
  }
  if (!input.course?.trim()) {
    return { ok: false, error: "Please enter your course." };
  }
  if (![1, 2, 3, 4, 5].includes(input.year_of_study as number)) {
    return { ok: false, error: "Please pick your year of study." };
  }
  if (!Number.isFinite(input.age) || input.age < 18 || input.age > 25) {
    return { ok: false, error: "Age must be between 18 and 25." };
  }
  if (input.travel_commitment !== true) {
    return {
      ok: false,
      error:
        "National Finals require travel — please confirm you're willing to travel.",
    };
  }
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  if (input.declaration_accepted !== true) {
    return { ok: false, error: "Please accept the declaration to continue." };
  }

  const svc = await createServiceClient();

  const { data: editionRow } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("slug", "2026")
    .maybeSingle();
  if (!editionRow) {
    return { ok: false, error: "No active edition. Try again later." };
  }
  const editionId = (editionRow as { id: string }).id;

  // Abuse guard — per-IP cap, platform-wide burst breaker, and (once keys are
  // set) a Turnstile bot challenge. Placed immediately after the edition lookup
  // so a blocked request does almost no database work, and crucially BEFORE
  // findOrCreatePendingCollege: the 2026-08-07 script created one junk college
  // per registration, so rejecting late would still have polluted the table.
  const guard = await checkRegistrationAbuse(
    svc,
    editionId,
    input.turnstile_token ?? null
  );
  if (!guard.ok) {
    return { ok: false, error: guard.error };
  }

  // Strict email-unique guard
  const { data: dupEmail } = await svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("edition_id", editionId)
    .eq("email", email)
    .maybeSingle();
  if (dupEmail) {
    return {
      ok: false,
      error:
        "This email is already registered for the 2026 edition. Contact your chapter admin if you need help.",
    };
  }

  // Mobile-unique guard
  const { data: dupPhone } = await svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("edition_id", editionId)
    .eq("phone", mobile)
    .maybeSingle();
  if (dupPhone) {
    return {
      ok: false,
      error:
        "This mobile number is already registered for the 2026 edition. Contact your chapter admin if you need help.",
    };
  }

  // Check for returning delegate (participated in a previous edition — match by email OR phone)
  const { data: prevByEmail } = await svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("email", email)
    .neq("edition_id", editionId)
    .limit(1)
    .maybeSingle();
  const { data: prevByPhone } = await svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("phone", mobile)
    .neq("edition_id", editionId)
    .limit(1)
    .maybeSingle();
  const isReturning = !!(prevByEmail || prevByPhone);

  const { data: chapter } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, is_active")
    .eq("id", input.chapter_id)
    .maybeSingle();
  if (!chapter || (chapter as { is_active: boolean }).is_active === false) {
    return { ok: false, error: "Pick a valid Yi chapter from the list." };
  }

  // Registration window: server-side enforcement so a stale form (saved
  // draft, old tab) can't register into a chapter that has since closed.
  const regWindow = await getRegistrationWindow(editionId);
  if (!isChapterOpenForRegistration(regWindow, input.chapter_id)) {
    return {
      ok: false,
      error:
        "Registrations for this chapter have closed. Contact your chapter team if you think this is a mistake.",
    };
  }

  const college_id = await findOrCreatePendingCollege(
    svc,
    input.chapter_id,
    input.college_name,
    input.college_city
  );

  const access_code = await uniqueAccessCode(svc);
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertErr } = (await svc
    .schema("future")
    .from("delegates")
    .insert({
      edition_id: editionId,
      chapter_id: input.chapter_id,
      full_name,
      email,
      phone: mobile,
      whatsapp,
      gender: input.gender,
      is_yi_yuva_member: input.is_yi_yuva_member,
      age: input.age,
      course: input.course.trim(),
      specialization: input.specialization?.trim() || null,
      year_of_study: input.year_of_study,
      college_id,
      access_code,
      is_active: true,
      registered_at: nowIso,
      registration_ip: guard.ip,
      interest_internships: input.interest_internships,
      interest_jobs: input.interest_jobs,
      interest_workshops: input.interest_workshops,
      travel_commitment_acknowledged_at: nowIso,
      declaration_accepted_at: nowIso,
      preferred_track_slug: input.preferred_track_slug || null,
      points: input.preferred_track_slug ? 20 : 10,
      badges: input.preferred_track_slug ? ["joined", "track_matched"] : ["joined"],
      profile_completion_pct: 100,
    } as never)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { code?: string; message?: string } | null;
  };

  if (insertErr) {
    if (insertErr.code === "23505") {
      return {
        ok: false,
        error:
          "This email is already registered for the 2026 edition. Contact your chapter admin if you need help.",
      };
    }
    return {
      ok: false,
      error: insertErr.message ?? "Couldn't register you — try again.",
    };
  }

  // Create or update Supabase Auth account for email+password login
  let authUserId: string | null = null;
  const { data: authData, error: authErr } = await svc.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name, role: "delegate" },
  });
  if (authErr?.message?.includes("already been registered")) {
    // Account exists — update password to the one they just set
    const { data: existing } = await svc.auth.admin.listUsers();
    const match = existing?.users?.find((u) => u.email === email);
    if (match) {
      await svc.auth.admin.updateUserById(match.id, { password: input.password });
      authUserId = match.id;
    }
  } else if (authErr) {
    console.warn("Auth account creation failed:", authErr.message);
  } else {
    authUserId = authData?.user?.id ?? null;
  }

  // Upsert into yi_directory.people — cross-app identity bridge
  await svc
    .schema("yi_directory" as "public")
    .from("people")
    .upsert(
      {
        user_id: authUserId,
        full_name,
        email,
        phone: mobile || null,
        is_active: true,
      } as never,
      { onConflict: "email" }
    );

  // Fire the registration-confirmation email (delivers the access code so a
  // delegate who closes the thank-you tab still has it). Non-blocking: a
  // notification failure must NEVER fail a registration that already
  // committed — the row exists and the code is shown on the thank-you page.
  if (inserted?.id) {
    try {
      await notifyRegistrationConfirmed(inserted.id);
    } catch (e) {
      console.warn(
        "[register] registration email failed:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  return {
    ok: true,
    access_code,
    returning: isReturning,
    redirect: `/yi-future/join/thank-you?email=${encodeURIComponent(email)}&code=${encodeURIComponent(access_code)}${isReturning ? "&returning=1" : ""}`,
  };
}

// ─── COLLEGE AUTOCOMPLETE (used by wizard step 2) ───────────────────

export type CollegeSuggestion = { id: string; name: string; city: string | null };

export async function searchApprovedColleges(
  chapterId: string,
  query: string
): Promise<CollegeSuggestion[]> {
  const q = query.trim();
  if (!chapterId || q.length < 2) return [];

  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name, city")
    .eq("chapter_id", chapterId)
    .eq("is_approved", true)
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(8);

  return (data as CollegeSuggestion[] | null) ?? [];
}
