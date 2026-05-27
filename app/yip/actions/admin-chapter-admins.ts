"use server";

// ═══════════════════════════════════════════════════════════════════════
// Chapter Admin Provisioning — F8 from YIP demo-readiness spec.
//
// Super-admin only. Creates a Supabase auth user for a YIP chapter admin
// and inserts the matching yip.organizers row with a chapter-name-based
// login_slug (e.g. "mizoram-1").
//
// Returns the freshly-generated password ONCE for one-shot display. The
// password is never stored or logged anywhere — caller must capture and
// share with the chapter admin out-of-band.
//
// Mirrors app/yi-future/actions/national-admins.ts password-management
// pattern (same alphabet, same one-shot reveal, same auth admin REST API).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export type CreateChapterAdminResult =
  | { ok: true; email: string; password: string; loginSlug: string }
  | { ok: false; error: string };

export type ChapterRow = {
  chapter_id: string;
  chapter_name: string;
  city: string | null;
  state: string | null;
  region: string | null;
  existing_admin_count: number;
};

// Same alphabet as scripts/seed_chapter_chairs.py (excludes 0 O o I l 1 2 Z B 8)
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

function slugifyChapterName(name: string, ordinal: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${ordinal}`;
}

// ─── Super-admin guard ──────────────────────────────────────────────

async function requireYipSuperAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Promise.reject(new Error("Not authenticated"));
  }

  // Look up yi_directory.role_assignments where app='yip' AND title ILIKE '%super%'
  const svc = await createServiceClient();
  const { data, error } = await svc
    // @ts-expect-error — yi_directory.role_assignments is in generated types but
    // the schema-pin to "yip" doesn't auto-expose other-schema tables for typing.
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, app, title, role, person:people!inner(email)")
    .eq("app", "yip")
    .ilike("title", "%super%");

  if (error) throw error;

  const userEmail = (user.email ?? "").toLowerCase();
  const isSuper = (data ?? []).some(
    (r) => (r.person as { email?: string })?.email?.toLowerCase() === userEmail
  );

  if (!isSuper) {
    return Promise.reject(new Error("Super admin only"));
  }
  return user.email!;
}

// ─── List chapters with admin counts ─────────────────────────────────

export async function listChaptersForAdminProvisioning(): Promise<
  ActionResult<ChapterRow[]>
> {
  try {
    await requireYipSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const svc = await createServiceClient();

  const { data: chapters, error: chErr } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state, region, is_active")
    .eq("is_active", true)
    .order("name");
  if (chErr) return { ok: false, error: chErr.message };

  // Count existing chapter admins per chapter (name match — simple, matches
  // how organizers.chapter_name is set today)
  const { data: organizers } = await svc
    .from("organizers")
    .select("chapter_name")
    .eq("role", "chapter_em")
    .eq("is_active", true);

  const counts = new Map<string, number>();
  for (const o of organizers ?? []) {
    if (o.chapter_name) {
      counts.set(o.chapter_name, (counts.get(o.chapter_name) ?? 0) + 1);
    }
  }

  const rows: ChapterRow[] = (chapters ?? []).map((c) => ({
    chapter_id: c.id,
    chapter_name: c.name,
    city: c.city,
    state: c.state,
    region: c.region,
    existing_admin_count: counts.get(c.name) ?? 0,
  }));

  return { ok: true, data: rows };
}

// ─── Create chapter admin ────────────────────────────────────────────

export async function createChapterAdmin(input: {
  chapterId: string;
  email: string;
  fullName: string;
}): Promise<CreateChapterAdminResult> {
  try {
    await requireYipSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!fullName || fullName.length < 2) {
    return { ok: false, error: "Enter the admin's full name." };
  }

  const svc = await createServiceClient();

  // 1. Load the chapter — get its name (for login_slug + organizer row)
  const { data: chapter, error: chErr } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("id", input.chapterId)
    .single();
  if (chErr || !chapter) {
    return { ok: false, error: "Chapter not found." };
  }

  // 2. Decide login_slug — chapter-name + ordinal of next admin
  const { count } = await svc
    .from("organizers")
    .select("id", { count: "exact", head: true })
    .eq("chapter_name", chapter.name)
    .eq("role", "chapter_em");
  const ordinal = (count ?? 0) + 1;
  const loginSlug = slugifyChapterName(chapter.name, ordinal);

  // 3. Generate password
  const password = generatePassword();

  // 4. Create auth user via admin REST API
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        yip_role: "chapter_em",
        yip_chapter: chapter.name,
        login_slug: loginSlug,
      },
    }),
    cache: "no-store",
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    if (createRes.status === 422 || /already.*registered/i.test(txt)) {
      return {
        ok: false,
        error: `${email} is already a Supabase user. Reset their password via the auth dashboard instead.`,
      };
    }
    return {
      ok: false,
      error: `Failed to create auth user (HTTP ${createRes.status}): ${txt.slice(0, 200)}`,
    };
  }

  const createBody = (await createRes.json()) as { id: string };
  const authUserId = createBody.id;

  // 5. Insert yip.organizers row
  const { error: orgErr } = await svc.from("organizers").insert({
    user_id: authUserId,
    email,
    full_name: fullName,
    role: "chapter_em",
    chapter_name: chapter.name,
    title: `Chapter EM — ${chapter.name}`,
    is_active: true,
    is_mock: false,
    login_slug: loginSlug,
  });

  if (orgErr) {
    // Rollback the auth user so we don't leave an orphan
    await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
      method: "DELETE",
      headers,
    });
    return {
      ok: false,
      error: `Created auth user but organizer insert failed: ${orgErr.message}. Auth user rolled back.`,
    };
  }

  revalidatePath("/yip/dashboard/admin/chapter-admins");
  return { ok: true, email, password, loginSlug };
}
