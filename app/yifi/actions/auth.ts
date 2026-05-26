"use server";

import { cookies } from "next/headers";
import { createServiceClient, createClient } from "@/lib/yifi/supabase/server";

type JoinResult =
  | { type: "member"; registrant: { id: string; full_name: string; edition_id: string } }
  | { type: "error"; message: string };

type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginOrganiser(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function validateAccessCode(code: string): Promise<JoinResult> {
  const trimmed = code.trim().toUpperCase();

  if (!trimmed || trimmed.length < 3 || trimmed.length > 12) {
    return { type: "error", message: "Please enter a valid access code" };
  }

  const supabase = await createServiceClient();

  const { data: registrant, error } = await supabase
    .rpc("yifi_lookup_registrant", { p_code: trimmed });

  if (!registrant || error) {
    return { type: "error", message: "Code not found. Check your YiFi registration confirmation." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "yifi_session",
    JSON.stringify({
      type: "member",
      id: registrant.id,
      name: registrant.full_name,
      editionId: registrant.edition_id,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    }
  );

  return {
    type: "member",
    registrant: {
      id: registrant.id,
      full_name: registrant.full_name,
      edition_id: registrant.edition_id,
    },
  };
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("yifi_session");
}
