"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";

// ═══════════════════════════════════════════════════════════════════════
// Chapter chairs — list + password-reset for the ~63 chapter chairs on
// future.chapter_core_team (role = 'chapter_chair') across all active
// editions.
//
// Gating: list is open to any authenticated visitor (the surrounding
// /national/admin layout already redirects unauthenticated users); the
// reset endpoint is gated on super OR platform admin, mirroring
// resetNationalAdminPassword in national-admins.ts.
// ═══════════════════════════════════════════════════════════════════════

export type ResetPasswordResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

export type AddChairResult =
  | { ok: true; id: string; email: string; role: ChapterChairRole }
  | { ok: false; error: string };

export type ChapterOption = {
  id: string;
  name: string;
  region: string | null;
};

export type ChapterChairRole = "chapter_chair" | "chapter_co_chair";

export type ChapterChairRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  role: ChapterChairRole;
  chapter_id: string;
  chapter_name: string;
  chapter_region: string | null;
  edition_id: string;
  edition_name: string;
  edition_slug: string;
  yi_year: number;
  last_sign_in_at: string | null;
};

export type YearOption = {
  year: number;
  edition_id: string;
  edition_name: string;
  is_active: boolean;
};

// Same alphabet as scripts/seed_chapter_chairs.py & resetNationalAdminPassword.
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXY" + "abcdefghijkmnpqrstuvwxy" + "3456789";
const PASSWORD_LENGTH = 12;

function generatePassword(): string {
  const bytes = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET.charAt(bytes[i] % PASSWORD_ALPHABET.length);
  }
  return out;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ─── Reads ──────────────────────────────────────────────────────────

/**
 * List the years/editions that have any chair on file.
 * Used for the year-filter dropdown.
 */
export async function listChairYears(): Promise<YearOption[]> {
  const svc = await createServiceClient();
  const { data: editions } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug, kickoff_date, is_active")
    .order("kickoff_date", { ascending: false });
  type EditionRow = {
    id: string;
    name: string;
    slug: string;
    kickoff_date: string | null;
    is_active: boolean;
  };
  return ((editions as EditionRow[] | null) ?? [])
    .map((e) => ({
      year: e.kickoff_date
        ? new Date(e.kickoff_date).getUTCFullYear()
        : parseInt(e.slug, 10) || new Date().getUTCFullYear(),
      edition_id: e.id,
      edition_name: e.name,
      is_active: e.is_active,
    }));
}

/**
 * List chapter chairs for a specific year (defaults to active edition).
 * Joins yi.chapters for chapter name + region, yi_directory.people for
 * canonical identity, and the auth admin REST API for last_sign_in_at.
 *
 * Sorted: active first, chapter name, chair before co-chair.
 */
export async function listChapterChairs(
  year?: number
): Promise<ChapterChairRow[]> {
  const svc = await createServiceClient();

  // Resolve edition: by year if provided, else the active one.
  let editionId: string | null = null;
  let editionYear: number | null = null;
  if (year !== undefined) {
    const { data: editions } = await svc
      .schema("future")
      .from("editions")
      .select("id, kickoff_date")
      .order("kickoff_date", { ascending: false });
    const match = ((editions as Array<{ id: string; kickoff_date: string | null }> | null) ?? [])
      .find((e) => e.kickoff_date && new Date(e.kickoff_date).getUTCFullYear() === year);
    if (match) {
      editionId = match.id;
      editionYear = year;
    }
  } else {
    const { data: activeEdition } = await svc
      .schema("future")
      .from("editions")
      .select("id, kickoff_date")
      .eq("is_active", true)
      .maybeSingle();
    if (activeEdition) {
      editionId = (activeEdition as { id: string }).id;
      const kd = (activeEdition as { kickoff_date: string | null }).kickoff_date;
      editionYear = kd ? new Date(kd).getUTCFullYear() : null;
    }
  }

  type CoreTeamRow = {
    id: string;
    user_id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    role: ChapterChairRole;
    chapter_id: string;
    edition_id: string;
    person_id: string | null;
    chapters: { name: string; region: string | null } | null;
    editions: { name: string; slug: string; kickoff_date: string | null } | null;
  };

  let query = svc
    .schema("future")
    .from("chapter_core_team")
    .select(
      "id, user_id, full_name, email, phone, is_active, role, chapter_id, edition_id, person_id, chapters(name, region), editions(name, slug, kickoff_date)"
    )
    // Cast as never: chapter_chair / chapter_co_chair are not yet in
    // generated types (added in migrations 129 / 024).
    .in("role" as never, ["chapter_chair", "chapter_co_chair"] as never);

  if (editionId) {
    query = query.eq("edition_id", editionId);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  // Fetch last_sign_in_at for each chair via the admin REST API. One
  // page (per_page=200) covers our 63 chairs comfortably.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const lastSignInByEmail = new Map<string, string | null>();
  try {
    const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as {
        users?: { email?: string; last_sign_in_at?: string | null }[];
      };
      for (const u of body.users ?? []) {
        if (u.email) {
          lastSignInByEmail.set(
            normalizeEmail(u.email),
            u.last_sign_in_at ?? null
          );
        }
      }
    }
  } catch {
    // Non-fatal — chairs render with "Never" in the last-sign-in cell.
  }

  const typed = rows as unknown as CoreTeamRow[];

  // ── Pull canonical identity from yi_directory.people in one round-trip ─
  const personIds = Array.from(
    new Set(typed.map((r) => r.person_id).filter((x): x is string => Boolean(x)))
  );
  const personById = new Map<string, { full_name: string; email: string | null; phone: string | null }>();
  if (personIds.length > 0) {
    // Cast: yi_directory schema isn't in generated types yet (migrations 023-025).
    // Re-run `supabase gen types --schema yi_directory` to remove.
    const svcDir = svc.schema("yi_directory" as never) as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{
            data: Array<{
              id: string;
              full_name: string;
              email: string | null;
              phone: string | null;
            }> | null;
            error: unknown;
          }>;
        };
      };
    };
    const { data: people } = await svcDir
      .from("people")
      .select("id, full_name, email, phone")
      .in("id", personIds);
    for (const p of people ?? []) {
      personById.set(p.id, { full_name: p.full_name, email: p.email, phone: p.phone });
    }
  }

  const enriched: ChapterChairRow[] = typed.map((r) => {
    // Prefer directory identity (canonical), fall back to source row.
    const person = r.person_id ? personById.get(r.person_id) : undefined;
    const rowYear = r.editions?.kickoff_date
      ? new Date(r.editions.kickoff_date).getUTCFullYear()
      : editionYear ?? new Date().getUTCFullYear();
    return {
      id: r.id,
      user_id: r.user_id,
      full_name: person?.full_name ?? r.full_name,
      email: person?.email ?? r.email,
      phone: person?.phone ?? r.phone,
      is_active: r.is_active,
      role: r.role,
      chapter_id: r.chapter_id,
      chapter_name: r.chapters?.name ?? "Unknown chapter",
      chapter_region: r.chapters?.region ?? null,
      edition_id: r.edition_id,
      edition_name: r.editions?.name ?? "",
      edition_slug: r.editions?.slug ?? "",
      yi_year: rowYear,
      last_sign_in_at: r.email
        ? lastSignInByEmail.get(normalizeEmail(r.email)) ?? null
        : null,
    };
  });

  // Sort: active first, then chapter name, then chair before co-chair.
  enriched.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    const byChapter = a.chapter_name.localeCompare(b.chapter_name);
    if (byChapter !== 0) return byChapter;
    return a.role === "chapter_chair" ? -1 : 1;
  });

  return enriched;
}

// ─── Writes ─────────────────────────────────────────────────────────

/**
 * Reset a chapter chair's password. Gated on super OR platform admin
 * (broadened 2026-05-21 — both tiers handle "I forgot my password"
 * requests from chairs). Mirrors resetNationalAdminPassword.
 *
 * The target email must:
 *   1. Be on a future.chapter_core_team row with role='chapter_chair'
 *      (so this can't turn into a generic password-reset endpoint).
 *   2. Have a matching auth.users row.
 */
export async function resetChapterChairPassword(
  formData: FormData
): Promise<ResetPasswordResult> {
  // ── Viewer gate: super OR platform ──────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");
  const viewerEmail = normalizeEmail(user.email);

  const svc = await createServiceClient();
  const { data: viewerRow } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin, is_platform_admin" as never)
    .eq("email", viewerEmail)
    .maybeSingle<{ is_super_admin: boolean; is_platform_admin: boolean }>();
  if (
    !viewerRow ||
    (!viewerRow.is_super_admin && !viewerRow.is_platform_admin)
  ) {
    redirect("/yi-future/national/admin?error=not_super_or_platform_admin");
  }

  // ── Target check ────────────────────────────────────────────────
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Missing email." };

  const { data: chairRow } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("email")
    .eq("email", email)
    .in("role" as never, ["chapter_chair", "chapter_co_chair"] as never)
    .maybeSingle();
  if (!chairRow) {
    return { ok: false, error: `${email} is not a chapter chair or co-chair.` };
  }

  // ── Auth user lookup ────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const findRes = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
    { headers, cache: "no-store" }
  );
  if (!findRes.ok) {
    return {
      ok: false,
      error: `Failed to look up ${email} in auth.users (HTTP ${findRes.status}).`,
    };
  }
  const findBody = (await findRes.json()) as {
    users?: { id: string; email?: string }[];
  };
  const userRow = (findBody.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email
  );
  if (!userRow) {
    return {
      ok: false,
      error: `${email} has a chapter_core_team row but no auth.users record. Re-run scripts/seed_chapter_chairs.py for this chair.`,
    };
  }

  // ── Apply new password ──────────────────────────────────────────
  const newPassword = generatePassword();
  const patchRes = await fetch(`${url}/auth/v1/admin/users/${userRow.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: newPassword, email_confirm: true }),
    cache: "no-store",
  });
  if (!patchRes.ok) {
    const txt = await patchRes.text();
    return {
      ok: false,
      error: `Failed to update password (HTTP ${patchRes.status}): ${txt.slice(0, 200)}`,
    };
  }

  revalidatePath("/national/admin/chairs");
  return { ok: true, email, password: newPassword };
}

/**
 * List active chapters for the Add Chair/Co-Chair form dropdown.
 */
export async function listActiveChapters(): Promise<ChapterOption[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region")
    .order("name");
  return (data as ChapterOption[] | null) ?? [];
}

/**
 * Add a chapter chair or co-chair. Gated on super OR platform admin.
 * Trigger trg_chapter_core_team_sync_write auto-creates the matching
 * yi_directory.people + role_assignments rows.
 *
 * Does NOT create the auth.users login — chair must still log in via
 * scripts/seed_chapter_chairs.py or a future password-set flow.
 */
export async function addChapterChair(
  formData: FormData
): Promise<AddChairResult> {
  // ── Viewer gate ─────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");
  const viewerEmail = normalizeEmail(user.email);

  const svc = await createServiceClient();
  const { data: viewerRow } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin, is_platform_admin" as never)
    .eq("email", viewerEmail)
    .maybeSingle<{ is_super_admin: boolean; is_platform_admin: boolean }>();
  if (
    !viewerRow ||
    (!viewerRow.is_super_admin && !viewerRow.is_platform_admin)
  ) {
    return {
      ok: false,
      error: "Only super or platform admins can add chairs.",
    };
  }

  // ── Inputs ──────────────────────────────────────────────────────
  const chapterId = String(formData.get("chapter_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as ChapterChairRole;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!chapterId) return { ok: false, error: "Pick a chapter." };
  if (role !== "chapter_chair" && role !== "chapter_co_chair") {
    return { ok: false, error: "Role must be Chair or Co-Chair." };
  }
  if (!fullName || fullName.length < 2) {
    return { ok: false, error: "Full name is required (min 2 chars)." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Valid email is required." };
  }

  // ── Active edition (required FK) ────────────────────────────────
  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!edition?.id) {
    return { ok: false, error: "No active edition. Activate one first." };
  }

  // ── Duplicate guard ─────────────────────────────────────────────
  const { data: existing } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("id")
    .eq("edition_id", edition.id)
    .eq("chapter_id", chapterId)
    .eq("email", email)
    .eq("role" as never, role as never)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: `${email} is already the ${role === "chapter_chair" ? "Chair" : "Co-Chair"} for this chapter in the active edition.`,
    };
  }

  // ── Insert (trigger handles yi_directory sync) ──────────────────
  const { data: inserted, error: insErr } = await svc
    .schema("future")
    .from("chapter_core_team")
    .insert({
      edition_id: edition.id,
      chapter_id: chapterId,
      role: role as never,
      full_name: fullName,
      email,
      phone,
      is_active: true,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "Insert failed.",
    };
  }

  revalidatePath("/national/admin/chairs");
  return { ok: true, id: inserted.id, email, role };
}
