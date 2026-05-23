"use server";

import { createServiceClient } from "@/lib/yi-future/supabase/server";

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
};

export type RegisterDelegateResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

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

  // Strict email-unique guard
  const { data: dup } = await svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("edition_id", editionId)
    .eq("email", email)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      error:
        "This email is already registered for the 2026 edition. Contact your chapter admin if you need help.",
    };
  }

  const { data: chapter } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, is_active")
    .eq("id", input.chapter_id)
    .maybeSingle();
  if (!chapter || (chapter as { is_active: boolean }).is_active === false) {
    return { ok: false, error: "Pick a valid Yi chapter from the list." };
  }

  const college_id = await findOrCreatePendingCollege(
    svc,
    input.chapter_id,
    input.college_name,
    input.college_city
  );

  const nowIso = new Date().toISOString();

  const { error: insertErr } = await svc
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
      is_active: true,
      registered_at: nowIso,
      interest_internships: input.interest_internships,
      interest_jobs: input.interest_jobs,
      interest_workshops: input.interest_workshops,
      travel_commitment_acknowledged_at: nowIso,
      declaration_accepted_at: nowIso,
      points: 10,
      badges: ["joined"],
      profile_completion_pct: 100,
    } as never);

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

  return {
    ok: true,
    redirect: `/yi-future/join/thank-you?email=${encodeURIComponent(email)}`,
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
