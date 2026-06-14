"use server";

import { cookies } from "next/headers";
import { createServiceClient, createClient } from "@/lib/yifi/supabase/server";
import {
  sendBrandedPasswordReset,
  appBaseUrl,
} from "@/lib/auth/branded-password-reset";

type JoinResult =
  | { type: "member"; registrant: { id: string; full_name: string; edition_id: string } }
  | { type: "error"; message: string };

type LoginResult =
  | { ok: true; isOrganiser: boolean; isRegistrant: boolean }
  | { ok: false; error: string };

export async function loginOrganiser(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  const svc = await createServiceClient();

  const editionRes = await svc.rpc("yifi_current_edition");
  const editionId = editionRes.data?.id;

  let isOrganiser = false;
  let isRegistrant = false;

  if (editionId) {
    const [orgRes, regRes] = await Promise.all([
      svc.rpc("yifi_check_organiser", { p_email: email, p_edition_id: editionId }),
      svc.rpc("yifi_find_by_email", { p_email: email }),
    ]);
    isOrganiser = Array.isArray(orgRes.data) && orgRes.data.length > 0;
    isRegistrant = !!regRes.data?.id;

    if (isRegistrant) {
      const cookieStore = await cookies();
      cookieStore.set(
        "yifi_session",
        JSON.stringify({
          type: "member",
          id: regRes.data.id,
          name: regRes.data.full_name,
          editionId: regRes.data.edition_id,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        }
      );
    }
  }

  return { ok: true, isOrganiser, isRegistrant };
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/yifi/login?reset=true`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logoutOrganiser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("yifi_session");
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
