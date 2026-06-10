"use server";

/**
 * Yi Youth Academy — Mentor YUVA Network actions (Phase 6).
 *
 * Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory →
 * `actions/mentors.ts`: inviteMentor / deactivateMentor / updateMentorProfile.
 *
 * Contract (every function): gate-first via getYuvaAccess() → service-client
 * write → logYuvaAudit → revalidatePath → ActionResult. Expected failures
 * return { success:false, error } — NEVER a throw, NEVER a silent redirect.
 *
 * Identity (CLAUDE.md canonical rule): mentors live in yi_directory.people +
 * yi_directory.role_assignments (app='yuva', role='mentor', yi_chapter set).
 * NO yuva-side role table exists; yuva.mentor_profiles is app-specific
 * PROFILE data over the directory identity, not a role source.
 *
 * Role-write-guard invariant (lib/yi/auth/role-write-guard.ts): this file
 * writes EXACTLY ONE role string — the ROLE_MENTOR constant, an operational
 * role far below the super tier. The role is never caller-supplied, so a
 * chapter admin can never escalate anyone (including themselves) past
 * 'mentor' through this surface. Mentors can be ANYONE — no Yi membership,
 * no national vetting (Piyush, 2026-06-10); a multi-chapter mentor is a
 * second role row, which is allowed.
 *
 * Login provisioning (donor: app/yip/actions/chapter-roles.ts ensurePerson +
 * app/admin/directory/actions/directory-mutations.ts invitePersonAndAssignRole):
 * role-HOLDERS sign in, so the invite ensures an auth.users row exists and
 * binds yi_directory.people.user_id to it. When the mentor later uses
 * "Sign in with Google" with the same email, Supabase links the Google
 * identity to that auth user, and the getCurrentPersonRoles() funnel
 * (auth.users.id → people.user_id) resolves them. Without this binding a
 * Google sign-in would mint a NEW auth user that no people row points at.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { mentorInviteEmail } from "@/lib/yuva/email-templates";
import { uploadBase64 } from "@/lib/yuva/storage";
import { YUVA_APP, ROLE_MENTOR } from "@/lib/yuva/constants";
import { createServiceClient as createYuvaService } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path the donor (chapter-roles.ts) uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import { resolvePerson, linkPersonToUser } from "@/lib/yi/directory/resolve-person";

// Centralized app URL (do NOT invent a new env var — lib/yi-future/constants.ts).
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";

const norm = (s: string) => s.trim().toLowerCase();

// ─── Schemas (module-local; "use server" files may not export non-async) ───

const inviteSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the mentor's full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(20).optional(),
  /** Only honored for national callers; chapter admins always invite into
   *  their own chapter (fail-closed scope). */
  chapter: z.string().trim().min(1).optional(),
});

const profileSchema = z.object({
  personId: z.string().uuid("Invalid mentor id."),
  bio: z.string().trim().max(2000, "Bio must be under 2000 characters.").optional(),
  expertise: z
    .array(z.string().trim().min(1).max(60))
    .max(12, "At most 12 expertise tags.")
    .default([]),
  organization: z.string().trim().max(160).optional(),
  isPublic: z.boolean(),
  /** Optional photo upload (base64, ≤ ~2 MB decoded). */
  photoBase64: z.string().max(3_000_000, "Photo too large (max ~2 MB).").optional(),
  photoContentType: z
    .enum(["image/jpeg", "image/png", "image/webp"])
    .optional(),
});

// ─── Login provisioning for the invited mentor (role-holder) ──────────────

/**
 * Ensure the person can sign in: provision auth.users if needed and bind
 * people.user_id. Follows directory-mutations.ts: inviteUserByEmail first
 * (sends Supabase's magic-link invite when SMTP is configured), then probe
 * listUsers (the admin `?email=` filter is broken — manual match), then
 * createUser as last resort.
 */
async function ensureMentorLogin(
  personId: string,
  email: string,
  fullName: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const dir = await createDirService();

  const { data: person } = await dir
    .schema("yi_directory")
    .from("people")
    .select("id, user_id")
    .eq("id", personId)
    .maybeSingle();

  if (person?.user_id) return { ok: true, userId: person.user_id };

  let userId: string | null = null;

  // 1. Invite (creates the auth user + sends the Supabase invite email).
  try {
    const { data, error } = await dir.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (!error && data?.user?.id) userId = data.user.id;
  } catch {
    // fall through
  }

  // 2. The auth user may already exist (invite fails on duplicates). Probe.
  if (!userId) {
    try {
      const list = await dir.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = (list.data?.users ?? []).find(
        (u: { email?: string | null }) => norm(u.email ?? "") === norm(email)
      );
      if (found?.id) userId = found.id;
    } catch {
      // ignore — try createUser next
    }
  }

  // 3. Last resort: create directly (no email goes out; our own invite email
  //    below still points them at the portal where Google sign-in links up).
  if (!userId) {
    try {
      const { data, error } = await dir.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      });
      if (error) {
        return { ok: false, error: `Failed to create login: ${error.message}` };
      }
      userId = data.user?.id ?? null;
    } catch (e) {
      return { ok: false, error: `Failed to create login: ${String(e)}` };
    }
  }

  if (!userId) {
    return { ok: false, error: "Failed to provision login (no user id returned)." };
  }

  try {
    await linkPersonToUser(personId, userId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to link login to directory.",
    };
  }
  return { ok: true, userId };
}

// ─── inviteMentor ──────────────────────────────────────────────────────────

/**
 * Invite a mentor into a chapter's Mentor YUVA Network.
 * Gate: chapter admin (their own chapter) or national (must pick a chapter).
 * Coordinators explicitly CANNOT invite (spec: mentor network is chapter-owned).
 */
export async function inviteMentor(rawInput: {
  fullName: string;
  email: string;
  phone?: string;
  chapter?: string;
}): Promise<
  ActionResult<{ personId: string; alreadyMentor: boolean }>
> {
  const parsed = inviteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;

  // Gate FIRST. Chapter admins are pinned to their own chapter; national may
  // target any chapter but must name it. Everyone else: explicit deny.
  const access = await getYuvaAccess();
  let chapter: string | null = null;
  if (access.chapterAdminOf) {
    chapter = access.chapterAdminOf;
  } else if (access.isNational) {
    chapter = input.chapter ?? null;
    if (!chapter) {
      return {
        success: false,
        error: "Pick the chapter this mentor joins (national accounts must specify one).",
      };
    }
  } else {
    return {
      success: false,
      error: `Only a chapter admin or the national team can invite mentors. (${access.reason})`,
    };
  }

  // Identity: the ONE shared find-or-create primitive (no per-app copies).
  let personId: string;
  try {
    personId = await resolvePerson({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to resolve the mentor's identity.",
    };
  }

  // Login: mentors are role-holders → they need a bindable auth user so
  // "Sign in with Google" resolves through the funnel.
  const login = await ensureMentorLogin(personId, input.email, input.fullName);
  if (!login.ok) return { success: false, error: login.error };

  // Empty app-side profile stub (mentor fills it in from /youth-academy/mentor/profile).
  const yuva = await createYuvaService();
  const { error: profileErr } = await yuva
    .from("mentor_profiles")
    .upsert({ person_id: personId }, { onConflict: "person_id", ignoreDuplicates: true });
  if (profileErr) {
    return { success: false, error: `Failed to create mentor profile: ${profileErr.message}` };
  }

  // Role row — ROLE_MENTOR constant only (see role-write-guard note above).
  // Existing active row for this chapter ⇒ idempotent success; inactive ⇒
  // reactivate; a row in ANOTHER chapter is untouched (multi-chapter mentor).
  const dir = await createDirService();
  const { data: existingRole } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, is_active")
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR)
    .eq("yi_chapter", chapter)
    .eq("person_id", personId)
    .maybeSingle();

  let alreadyMentor = false;
  if (existingRole?.is_active) {
    alreadyMentor = true;
  } else if (existingRole) {
    const { error } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .update({ is_active: true })
      .eq("id", existingRole.id);
    if (error) {
      return { success: false, error: `Failed to reactivate mentor role: ${error.message}` };
    }
  } else {
    const { error } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .insert({
        person_id: personId,
        app: YUVA_APP,
        role: ROLE_MENTOR,
        yi_chapter: chapter,
        is_active: true,
        title: `Mentor — ${chapter}`,
      });
    if (error) {
      return { success: false, error: `Failed to grant mentor role: ${error.message}` };
    }
  }

  // Invite email (durable queue; dedupe makes a double-click harmless).
  if (!alreadyMentor) {
    const rendered = mentorInviteEmail({
      mentorName: input.fullName,
      chapter,
      portalUrl: `${APP_URL}/youth-academy/mentor`,
    });
    await sendYuvaEmail({
      to: input.email,
      emailType: "mentor_invite",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      dedupeKey: `mentor_invite:${chapter}:${personId}`,
      meta: { person_id: personId, chapter },
    });
  }

  await logYuvaAudit({
    action: "invite",
    entity: "mentors",
    entity_id: personId,
    chapter,
    meta: {
      email: input.email,
      full_name: input.fullName,
      already_mentor: alreadyMentor,
      user_id: login.userId,
    },
  });

  revalidatePath("/youth-academy/chapter/mentors");
  revalidatePath("/youth-academy/mentors");

  return {
    success: true,
    data: { personId, alreadyMentor },
    ...(alreadyMentor
      ? { warning: `${input.fullName} is already in this chapter's Mentor YUVA Network.` }
      : {}),
  };
}

// ─── deactivateMentor ──────────────────────────────────────────────────────

/**
 * Deactivate a mentor's role row (one chapter). The mentor disappears from
 * the chapter roster and the public network page. If they have FUTURE
 * assigned sessions in this chapter, the deactivation still proceeds but the
 * result carries a WARNING listing the sessions that need reassignment
 * (spec edge case — warn, don't block).
 */
export async function deactivateMentor(rawInput: {
  assignmentId: string;
}): Promise<ActionResult<{ futureSessionCount: number }>> {
  const assignmentId = rawInput.assignmentId?.trim();
  if (!assignmentId) return { success: false, error: "Missing mentor assignment id." };

  const access = await getYuvaAccess();
  if (!access.isNational && !access.chapterAdminOf) {
    return {
      success: false,
      error: `Only a chapter admin or the national team can deactivate mentors. (${access.reason})`,
    };
  }

  const dir = await createDirService();
  const { data: row } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, yi_chapter, is_active, app, role")
    .eq("id", assignmentId)
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Mentor role not found (it may already be removed)." };
  }

  // Chapter scope — fail CLOSED: a role row with NULL yi_chapter can only be
  // touched by national (a chapter admin has no claim over an unscoped row).
  const rowChapter = (row.yi_chapter ?? "").trim() || null;
  if (!access.isNational) {
    if (!rowChapter || rowChapter !== access.chapterAdminOf) {
      return {
        success: false,
        error: "This mentor belongs to a different chapter's network.",
      };
    }
  }

  // Future assigned sessions in THIS chapter's runs (warning payload).
  const yuva = await createYuvaService();
  let sessionsQuery = yuva
    .from("run_sessions")
    .select("id, name, scheduled_at, runs!inner(chapter)")
    .eq("mentor_person_id", row.person_id)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString());
  if (rowChapter) {
    sessionsQuery = sessionsQuery.eq("runs.chapter", rowChapter);
  }
  const { data: futureSessions } = await sessionsQuery;
  const future = futureSessions ?? [];

  const { error: updErr } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .update({ is_active: false })
    .eq("id", assignmentId)
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR);
  if (updErr) {
    return { success: false, error: `Failed to deactivate mentor: ${updErr.message}` };
  }

  await logYuvaAudit({
    action: "deactivate",
    entity: "mentors",
    entity_id: row.person_id,
    chapter: rowChapter,
    meta: {
      assignment_id: assignmentId,
      future_sessions: future.map((s) => ({
        id: s.id,
        name: s.name,
        scheduled_at: s.scheduled_at,
      })),
    },
  });

  revalidatePath("/youth-academy/chapter/mentors");
  revalidatePath("/youth-academy/mentors");

  const warning =
    future.length > 0
      ? `${future.length} upcoming session${future.length === 1 ? "" : "s"} need${
          future.length === 1 ? "s" : ""
        } a new mentor: ${future
          .map(
            (s) =>
              `${s.name}${
                s.scheduled_at
                  ? ` (${new Date(s.scheduled_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })})`
                  : ""
              }`
          )
          .join(", ")}`
      : undefined;

  return {
    success: true,
    data: { futureSessionCount: future.length },
    ...(warning ? { warning } : {}),
  };
}

// ─── updateMentorProfile ───────────────────────────────────────────────────

/**
 * Update a mentor's public profile (bio, expertise tags, organization,
 * is_public, photo → public bucket `yuva-public` at mentors/{personId}/photo.jpg).
 *
 * Gate: the mentor THEMSELVES (funnel personId must match AND they hold the
 * mentor role) OR a manager (national anywhere; chapter admin when the target
 * holds an active mentor role in their chapter). Another mentor's write is
 * rejected (spec Phase 6 done-when).
 */
export async function updateMentorProfile(rawInput: {
  personId: string;
  bio?: string;
  expertise: string[];
  organization?: string;
  isPublic: boolean;
  photoBase64?: string;
  photoContentType?: "image/jpeg" | "image/png" | "image/webp";
}): Promise<ActionResult<{ photoPath: string | null }>> {
  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;
  if (input.photoBase64 && !input.photoContentType) {
    return { success: false, error: "Photo upload is missing its content type." };
  }

  const access = await getYuvaAccess();
  const isSelf = access.isMentor && access.personId === input.personId;

  let authorized = isSelf || access.isNational;
  let auditChapter: string | null = access.chapterAdminOf;

  if (!authorized && access.chapterAdminOf) {
    // Chapter manager path: target must be an ACTIVE mentor of THEIR chapter.
    const dir = await createDirService();
    const { data: roleRow } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .select("id")
      .eq("app", YUVA_APP)
      .eq("role", ROLE_MENTOR)
      .eq("person_id", input.personId)
      .eq("yi_chapter", access.chapterAdminOf)
      .eq("is_active", true)
      .maybeSingle();
    authorized = !!roleRow;
  }

  if (!authorized) {
    return {
      success: false,
      error: isSelf
        ? "You can only edit your own mentor profile."
        : `You can only edit your own mentor profile, or mentors of your chapter. (${access.reason})`,
    };
  }

  // Managers may only edit people who actually ARE mentors somewhere; the
  // chapter path above already proved it. For national, verify cheaply so a
  // profile row is never minted for an arbitrary person.
  if (!isSelf && access.isNational) {
    const dir = await createDirService();
    const { data: anyMentorRole } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .select("id, yi_chapter")
      .eq("app", YUVA_APP)
      .eq("role", ROLE_MENTOR)
      .eq("person_id", input.personId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!anyMentorRole) {
      return { success: false, error: "This person is not an active mentor." };
    }
    auditChapter = anyMentorRole.yi_chapter ?? null;
  }

  // Photo → public bucket (public pages render it without signed-URL minting).
  let photoPath: string | null = null;
  if (input.photoBase64 && input.photoContentType) {
    const upload = await uploadBase64(
      "yuva-public",
      `mentors/${input.personId}/photo.jpg`,
      input.photoBase64,
      input.photoContentType
    );
    if (!upload.ok) {
      return { success: false, error: `Photo upload failed: ${upload.error}` };
    }
    photoPath = upload.path;
  }

  const expertise = Array.from(
    new Set(input.expertise.map((t) => t.trim()).filter(Boolean))
  );

  const yuva = await createYuvaService();
  const { error: upsertErr } = await yuva.from("mentor_profiles").upsert(
    {
      person_id: input.personId,
      bio: input.bio?.trim() || null,
      expertise,
      organization: input.organization?.trim() || null,
      is_public: input.isPublic,
      ...(photoPath ? { photo_storage_path: photoPath } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "person_id" }
  );
  if (upsertErr) {
    return { success: false, error: `Failed to save profile: ${upsertErr.message}` };
  }

  await logYuvaAudit({
    action: "update",
    entity: "mentor_profiles",
    entity_id: input.personId,
    chapter: isSelf ? null : auditChapter,
    meta: {
      self_edit: isSelf,
      is_public: input.isPublic,
      photo_updated: !!photoPath,
      expertise_count: expertise.length,
    },
  });

  revalidatePath("/youth-academy/mentors");
  revalidatePath("/youth-academy/mentor");
  revalidatePath("/youth-academy/mentor/profile");
  revalidatePath("/youth-academy/chapter/mentors");

  return { success: true, data: { photoPath } };
}
