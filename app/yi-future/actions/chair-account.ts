"use server";

import { createClient } from "@/lib/yi-future/supabase/server";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Verify the signed-in user's current password and rotate it to `newPassword`.
 *
 * Why verify current password?
 *   supabase.auth.updateUser({ password }) does NOT require re-auth — it
 *   trusts the active session. Without a verify step, a chair's unlocked
 *   laptop could be used to lock them out. So we re-attempt sign-in with
 *   `currentPassword` first (it's cheap; Supabase will rate-limit if
 *   abused) and only then call updateUser.
 *
 *   This is also the only place we use `currentPassword` — it is not
 *   stored or logged.
 */
export async function changeMyPassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (newPassword.length < 10) {
    return { ok: false, error: "New password must be at least 10 characters." };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "New password must be different from current password." };
  }

  const supabase = await createClient();

  // 1. Must be signed in.
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user || !user.email) {
    return { ok: false, error: "You are signed out. Please sign in again." };
  }

  // 2. Verify current password by re-attempting sign-in with the same email.
  //    Successful sign-in refreshes the session; failure leaves it intact.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyErr) {
    return { ok: false, error: "Current password is incorrect." };
  }

  // 3. Rotate.
  const { error: updErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  return { ok: true };
}
