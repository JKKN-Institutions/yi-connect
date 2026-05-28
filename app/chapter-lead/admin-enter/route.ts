/**
 * Super-Admin Bridge → Chapter Lead Portal
 *
 * GET /chapter-lead/admin-enter
 *
 * One-shot bridge that lets a platform super-admin (per
 * yi_directory.role_assignments) enter the Chapter Lead portal without
 * knowing a legacy password.
 *
 * Flow:
 *   1. Verify current Supabase session is a platform super-admin.
 *   2. Ensure a "Super Admin" sub-chapter exists (Coimbatore / Thalir,
 *      stakeholder_type='school') — created on first call, reused after.
 *   3. Ensure a sub_chapter_leads row exists pointing at director's
 *      yi_connect.members row (member_id = director's auth.users.id =
 *      members.id, since members.id FKs to profiles.id FKs to auth.users.id).
 *   4. Set the chapter_lead_id + sub_chapter_id cookies the existing
 *      chapter-lead layout + getChapterLeadSession() expect, scoped to
 *      /chapter-lead.
 *   5. Redirect to /chapter-lead.
 *
 * NOTE on schema-vs-code drift (logged for the orchestrator):
 *   The chapter-lead login server action (app/actions/chapter-lead-auth.ts)
 *   queries columns on sub_chapter_leads that do NOT exist in the live
 *   schema (email, password_hash, status, full_name, etc.). That regular-
 *   user flow is already broken against current prod. This bridge only
 *   uses columns that DO exist, so it does NOT depend on that drift being
 *   fixed.
 *
 * Created 2026-05-28 as part of the YIP super-admin cross-portal bridge.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isPlatformSuperAdmin,
  getCurrentPersonRoles,
} from "@/lib/yi/auth/yi-directory-roles";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// Coimbatore chapter — director's home chapter. Required by sub_chapters
// (FK into yi.chapters).
const SUPER_ADMIN_HOME_CHAPTER_ID = "e7f4d0a3-743d-412d-98d5-547da74c1662";

// stakeholder_id on sub_chapters is NOT NULL but has NO foreign key, so
// a synthetic UUID is acceptable for the virtual super-admin sub-chapter.
const SUPER_ADMIN_SYNTHETIC_STAKEHOLDER_ID =
  "00000000-0000-0000-0000-000000000002";

const SUPER_ADMIN_SUB_CHAPTER_NAME = "Super Admin Bridge (Virtual)";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function loginRedirect(reason: string) {
  const url = new URL(
    "/login",
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );
  url.searchParams.set("redirectTo", "/chapter-lead/admin-enter");
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
  if (!me) {
    return loginRedirect("no_directory_identity");
  }

  const admin = createAdminSupabaseClient();

  // 2. Make sure director has a members row (required by sub_chapter_leads
  //    "lead_must_have_reference" CHECK constraint via member_id FK). The
  //    profiles + members tables both key on auth.users.id, so this should
  //    already exist tonight, but we verify defensively.
  const { data: memberRow, error: memberErr } = await admin
    .from("members")
    .select("id")
    .eq("id", me.user_id)
    .maybeSingle();

  if (memberErr) {
    console.error(
      "[chapter-lead/admin-enter] members lookup failed",
      memberErr
    );
    return loginRedirect("member_lookup_failed");
  }

  if (!memberRow) {
    console.error(
      "[chapter-lead/admin-enter] no yi_connect.members row for super-admin user_id",
      me.user_id
    );
    return loginRedirect("member_row_missing");
  }

  // 3. Find or create the virtual super-admin sub-chapter
  const { data: existingSC, error: scLookupErr } = await admin
    .from("sub_chapters")
    .select("id")
    .eq("chapter_id", SUPER_ADMIN_HOME_CHAPTER_ID)
    .eq("stakeholder_id", SUPER_ADMIN_SYNTHETIC_STAKEHOLDER_ID)
    .maybeSingle();

  if (scLookupErr) {
    console.error(
      "[chapter-lead/admin-enter] sub_chapters lookup failed",
      scLookupErr
    );
    return loginRedirect("sub_chapter_lookup_failed");
  }

  let subChapterId: string;
  if (existingSC) {
    subChapterId = existingSC.id;
  } else {
    const { data: createdSC, error: scInsertErr } = await admin
      .from("sub_chapters")
      .insert({
        chapter_id: SUPER_ADMIN_HOME_CHAPTER_ID,
        stakeholder_type: "school", // satisfies CHECK constraint
        stakeholder_id: SUPER_ADMIN_SYNTHETIC_STAKEHOLDER_ID,
        name: SUPER_ADMIN_SUB_CHAPTER_NAME,
        chapter_type: "thalir", // satisfies CHECK constraint
        status: "active",
      })
      .select("id")
      .single();

    if (scInsertErr || !createdSC) {
      console.error(
        "[chapter-lead/admin-enter] sub_chapters insert failed",
        scInsertErr
      );
      return loginRedirect("sub_chapter_provision_failed");
    }

    subChapterId = createdSC.id;
  }

  // 4. Find or create a sub_chapter_leads row pointing at director
  const { data: existingLead, error: leadLookupErr } = await admin
    .from("sub_chapter_leads")
    .select("id, sub_chapter_id")
    .eq("sub_chapter_id", subChapterId)
    .eq("member_id", me.user_id)
    .maybeSingle();

  if (leadLookupErr) {
    console.error(
      "[chapter-lead/admin-enter] sub_chapter_leads lookup failed",
      leadLookupErr
    );
    return loginRedirect("chapter_lead_lookup_failed");
  }

  let leadId: string;
  if (existingLead) {
    leadId = existingLead.id;
  } else {
    const { data: createdLead, error: leadInsertErr } = await admin
      .from("sub_chapter_leads")
      .insert({
        sub_chapter_id: subChapterId,
        member_id: me.user_id, // FK → yi_connect.members(id), present
        sub_chapter_member_id: null, // XOR with member_id per CHECK
        role: "lead", // satisfies role CHECK
        title: "Director (Super Admin)",
        is_active: true,
      })
      .select("id")
      .single();

    if (leadInsertErr || !createdLead) {
      console.error(
        "[chapter-lead/admin-enter] sub_chapter_leads insert failed",
        leadInsertErr
      );
      return loginRedirect("chapter_lead_provision_failed");
    }

    leadId = createdLead.id;
  }

  // 5. Set portal-scoped session cookies (mirrors loginChapterLead)
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/chapter-lead",
  };

  cookieStore.set("chapter_lead_id", leadId, cookieOpts);
  cookieStore.set("sub_chapter_id", subChapterId, cookieOpts);

  // 6. Land on chapter-lead dashboard
  return NextResponse.redirect(
    new URL(
      "/chapter-lead",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    )
  );
}
