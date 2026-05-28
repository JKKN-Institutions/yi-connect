/**
 * Super-Admin Bridge → Coordinator Portal
 *
 * GET /coordinator/admin-enter
 *
 * One-shot bridge that lets a platform super-admin (per
 * yi_directory.role_assignments) enter the Coordinator portal without
 * knowing the legacy coordinator password.
 *
 * Flow:
 *   1. Verify current Supabase session is a platform super-admin
 *      (isPlatformSuperAdmin() reads yi_directory.role_assignments).
 *   2. Look up — or insert if missing — a synthetic "Super Admin"
 *      row in yi_connect.stakeholder_coordinators, keyed by the
 *      super-admin's auth.users.id.
 *   3. Set the coordinator_id + coordinator_email cookies the existing
 *      coordinator layout expects, scoped to /coordinator.
 *   4. Redirect to /coordinator.
 *
 * Created 2026-05-28 as part of the YIP super-admin cross-portal bridge.
 * Does NOT change the regular coordinator login flow.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isPlatformSuperAdmin,
  getCurrentPersonRoles,
} from "@/lib/yi/auth/yi-directory-roles";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// Coimbatore — director's home chapter. The stakeholder_coordinators row
// requires a NOT NULL chapter_id with a real FK into yi.chapters; we use
// Coimbatore so the row is intelligible in the admin UI. stakeholder_id is
// NOT NULL but has NO foreign key, so a synthetic UUID is acceptable.
const SUPER_ADMIN_HOME_CHAPTER_ID = "e7f4d0a3-743d-412d-98d5-547da74c1662";
const SUPER_ADMIN_SYNTHETIC_STAKEHOLDER_ID =
  "00000000-0000-0000-0000-000000000001";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function loginRedirect(reason: string) {
  const url = new URL(
    "/login",
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );
  url.searchParams.set("redirectTo", "/coordinator/admin-enter");
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET() {
  // 1. Super-admin gate
  const isSuper = await isPlatformSuperAdmin();
  if (!isSuper) {
    return loginRedirect("super_admin_required");
  }

  const me = await getCurrentPersonRoles();
  if (!me || !me.email) {
    return loginRedirect("no_directory_identity");
  }

  // 2. Find or insert synthetic super-admin coordinator row
  const admin = createAdminSupabaseClient();

  const { data: existing, error: lookupErr } = await admin
    .from("stakeholder_coordinators")
    .select("id, email")
    .eq("user_id", me.user_id)
    .maybeSingle();

  if (lookupErr) {
    console.error(
      "[coordinator/admin-enter] lookup failed",
      lookupErr
    );
    return loginRedirect("coordinator_lookup_failed");
  }

  let coordinatorId: string;
  let coordinatorEmail: string;

  if (existing) {
    coordinatorId = existing.id;
    coordinatorEmail = existing.email;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("stakeholder_coordinators")
      .insert({
        chapter_id: SUPER_ADMIN_HOME_CHAPTER_ID,
        stakeholder_type: "school", // satisfies CHECK; admin row is virtual
        stakeholder_id: SUPER_ADMIN_SYNTHETIC_STAKEHOLDER_ID,
        user_id: me.user_id,
        full_name: "Director (Super Admin)",
        email: me.email,
        status: "active",
        password_hash: null,
        password_changed: true,
      })
      .select("id, email")
      .single();

    if (insertErr || !inserted) {
      console.error(
        "[coordinator/admin-enter] insert failed",
        insertErr
      );
      return loginRedirect("coordinator_provision_failed");
    }

    coordinatorId = inserted.id;
    coordinatorEmail = inserted.email;
  }

  // 3. Set portal-scoped session cookies
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/coordinator",
  };

  cookieStore.set("coordinator_id", coordinatorId, cookieOpts);
  cookieStore.set("coordinator_email", coordinatorEmail, cookieOpts);

  // 4. Land on coordinator dashboard
  return NextResponse.redirect(
    new URL(
      "/coordinator",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    )
  );
}
