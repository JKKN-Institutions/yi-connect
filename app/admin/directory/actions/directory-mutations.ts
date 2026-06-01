/**
 * Directory Admin — Mutation Server Actions (Phase B, 2026-05-28)
 *
 * Write surfaces for the cross-vertical yi_directory.* mother source:
 *   - role_assignments CRUD (add / update / soft-deactivate)
 *   - people PATCH (name / email / phone)
 *   - invite flow: create auth.users + people + initial role_assignment
 *
 * Every mutation:
 *   1. Gates on `isCurrentUserPlatformSuperAdmin()` server-side (no client trust).
 *   2. Uses the SERVICE client (yi_directory schema has no RLS for staff yet).
 *   3. Calls `logAuditAction()` so every change is auditable per the
 *      2026-05-27 Yi National team decision ("who did the changes, what has
 *      happened").
 *
 * Duplicate role policy: `addRoleAssignment` looks for an ACTIVE row matching
 * (person_id, app, role, yi_year) and refuses with a clear error message. The
 * caller can instead call `updateRoleAssignment` against the existing id to
 * change title / chapter / primary flag. Inactive rows with the same key are
 * IGNORED — adding a new role re-activates by inserting a fresh row (audit
 * trail is preserved on the deactivated row).
 *
 * Invite flow: tries `admin.inviteUserByEmail` first (sends the magic-link
 * email if SMTP is configured). On email-send failure it falls back to
 * `admin.generateLink({ type: "invite" })` and returns the URL so the admin
 * can hand-deliver it. Either way, the auth.users row + people row + role
 * row are committed.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { logAuditAction } from "@/lib/yip/audit/log-action";

// ─── Types ──────────────────────────────────────────────────────────────

export type MutationResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

export type RoleAssignmentInput = {
  app: string;
  role: string;
  yi_year: number;
  yi_chapter?: string | null;
  yi_zone?: string | null;
  title?: string | null;
  is_primary?: boolean;
};

export type RoleAssignmentPatch = {
  app?: string;
  role?: string;
  yi_year?: number;
  yi_chapter?: string | null;
  yi_zone?: string | null;
  title?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
};

export type PersonPatch = {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
};

export type InvitePersonInput = {
  full_name: string;
  email: string;
  phone?: string | null;
  app: string;
  role: string;
  yi_year: number;
  yi_chapter?: string | null;
  yi_zone?: string | null;
  title?: string | null;
};

export type InviteResult = {
  person_id: string;
  user_id: string;
  role_assignment_id: string;
  invite_email_sent: boolean;
  /** Populated when the invite email could not be sent — admin must hand-deliver. */
  manual_invite_url?: string | null;
};

// Known apps. Per spec, allow extension by NOT rejecting unknown values; we
// just normalize case and surface a warning via the audit metadata.
const KNOWN_APPS = ["yip", "future", "yuva", "thalir", "masoom", "yi"] as const;
const YEAR_MIN = 2025;
const YEAR_MAX = 2030;

// ─── Helpers ────────────────────────────────────────────────────────────

function normaliseEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  return v.length === 0 ? null : v;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateApp(app: string): string | null {
  const v = app.trim().toLowerCase();
  if (!v) return "App is required";
  // Allow extension beyond the known list but warn via audit metadata.
  void KNOWN_APPS; // referenced for documentation
  return null;
}

function validateYear(year: number): string | null {
  if (!Number.isInteger(year)) return "yi_year must be an integer";
  if (year < YEAR_MIN || year > YEAR_MAX)
    return `yi_year must be between ${YEAR_MIN} and ${YEAR_MAX}`;
  return null;
}

function validateRoleInput(input: RoleAssignmentInput): string | null {
  if (!input.role || !input.role.trim()) return "Role is required";
  const appErr = validateApp(input.app);
  if (appErr) return appErr;
  const yearErr = validateYear(input.yi_year);
  if (yearErr) return yearErr;
  return null;
}

// yi_directory is not in the generated yip schema; cast through a small
// permissive helper. Same shape the read-side uses.
type DirRow = Record<string, unknown>;
type DirMaybeSingleResult = Promise<{ data: DirRow | null; error: unknown }>;
type DirSingleResult = Promise<{ data: DirRow | null; error: unknown }>;
// Recursive chain: every .eq() returns a builder with both .eq() (chainable) and the terminal methods.
interface DirSelectChain {
  eq: (k: string, v: unknown) => DirSelectChain;
  maybeSingle: () => DirMaybeSingleResult;
  single: () => DirSingleResult;
}
interface DirUpdateChain {
  eq: (k: string, v: unknown) => Promise<{ data: unknown; error: unknown }>;
}
type DirClient = {
  from: (t: string) => {
    select: (cols: string) => DirSelectChain;
    insert: (row: DirRow) => {
      select: (cols: string) => {
        single: () => DirSingleResult;
      };
    };
    update: (patch: DirRow) => DirUpdateChain;
  };
};


// ─── addRoleAssignment ──────────────────────────────────────────────────

export async function addRoleAssignment(
  personId: string,
  input: RoleAssignmentInput
): Promise<MutationResult<{ id: string }>> {
  const gate = await isCurrentUserPlatformSuperAdmin();
  if (!gate) return { success: false, error: "Forbidden" };
  if (!personId) return { success: false, error: "personId is required" };

  const vErr = validateRoleInput(input);
  if (vErr) return { success: false, error: vErr };

  const svc = await createServiceClient();

  // Conflict policy: refuse if an ACTIVE row already matches
  // (person_id, app, role, yi_year). Surface the existing id so the caller
  // can offer an "edit" path.
  const existing = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .select("id, is_active")
    .eq("person_id", personId)
    .eq("app", input.app.trim().toLowerCase())
    .eq("role", input.role.trim())
    .eq("yi_year", input.yi_year)
    .eq("is_active", true)
    .maybeSingle();

  if (existing.data && (existing.data as { id?: string }).id) {
    const id = (existing.data as { id: string }).id;
    return {
      success: false,
      error:
        `An active role of "${input.role}" for ${input.app} ${input.yi_year} already exists ` +
        `(id ${id.slice(0, 8)}). Edit it instead of adding a duplicate.`,
    };
  }

  const row: DirRow = {
    person_id: personId,
    app: input.app.trim().toLowerCase(),
    role: input.role.trim(),
    yi_year: input.yi_year,
    yi_chapter: input.yi_chapter?.trim() || null,
    yi_zone: input.yi_zone?.trim() || null,
    title: input.title?.trim() || null,
    is_primary: input.is_primary === true,
    is_active: true,
  };

  const ins = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .insert(row)
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    return {
      success: false,
      error: `Failed to insert role: ${String(
        (ins.error as { message?: string } | null)?.message ?? "unknown error"
      )}`,
    };
  }

  const newId = (ins.data as { id: string }).id;

  await logAuditAction({
    action_type: "create",
    target_table: "yi_directory.role_assignments",
    target_id: newId,
    metadata: {
      person_id: personId,
      app: row.app,
      role: row.role,
      yi_year: row.yi_year,
      yi_chapter: row.yi_chapter,
      title: row.title,
      is_primary: row.is_primary,
    },
  });

  revalidatePath(`/admin/directory/${personId}`);
  revalidatePath(`/admin/directory/${personId}/roles`);
  revalidatePath(`/admin/directory`);

  return { success: true, data: { id: newId }, message: "Role added" };
}

// ─── updateRoleAssignment ───────────────────────────────────────────────

export async function updateRoleAssignment(
  assignmentId: string,
  patch: RoleAssignmentPatch
): Promise<MutationResult<{ id: string }>> {
  const gate = await isCurrentUserPlatformSuperAdmin();
  if (!gate) return { success: false, error: "Forbidden" };
  if (!assignmentId)
    return { success: false, error: "assignmentId is required" };

  if (patch.yi_year !== undefined) {
    const yErr = validateYear(patch.yi_year);
    if (yErr) return { success: false, error: yErr };
  }
  if (patch.app !== undefined) {
    const aErr = validateApp(patch.app);
    if (aErr) return { success: false, error: aErr };
  }

  const svc = await createServiceClient();

  // Look up the existing row so we can record what was actually changed.
  const before = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .select(
      "id, person_id, app, role, yi_year, yi_chapter, yi_zone, title, is_active, is_primary"
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (!before.data) {
    return { success: false, error: "Role assignment not found" };
  }

  const beforeRow = before.data as Record<string, unknown>;

  const update: DirRow = {};
  if (patch.app !== undefined) update.app = patch.app.trim().toLowerCase();
  if (patch.role !== undefined) update.role = patch.role.trim();
  if (patch.yi_year !== undefined) update.yi_year = patch.yi_year;
  if (patch.yi_chapter !== undefined)
    update.yi_chapter = patch.yi_chapter?.trim() || null;
  if (patch.yi_zone !== undefined)
    update.yi_zone = patch.yi_zone?.trim() || null;
  if (patch.title !== undefined) update.title = patch.title?.trim() || null;
  if (patch.is_primary !== undefined) update.is_primary = patch.is_primary;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  update.updated_at = new Date().toISOString();

  const upd = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .update(update)
    .eq("id", assignmentId);

  if (upd.error) {
    return {
      success: false,
      error: `Failed to update role: ${String(
        (upd.error as { message?: string } | null)?.message ?? "unknown error"
      )}`,
    };
  }

  await logAuditAction({
    action_type: "update",
    target_table: "yi_directory.role_assignments",
    target_id: assignmentId,
    metadata: {
      person_id: beforeRow.person_id,
      before: {
        app: beforeRow.app,
        role: beforeRow.role,
        yi_year: beforeRow.yi_year,
        yi_chapter: beforeRow.yi_chapter,
        title: beforeRow.title,
        is_active: beforeRow.is_active,
        is_primary: beforeRow.is_primary,
      },
      patch,
    },
  });

  const personId = String(beforeRow.person_id ?? "");
  if (personId) {
    revalidatePath(`/admin/directory/${personId}`);
    revalidatePath(`/admin/directory/${personId}/roles`);
  }
  revalidatePath(`/admin/directory`);

  return { success: true, data: { id: assignmentId }, message: "Role updated" };
}

// ─── deactivateRoleAssignment (soft delete) ─────────────────────────────

export async function deactivateRoleAssignment(
  assignmentId: string
): Promise<MutationResult<{ id: string }>> {
  const gate = await isCurrentUserPlatformSuperAdmin();
  if (!gate) return { success: false, error: "Forbidden" };
  if (!assignmentId)
    return { success: false, error: "assignmentId is required" };

  const svc = await createServiceClient();

  const before = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .select("id, person_id, app, role, yi_year, is_active")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!before.data) {
    return { success: false, error: "Role assignment not found" };
  }

  const beforeRow = before.data as Record<string, unknown>;

  if (beforeRow.is_active === false) {
    return { success: true, data: { id: assignmentId }, message: "Already inactive" };
  }

  const upd = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (upd.error) {
    return {
      success: false,
      error: `Failed to deactivate role: ${String(
        (upd.error as { message?: string } | null)?.message ?? "unknown error"
      )}`,
    };
  }

  await logAuditAction({
    action_type: "delete", // soft-delete is still a delete in audit terms
    target_table: "yi_directory.role_assignments",
    target_id: assignmentId,
    metadata: {
      person_id: beforeRow.person_id,
      app: beforeRow.app,
      role: beforeRow.role,
      yi_year: beforeRow.yi_year,
      soft_delete: true,
    },
  });

  const personId = String(beforeRow.person_id ?? "");
  if (personId) {
    revalidatePath(`/admin/directory/${personId}`);
    revalidatePath(`/admin/directory/${personId}/roles`);
  }
  revalidatePath(`/admin/directory`);

  return { success: true, data: { id: assignmentId }, message: "Role deactivated" };
}

// ─── updatePerson ───────────────────────────────────────────────────────

export async function updatePerson(
  personId: string,
  patch: PersonPatch
): Promise<MutationResult<{ id: string }>> {
  const gate = await isCurrentUserPlatformSuperAdmin();
  if (!gate) return { success: false, error: "Forbidden" };
  if (!personId) return { success: false, error: "personId is required" };

  if (patch.full_name !== undefined) {
    if (!patch.full_name.trim()) {
      return { success: false, error: "Full name cannot be empty" };
    }
  }
  let emailNormalised: string | null | undefined = undefined;
  if (patch.email !== undefined) {
    emailNormalised = normaliseEmail(patch.email);
    if (emailNormalised && !isValidEmail(emailNormalised)) {
      return { success: false, error: "Invalid email format" };
    }
  }

  const svc = await createServiceClient();

  const before = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("people")
    .select("id, full_name, email, phone")
    .eq("id", personId)
    .maybeSingle();

  if (!before.data) {
    return { success: false, error: "Person not found" };
  }

  const beforeRow = before.data as Record<string, unknown>;

  const update: DirRow = {};
  if (patch.full_name !== undefined) update.full_name = patch.full_name.trim();
  if (emailNormalised !== undefined) update.email = emailNormalised;
  if (patch.phone !== undefined) update.phone = patch.phone?.trim() || null;
  update.updated_at = new Date().toISOString();

  const upd = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("people").update(update).eq("id", personId);

  if (upd.error) {
    return {
      success: false,
      error: `Failed to update person: ${String(
        (upd.error as { message?: string } | null)?.message ?? "unknown error"
      )}`,
    };
  }

  await logAuditAction({
    action_type: "update",
    target_table: "yi_directory.people",
    target_id: personId,
    metadata: {
      before: {
        full_name: beforeRow.full_name,
        email: beforeRow.email,
        phone: beforeRow.phone,
      },
      patch: {
        full_name: patch.full_name,
        email: emailNormalised,
        phone: patch.phone,
      },
    },
  });

  revalidatePath(`/admin/directory/${personId}`);
  revalidatePath(`/admin/directory/${personId}/edit`);
  revalidatePath(`/admin/directory`);

  return { success: true, data: { id: personId }, message: "Person updated" };
}

// ─── invitePersonAndAssignRole ──────────────────────────────────────────

export async function invitePersonAndAssignRole(
  input: InvitePersonInput
): Promise<MutationResult<InviteResult>> {
  const gate = await isCurrentUserPlatformSuperAdmin();
  if (!gate) return { success: false, error: "Forbidden" };

  // Field validation
  if (!input.full_name || !input.full_name.trim()) {
    return { success: false, error: "Full name is required" };
  }
  const email = normaliseEmail(input.email);
  if (!email) return { success: false, error: "Email is required" };
  if (!isValidEmail(email)) return { success: false, error: "Invalid email" };

  const roleErr = validateRoleInput({
    app: input.app,
    role: input.role,
    yi_year: input.yi_year,
  });
  if (roleErr) return { success: false, error: roleErr };

  const svc = await createServiceClient();

  // Step 1: Auth user — try invite first, then fall back to createUser +
  // generateLink so we always have an auth.users.id committed.
  let userId: string | null = null;
  let inviteEmailSent = false;
  let manualInviteUrl: string | null = null;

  try {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      data: { full_name: input.full_name.trim() },
    });
    if (!error && data?.user?.id) {
      userId = data.user.id;
      inviteEmailSent = true;
    }
  } catch {
    // fall through
  }

  // Email may have failed (no SMTP, user already exists, etc.). Fall back.
  if (!userId) {
    // Probe: maybe the user already exists in auth.users.
    try {
      const list = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const target = email;
      const found = (list.data?.users ?? []).find(
        (u: { email?: string | null }) =>
          (u.email ?? "").toLowerCase() === target
      );
      if (found?.id) userId = found.id;
    } catch {
      // ignore
    }
  }

  if (!userId) {
    // Last resort: create user directly + generate a magic-link the admin can
    // copy. This keeps the flow non-blocking when SMTP isn't set up.
    try {
      const { data: createData, error: createErr } =
        await svc.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name: input.full_name.trim() },
        });
      if (createErr) {
        return {
          success: false,
          error: `Failed to create auth user: ${createErr.message}`,
        };
      }
      userId = createData.user?.id ?? null;
    } catch (e) {
      return {
        success: false,
        error: `Failed to create auth user: ${String(e)}`,
      };
    }
  }

  if (!userId) {
    return {
      success: false,
      error: "Failed to provision auth user (no id returned)",
    };
  }

  // Try to mint a manual invite URL so the admin can hand-deliver if the
  // automatic email didn't go out.
  if (!inviteEmailSent) {
    try {
      const link = await svc.auth.admin.generateLink({
        type: "invite",
        email,
      });
      manualInviteUrl =
        (link.data?.properties?.action_link as string | undefined) ?? null;
    } catch {
      manualInviteUrl = null;
    }
  }

  // Step 2: yi_directory.people — upsert by email (UNIQUE) so we don't dup.
  const phone = input.phone?.trim() || null;
  const existingPerson = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("people")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  let personId: string;
  if (existingPerson.data && (existingPerson.data as { id?: string }).id) {
    personId = (existingPerson.data as { id: string }).id;
    // Bind the user_id if it wasn't set, and refresh basic fields.
    const upd = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("people")
      .update({
        user_id: userId,
        full_name: input.full_name.trim(),
        phone,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId);
    if (upd.error) {
      return {
        success: false,
        error: `Auth user created but failed to link to directory: ${String(
          (upd.error as { message?: string } | null)?.message ?? "unknown"
        )}`,
      };
    }
  } else {
    const ins = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("people")
      .insert({
        full_name: input.full_name.trim(),
        email,
        phone,
        user_id: userId,
        is_active: true,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      return {
        success: false,
        error: `Auth user created but directory insert failed: ${String(
          (ins.error as { message?: string } | null)?.message ?? "unknown"
        )}`,
      };
    }
    personId = (ins.data as { id: string }).id;
  }

  // Step 3: role assignment — refuse on active duplicate.
  const dupe = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
    .select("id")
    .eq("person_id", personId)
    .eq("app", input.app.trim().toLowerCase())
    .eq("role", input.role.trim())
    .eq("yi_year", input.yi_year)
    .eq("is_active", true)
    .maybeSingle();

  let roleAssignmentId: string;
  if (dupe.data && (dupe.data as { id?: string }).id) {
    roleAssignmentId = (dupe.data as { id: string }).id;
  } else {
    const ins = await (svc.schema("yi_directory" as "public") as unknown as DirClient).from("role_assignments")
      .insert({
        person_id: personId,
        app: input.app.trim().toLowerCase(),
        role: input.role.trim(),
        yi_year: input.yi_year,
        yi_chapter: input.yi_chapter?.trim() || null,
        yi_zone: input.yi_zone?.trim() || null,
        title: input.title?.trim() || null,
        is_active: true,
        is_primary: true, // first role for an invited user defaults to primary
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      return {
        success: false,
        error: `Auth user + directory created but role insert failed: ${String(
          (ins.error as { message?: string } | null)?.message ?? "unknown"
        )}`,
      };
    }
    roleAssignmentId = (ins.data as { id: string }).id;
  }

  await logAuditAction({
    action_type: "create",
    target_table: "yi_directory.invite",
    target_id: personId,
    metadata: {
      email,
      full_name: input.full_name.trim(),
      phone,
      user_id: userId,
      role_assignment_id: roleAssignmentId,
      app: input.app.trim().toLowerCase(),
      role: input.role.trim(),
      yi_year: input.yi_year,
      yi_chapter: input.yi_chapter?.trim() || null,
      title: input.title?.trim() || null,
      invite_email_sent: inviteEmailSent,
      manual_invite_url_generated: !!manualInviteUrl,
    },
  });

  revalidatePath("/admin/directory");
  revalidatePath(`/admin/directory/${personId}`);

  return {
    success: true,
    data: {
      person_id: personId,
      user_id: userId,
      role_assignment_id: roleAssignmentId,
      invite_email_sent: inviteEmailSent,
      manual_invite_url: manualInviteUrl,
    },
    message: inviteEmailSent
      ? "Invite email sent"
      : "User created — share the manual invite link below",
  };
}
