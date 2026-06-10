"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — academy actions (Phase 5).
//
// REWRITTEN model (spec docs/yi-youth-academy-spec.md, "National —
// academies"): NATIONAL creates academies — creation IS the approval, there
// is no onboarding pipeline / MoU. Chapters get a read view plus two
// chapter-owned mutations: coordinator assignment and qualitative notes.
//
// Two gates — never mixed (pinned by lib/yuva/__tests__/academy-gate.test.ts):
//   RECORD mutations (createAcademy / updateAcademy / uploadAcademyLogo /
//   setAcademyActive)            → requireYuvaNational()
//   CHAPTER surface (assignCoordinator / removeCoordinator /
//   updateQualitativeNotes)      → getYuvaAccess().canManageAcademy
//
// Conventions: ActionResult, gate-first, SERVICE client (no write RLS in
// `yuva`), logYuvaAudit + revalidatePath on every mutation. Cross-schema
// reads (yi.chapters, yi.institutions, yi_directory.*) use a per-call
// .schema(...) on the service client with a minimal structural cast
// (repo precedent: lib/yi/directory/resolve-person.ts).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { CAPACITY_DEFAULT, ROLE_INSTITUTION_COORDINATOR, YUVA_APP } from "@/lib/yuva/constants";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { coordinatorInviteEmail } from "@/lib/yuva/email-templates";
import { uploadBase64, publicUrl } from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { checkRoleWriteAllowed } from "@/lib/yi/auth/role-write-guard";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";

// ─── Cross-schema access (yi / yi_directory are not in the yuva Database
// type — minimal structural cast, donor: lib/yi/directory/resolve-person.ts).

type Svc = Awaited<ReturnType<typeof createServiceClient>>;
type DbErr = { message: string; code?: string } | null;
type Many = Promise<{ data: Record<string, unknown>[] | null; error: DbErr }>;
type OneRow = Promise<{ data: Record<string, unknown> | null; error: DbErr }>;

interface LooseBuilder extends PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: DbErr;
}> {
  select: (cols: string) => LooseBuilder;
  insert: (row: Record<string, unknown>) => LooseBuilder;
  update: (row: Record<string, unknown>) => LooseBuilder;
  eq: (col: string, val: unknown) => LooseBuilder;
  neq: (col: string, val: unknown) => LooseBuilder;
  is: (col: string, val: null) => LooseBuilder;
  in: (col: string, vals: unknown[]) => LooseBuilder;
  ilike: (col: string, val: string) => LooseBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => LooseBuilder;
  limit: (n: number) => LooseBuilder;
  maybeSingle: () => OneRow;
  single: () => OneRow;
  then: Many["then"];
}

function crossSchema(svc: Svc, schema: "yi" | "yi_directory") {
  return svc.schema(schema as never) as unknown as {
    from: (table: string) => LooseBuilder;
  };
}

// Escape % and _ so .ilike() with no added wildcards is a case-insensitive
// EQUALITY check, not an accidental pattern match.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const norm = (s: string) => s.trim().toLowerCase();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Run statuses that make an academy "live" — deactivation is blocked while
// any run is in one of these (spec edge case).
const LIVE_RUN_STATUSES = [
  "published",
  "applications_closed",
  "in_progress",
] as const;

const NATIONAL_LIST_PATH = "/youth-academy/national/academies";
const CHAPTER_PATH = "/youth-academy/chapter";

function revalidateAcademyPaths(academyId?: string) {
  revalidatePath(NATIONAL_LIST_PATH);
  if (academyId) revalidatePath(`${NATIONAL_LIST_PATH}/${academyId}`);
  revalidatePath(CHAPTER_PATH);
  revalidatePath(`${CHAPTER_PATH}/academies`);
}

/**
 * Display-name default (spec): "Yi {Chapter} Youth Academy" until an
 * institution is attached, then "Yi – {Institution} Youth Academy".
 */
function defaultDisplayName(
  chapter: string,
  institutionName: string | null
): string {
  return institutionName
    ? `Yi – ${institutionName} Youth Academy`
    : `Yi ${chapter} Youth Academy`;
}

async function institutionNameById(
  svc: Svc,
  institutionId: string
): Promise<string | null> {
  const { data } = await crossSchema(svc, "yi")
    .from("institutions")
    .select("name")
    .eq("id", institutionId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

/**
 * Duplicate-institution check (spec: "institution already attached to another
 * academy → block duplicate"; when institution_id is null, dedupe on
 * lower(institution_other)). Returns a friendly error string, or null if OK.
 */
async function duplicateInstitutionError(
  svc: Svc,
  input: { institution_id: string | null; institution_other: string | null },
  excludeAcademyId?: string
): Promise<string | null> {
  if (input.institution_id) {
    let q = svc
      .from("academies")
      .select("id, display_name")
      .eq("institution_id", input.institution_id);
    if (excludeAcademyId) q = q.neq("id", excludeAcademyId);
    const { data } = await q.limit(1);
    if (data && data.length > 0) {
      return `That institution is already attached to "${data[0].display_name}". An institution can belong to only one academy — edit that academy instead.`;
    }
    return null;
  }
  const other = input.institution_other?.trim();
  if (other) {
    let q = svc
      .from("academies")
      .select("id, display_name")
      .is("institution_id", null)
      .ilike("institution_other", escapeLike(other));
    if (excludeAcademyId) q = q.neq("id", excludeAcademyId);
    const { data } = await q.limit(1);
    if (data && data.length > 0) {
      return `An academy with that institution name already exists ("${data[0].display_name}"). Edit that academy instead.`;
    }
  }
  return null;
}

// ─── listYiChapters ──────────────────────────────────────────────────────
// Chapter picker source for the NATIONAL academy form: read names from
// yi.chapters via a per-call .schema("yi") on the service client. The form
// also offers a free-text fallback for chapters not yet in yi.chapters.

export async function listYiChapters(): Promise<
  ActionResult<{ name: string; region: string | null }[]>
> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const { data, error } = await crossSchema(svc, "yi")
    .from("chapters")
    .select("name, region")
    .eq("is_active", true)
    .order("name");
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      name: String(r.name),
      region: (r.region as string | null) ?? null,
    })),
  };
}

// ─── createAcademy (NATIONAL — creation IS the approval) ────────────────

const createAcademySchema = z.object({
  chapter: z.string().trim().min(2, "Pick or type a chapter").max(120),
  institution_id: z.string().uuid().nullish(),
  institution_other: z.string().trim().max(200).nullish(),
  display_name: z.string().trim().max(200).optional(),
  capacity_norm: z.number().int().min(1).max(500).optional(),
});

export async function createAcademy(
  input: z.infer<typeof createAcademySchema>
): Promise<ActionResult<{ id: string; display_name: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = createAcademySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid academy details",
    };
  }
  const v = parsed.data;
  const institutionId = v.institution_id ?? null;
  // institution_other is only meaningful when no canonical institution is set.
  const institutionOther = institutionId
    ? null
    : v.institution_other?.trim() || null;

  const svc = await createServiceClient();

  const dupErr = await duplicateInstitutionError(svc, {
    institution_id: institutionId,
    institution_other: institutionOther,
  });
  if (dupErr) return { success: false, error: dupErr };

  // Display-name default: "Yi {Chapter} Youth Academy" or
  // "Yi – {Institution} Youth Academy" once an institution is attached.
  let displayName = v.display_name?.trim() || "";
  if (!displayName) {
    const institutionName = institutionId
      ? await institutionNameById(svc, institutionId)
      : institutionOther;
    displayName = defaultDisplayName(v.chapter, institutionName);
  }

  const { data: created, error } = await svc
    .from("academies")
    .insert({
      chapter: v.chapter,
      institution_id: institutionId,
      institution_other: institutionOther,
      display_name: displayName,
      capacity_norm: v.capacity_norm ?? CAPACITY_DEFAULT,
      is_active: true,
      created_by: gate.personId,
    })
    .select("id, display_name")
    .single();
  if (error || !created) {
    return {
      success: false,
      error: `Could not create the academy: ${error?.message ?? "unknown error"}`,
    };
  }

  await logYuvaAudit({
    action: "create",
    entity: "academies",
    entity_id: created.id,
    chapter: v.chapter,
    meta: {
      display_name: created.display_name,
      institution_id: institutionId,
      institution_other: institutionOther,
    },
  });
  revalidateAcademyPaths(created.id);
  return {
    success: true,
    data: { id: created.id, display_name: created.display_name },
  };
}

// ─── updateAcademy (NATIONAL) ────────────────────────────────────────────

const updateAcademySchema = z.object({
  academyId: z.string().uuid(),
  chapter: z.string().trim().min(2).max(120).optional(),
  institution_id: z.string().uuid().nullish(),
  institution_other: z.string().trim().max(200).nullish(),
  display_name: z.string().trim().max(200).optional(),
  capacity_norm: z.number().int().min(1).max(500).optional(),
});

export async function updateAcademy(
  input: z.infer<typeof updateAcademySchema>
): Promise<ActionResult<{ id: string; display_name: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = updateAcademySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid academy details",
    };
  }
  const v = parsed.data;

  const svc = await createServiceClient();
  const { data: existing } = await svc
    .from("academies")
    .select("id, chapter, display_name, institution_id, institution_other")
    .eq("id", v.academyId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Academy not found." };

  const chapter = v.chapter ?? existing.chapter;
  // `institution_id === undefined` means "unchanged"; null means "detach".
  const institutionId =
    v.institution_id === undefined ? existing.institution_id : v.institution_id;
  const institutionOther = institutionId
    ? null
    : v.institution_other === undefined
      ? existing.institution_other
      : v.institution_other?.trim() || null;

  const dupErr = await duplicateInstitutionError(
    svc,
    { institution_id: institutionId, institution_other: institutionOther },
    v.academyId
  );
  if (dupErr) return { success: false, error: dupErr };

  // Blank display_name ⇒ recompute the default from the (new) institution.
  let displayName = v.display_name?.trim() ?? existing.display_name;
  if (v.display_name !== undefined && !v.display_name.trim()) {
    const institutionName = institutionId
      ? await institutionNameById(svc, institutionId)
      : institutionOther;
    displayName = defaultDisplayName(chapter, institutionName);
  }

  const { data: updated, error } = await svc
    .from("academies")
    .update({
      chapter,
      institution_id: institutionId,
      institution_other: institutionOther,
      display_name: displayName,
      ...(v.capacity_norm !== undefined
        ? { capacity_norm: v.capacity_norm }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.academyId)
    .select("id, display_name")
    .single();
  if (error || !updated) {
    return {
      success: false,
      error: `Could not update the academy: ${error?.message ?? "unknown error"}`,
    };
  }

  await logYuvaAudit({
    action: "update",
    entity: "academies",
    entity_id: v.academyId,
    chapter,
    meta: {
      display_name: displayName,
      institution_id: institutionId,
      institution_other: institutionOther,
      previous_display_name: existing.display_name,
    },
  });
  revalidateAcademyPaths(v.academyId);
  return {
    success: true,
    data: { id: updated.id, display_name: updated.display_name },
  };
}

// ─── uploadAcademyLogo (NATIONAL — base64 → public yuva-public bucket) ──

const MAX_LOGO_BASE64_CHARS = 2_800_000; // ≈ 2 MB binary

export async function uploadAcademyLogo(input: {
  academyId: string;
  base64: string;
  contentType: string;
}): Promise<ActionResult<{ path: string; url: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!input.academyId || !z.string().uuid().safeParse(input.academyId).success) {
    return { success: false, error: "Invalid academy id." };
  }
  if (!input.contentType?.startsWith("image/")) {
    return { success: false, error: "The logo must be an image file." };
  }
  if (!input.base64 || input.base64.length > MAX_LOGO_BASE64_CHARS) {
    return { success: false, error: "Logo image must be under 2 MB." };
  }

  const svc = await createServiceClient();
  const { data: academy } = await svc
    .from("academies")
    .select("id, chapter, display_name")
    .eq("id", input.academyId)
    .maybeSingle();
  if (!academy) return { success: false, error: "Academy not found." };

  // Spec-fixed path; upsert replaces the previous logo in place.
  const path = `academies/${academy.id}/logo.png`;
  const uploaded = await uploadBase64(
    "yuva-public",
    path,
    input.base64,
    input.contentType
  );
  if (!uploaded.ok) {
    return { success: false, error: `Logo upload failed: ${uploaded.error}` };
  }

  const { error } = await svc
    .from("academies")
    .update({ logo_storage_path: path, updated_at: new Date().toISOString() })
    .eq("id", academy.id);
  if (error) {
    return {
      success: false,
      error: `Logo uploaded but could not be saved on the academy: ${error.message}`,
    };
  }

  await logYuvaAudit({
    action: "upload_logo",
    entity: "academies",
    entity_id: academy.id,
    chapter: academy.chapter,
    meta: { path, content_type: input.contentType },
  });
  revalidateAcademyPaths(academy.id);
  return { success: true, data: { path, url: publicUrl(path) } };
}

// ─── setAcademyActive (NATIONAL — deactivate blocked while a live run) ──

export async function setAcademyActive(input: {
  academyId: string;
  active: boolean;
}): Promise<ActionResult<{ id: string; is_active: boolean }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!z.string().uuid().safeParse(input.academyId).success) {
    return { success: false, error: "Invalid academy id." };
  }

  const svc = await createServiceClient();
  const { data: academy } = await svc
    .from("academies")
    .select("id, chapter, display_name, is_active")
    .eq("id", input.academyId)
    .maybeSingle();
  if (!academy) return { success: false, error: "Academy not found." };

  if (!input.active) {
    const { data: liveRuns } = await svc
      .from("runs")
      .select("id, status")
      .eq("academy_id", academy.id)
      .in("status", [...LIVE_RUN_STATUSES])
      .limit(1);
    if (liveRuns && liveRuns.length > 0) {
      return {
        success: false,
        error: `Cannot deactivate "${academy.display_name}" — it has a live run (${liveRuns[0].status.replace(/_/g, " ")}). Wait until the run completes or cancel it first.`,
      };
    }
  }

  const { error } = await svc
    .from("academies")
    .update({ is_active: input.active, updated_at: new Date().toISOString() })
    .eq("id", academy.id);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: input.active ? "activate" : "deactivate",
    entity: "academies",
    entity_id: academy.id,
    chapter: academy.chapter,
    meta: { display_name: academy.display_name },
  });
  revalidateAcademyPaths(academy.id);
  return { success: true, data: { id: academy.id, is_active: input.active } };
}

// ═══════════════════════════════════════════════════════════════════════
// CHAPTER-owned surface — getYuvaAccess().canManageAcademy
// (chapter admin of the academy's chapter, or national)
// ═══════════════════════════════════════════════════════════════════════

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

/**
 * Find-or-create a yi_directory.people row for an email AND ensure an auth
 * login exists (donor: app/yip/actions/chapter-roles.ts ensurePerson —
 * role-HOLDERS must be able to sign in, so unlike resolvePerson() this also
 * provisions auth.users with a generated password returned ONCE).
 */
async function ensureCoordinatorPerson(
  svc: Svc,
  email: string,
  fullName: string
): Promise<
  | { ok: true; personId: string; created: boolean; password?: string }
  | { ok: false; error: string }
> {
  // 1. Existing directory person by email? (spec edge case: link to the
  //    existing person instead of creating a duplicate identity)
  const { data: existing } = await crossSchema(svc, "yi_directory")
    .from("people")
    .select("id, user_id")
    .ilike("email", escapeLike(email))
    .maybeSingle();
  if (existing && existing.user_id) {
    return { ok: true, personId: String(existing.id), created: false };
  }
  // An existing person WITHOUT a user_id (subject identity from
  // resolvePerson — students/delegates carry no login) falls through:
  // coordinators are role-HOLDERS and must be able to sign in, so we
  // provision the auth user below and LINK it instead of inserting a dup.
  const existingPersonId = existing ? String(existing.id) : null;

  // 2. Existing auth user? (the ?email= filter is known-broken on this
  //    endpoint — it ignores the filter — so we ALWAYS verify with find();
  //    memory: feedback_supabase_admin_users_email_filter_broken)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  let authUserId: string | null = null;
  let password: string | undefined;
  let created = false;

  const lookup = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers, cache: "no-store" }
  );
  if (lookup.ok) {
    const body = (await lookup.json()) as {
      users?: Array<{ id: string; email?: string }>;
    };
    const match = (body.users ?? []).find(
      (u) => norm(u.email ?? "") === norm(email)
    );
    if (match) authUserId = match.id;
  }

  // 3. Create the auth user if none was found (email_confirm so the password
  //    works immediately — no SMTP dependency).
  if (!authUserId) {
    password = generatePassword();
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
      cache: "no-store",
    });
    if (createRes.ok) {
      authUserId = ((await createRes.json()) as { id: string }).id;
      created = true;
    } else {
      // The broken ?email= filter may have hidden an existing user (it only
      // returns the first page) — scan for them before giving up.
      const scan = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = (scan.data?.users ?? []).find(
        (u: { id: string; email?: string | null }) =>
          norm(u.email ?? "") === norm(email)
      );
      if (found) {
        authUserId = found.id;
        password = undefined;
      } else {
        const txt = await createRes.text();
        return {
          ok: false,
          error: `Failed to create a login for ${email} (HTTP ${createRes.status}): ${txt.slice(0, 160)}`,
        };
      }
    }
  }

  // 4a. Existing login-less person ⇒ link the auth user (no duplicate row).
  if (existingPersonId) {
    const { error: linkErr } = await crossSchema(svc, "yi_directory")
      .from("people")
      .update({ user_id: authUserId, is_active: true })
      .eq("id", existingPersonId);
    if (linkErr) {
      return {
        ok: false,
        error: `Failed to link the login to the existing directory person: ${linkErr.message}`,
      };
    }
    return { ok: true, personId: existingPersonId, created, password };
  }

  // 4b. No directory identity at all ⇒ insert the people row.
  const { data: person, error: pErr } = await crossSchema(svc, "yi_directory")
    .from("people")
    .insert({ user_id: authUserId, email, full_name: fullName, is_active: true })
    .select("id")
    .single();
  if (pErr || !person) {
    return {
      ok: false,
      error: `Failed to create directory person: ${pErr?.message ?? "unknown"}`,
    };
  }
  return { ok: true, personId: String(person.id), created, password };
}

/**
 * Shared chapter-surface gate: the caller must hold canManageAcademy on this
 * academy (own-chapter admin or national). Denies with the access reason so
 * a 403 is diagnosable in one read (project rule).
 */
async function gateChapterSurface(academyId: string): Promise<
  | {
      ok: true;
      access: Awaited<ReturnType<typeof getYuvaAccess>>;
      academy: {
        id: string;
        chapter: string;
        display_name: string;
        coordinator_person_id: string | null;
      };
    }
  | { ok: false; error: string }
> {
  if (!z.string().uuid().safeParse(academyId).success) {
    return { ok: false, error: "Invalid academy id." };
  }
  const svc = await createServiceClient();
  const { data: academy } = await svc
    .from("academies")
    .select("id, chapter, display_name, coordinator_person_id")
    .eq("id", academyId)
    .maybeSingle();
  if (!academy) return { ok: false, error: "Academy not found." };

  const access = await getYuvaAccess();
  if (!access.canManageAcademy({ id: academy.id, chapter: academy.chapter })) {
    return {
      ok: false,
      error: `You can't manage this academy. Your access: ${access.reason}`,
    };
  }
  return { ok: true, access, academy };
}

// ─── assignCoordinator (CHAPTER: find-or-create person + role + invite) ─

export async function assignCoordinator(input: {
  academyId: string;
  fullName: string;
  email: string;
}): Promise<
  ActionResult<{
    personId: string;
    email: string;
    created: boolean;
    /** Generated login password — returned ONCE for out-of-band sharing. */
    password?: string;
  }>
> {
  const email = norm(input.email ?? "");
  const fullName = (input.fullName ?? "").trim();
  if (!isEmail(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (fullName.length < 2) {
    return { success: false, error: "Enter the coordinator's full name." };
  }

  const gate = await gateChapterSurface(input.academyId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { access, academy } = gate;

  // Privilege-escalation guard (lib/yi/auth/role-write-guard.ts): the role
  // minted here is hard-coded to institution_coordinator (below the super
  // tier) on app='yuva'. checkRoleWriteAllowed admits platform/yuva super
  // admins; the OWN-CHAPTER admin is the spec-designated assigner (Director
  // 2026-06-10) and is accepted as the documented delegation below it.
  const isOwnChapterAdmin =
    access.chapterAdminOf !== null && access.chapterAdminOf === academy.chapter;
  if (!isOwnChapterAdmin) {
    const guard = await checkRoleWriteAllowed(
      YUVA_APP,
      ROLE_INSTITUTION_COORDINATOR
    );
    if (!guard.ok) return { success: false, error: guard.error };
  }

  const svc = await createServiceClient();

  const person = await ensureCoordinatorPerson(svc, email, fullName);
  if (!person.ok) return { success: false, error: person.error };

  const previousCoordinatorId = academy.coordinator_person_id;

  // Role row: re-activate an existing matching assignment (idempotent — the
  // role row is created exactly once per person+chapter), else insert.
  const dir = crossSchema(svc, "yi_directory");
  const { data: existingRole } = await dir
    .from("role_assignments")
    .select("id, is_active")
    .eq("app", YUVA_APP)
    .eq("role", ROLE_INSTITUTION_COORDINATOR)
    .eq("yi_chapter", academy.chapter)
    .eq("person_id", person.personId)
    .maybeSingle();

  if (existingRole) {
    if (!existingRole.is_active) {
      const { error } = await dir
        .from("role_assignments")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", existingRole.id);
      if (error) {
        return { success: false, error: `Failed to re-activate the coordinator role: ${error.message}` };
      }
    }
  } else {
    const { error: insErr } = await dir.from("role_assignments").insert({
      person_id: person.personId,
      app: YUVA_APP,
      role: ROLE_INSTITUTION_COORDINATOR,
      yi_chapter: academy.chapter,
      is_active: true,
      title: `Institution Coordinator — ${academy.display_name}`,
    });
    if (insErr) {
      return {
        success: false,
        error: `Failed to grant the coordinator role: ${insErr.message}`,
      };
    }
  }

  // Bind the coordinator on the academy row (the ONLY coordinator→academy
  // source — see lib/yuva/auth/yuva-access.ts).
  const { error: bindErr } = await svc
    .from("academies")
    .update({
      coordinator_person_id: person.personId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academy.id);
  if (bindErr) {
    return {
      success: false,
      error: `Coordinator role granted but binding failed: ${bindErr.message}`,
    };
  }

  // Replacement: retire the previous coordinator's role row if they no longer
  // coordinate ANY academy (role rows are caches of the academy binding).
  if (previousCoordinatorId && previousCoordinatorId !== person.personId) {
    await retireCoordinatorRoleIfUnused(svc, previousCoordinatorId);
  }

  // Invite email — durable queue; dedupe_key makes double-enqueue impossible.
  const rendered = coordinatorInviteEmail({
    coordinatorName: fullName,
    academyName: academy.display_name,
    portalUrl: `${APP_URL}/youth-academy/chapter`,
  });
  await sendYuvaEmail({
    to: email,
    emailType: "coordinator_invite",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    dedupeKey: `coordinator_invite:${academy.id}:${person.personId}`,
    meta: { academy_id: academy.id },
  });

  await logYuvaAudit({
    action: "assign_coordinator",
    entity: "academies",
    entity_id: academy.id,
    chapter: academy.chapter,
    meta: {
      coordinator_person_id: person.personId,
      email,
      login_created: person.created,
      replaced_person_id:
        previousCoordinatorId && previousCoordinatorId !== person.personId
          ? previousCoordinatorId
          : null,
    },
  });
  revalidateAcademyPaths(academy.id);
  return {
    success: true,
    data: {
      personId: person.personId,
      email,
      created: person.created,
      password: person.password,
    },
  };
}

/** Deactivate a person's yuva coordinator role rows when they coordinate no academy. */
async function retireCoordinatorRoleIfUnused(
  svc: Svc,
  personId: string
): Promise<void> {
  const { data: stillBound } = await svc
    .from("academies")
    .select("id")
    .eq("coordinator_person_id", personId)
    .limit(1);
  if (stillBound && stillBound.length > 0) return;
  await crossSchema(svc, "yi_directory")
    .from("role_assignments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("app", YUVA_APP)
    .eq("role", ROLE_INSTITUTION_COORDINATOR)
    .eq("person_id", personId);
}

// ─── removeCoordinator (CHAPTER) ─────────────────────────────────────────

export async function removeCoordinator(input: {
  academyId: string;
}): Promise<ActionResult<{ removedPersonId: string }>> {
  const gate = await gateChapterSurface(input.academyId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { access, academy } = gate;

  if (!academy.coordinator_person_id) {
    return {
      success: false,
      error: "This academy has no coordinator to remove.",
    };
  }

  // Same role-write posture as assignCoordinator (this deactivates a role row).
  const isOwnChapterAdmin =
    access.chapterAdminOf !== null && access.chapterAdminOf === academy.chapter;
  if (!isOwnChapterAdmin) {
    const guard = await checkRoleWriteAllowed(
      YUVA_APP,
      ROLE_INSTITUTION_COORDINATOR
    );
    if (!guard.ok) return { success: false, error: guard.error };
  }

  const svc = await createServiceClient();
  const removedPersonId = academy.coordinator_person_id;

  const { error } = await svc
    .from("academies")
    .update({
      coordinator_person_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academy.id);
  if (error) return { success: false, error: error.message };

  await retireCoordinatorRoleIfUnused(svc, removedPersonId);

  await logYuvaAudit({
    action: "remove_coordinator",
    entity: "academies",
    entity_id: academy.id,
    chapter: academy.chapter,
    meta: { coordinator_person_id: removedPersonId },
  });
  revalidateAcademyPaths(academy.id);
  return { success: true, data: { removedPersonId } };
}

// ─── updateQualitativeNotes (CHAPTER + national — quarterly CSV source) ──

export async function updateQualitativeNotes(input: {
  academyId: string;
  notes: string;
}): Promise<ActionResult<{ id: string }>> {
  const notes = (input.notes ?? "").trim();
  if (notes.length > 10_000) {
    return {
      success: false,
      error: "Qualitative outcomes must be under 10,000 characters.",
    };
  }

  const gate = await gateChapterSurface(input.academyId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { academy } = gate;

  const svc = await createServiceClient();
  const { error } = await svc
    .from("academies")
    .update({
      qualitative_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academy.id);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "update_notes",
    entity: "academies",
    entity_id: academy.id,
    chapter: academy.chapter,
    meta: { notes_length: notes.length },
  });
  revalidateAcademyPaths(academy.id);
  return { success: true, data: { id: academy.id } };
}
