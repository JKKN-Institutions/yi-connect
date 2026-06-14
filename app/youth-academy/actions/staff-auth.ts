"use server";

/**
 * Yi Youth Academy — staff (Supabase auth) sign-out.
 *
 * Staff sign in via Google OAuth or email/password (app/youth-academy/login).
 * The youth-academy area is its own route group, OUTSIDE the dashboard shell
 * whose user-menu carries the global logout — so the staff consoles need their
 * own. Mirrors app/actions/auth.ts signOut(), but returns to the Youth Academy
 * login (on-brand) instead of the main /login.
 *
 * (Students don't use this — they clear the yuva_session cookie via
 * signOutStudent in app/youth-academy/actions/student-auth.ts.)
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOutStaff() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/youth-academy/login");
}
