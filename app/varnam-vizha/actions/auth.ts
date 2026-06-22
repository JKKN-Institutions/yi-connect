"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

/** Committee sign-in via the shared yi-connect Supabase session (cookie-based). */
export async function loginCommittee(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  const sb = await createServerSupabaseClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Incorrect email or password." };
  }
  redirect("/varnam-vizha/dashboard");
}

export async function logoutCommittee(): Promise<void> {
  const sb = await createServerSupabaseClient();
  await sb.auth.signOut();
  redirect("/varnam-vizha");
}
