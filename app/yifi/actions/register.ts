"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/yifi/supabase/server";

type RegisterResult =
  | { ok: true; status: "registered"; accessCode: string }
  | { ok: true; status: "already_registered" }
  | { ok: false; error: string };

type PrefillResult = { full_name: string } | null;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Self-serve YiFi registration. The form IS the census: when the registrant
 * gives a sector and at least one challenge, census_complete flips true inside
 * yifi_register_self, which lights up the admin Census Monitor + match curation.
 * On success we set the same yifi_session cookie the access-code path uses, so
 * the registrant lands authenticated on /yifi/me.
 */
export async function registerSelf(formData: FormData): Promise<RegisterResult> {
  const fullName = str(formData, "full_name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const memberCategory = str(formData, "member_category");
  const chapterName = str(formData, "chapter_name");
  const sector = str(formData, "sector");
  const organisation = str(formData, "organisation");
  const designation = str(formData, "designation");
  const city = str(formData, "city");
  const totalTeamSize = str(formData, "total_team_size");

  const challenges = [
    str(formData, "challenge1"),
    str(formData, "challenge2"),
    str(formData, "challenge3"),
  ].filter(Boolean);

  const seeking = formData
    .getAll("seeking")
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  const canOffer = {
    capital_range: str(formData, "offer_capital") || null,
    hours_per_month: str(formData, "offer_hours") || null,
    distribution_reach: str(formData, "offer_distribution") || null,
    customer_access: str(formData, "offer_customers") || null,
  };

  const isCouple = formData.get("is_couple") === "on" || formData.get("is_couple") === "true";
  const partnerName = str(formData, "partner_name");
  const partnerPhone = str(formData, "partner_phone");
  const partnerEmail = str(formData, "partner_email");

  if (!fullName) return { ok: false, error: "Please enter your name" };
  if (!phone) return { ok: false, error: "Please enter your phone number" };
  if (isCouple && !partnerName) {
    return { ok: false, error: "Please enter your partner's name, or uncheck 'Registering as a couple'" };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("yifi_register_self", {
    p_full_name: fullName,
    p_phone: phone,
    p_email: email || null,
    p_member_category: memberCategory || null,
    p_chapter_name: chapterName || null,
    p_sector: sector || null,
    p_organisation: organisation || null,
    p_designation: designation || null,
    p_city: city || null,
    p_challenges: challenges,
    p_can_offer: canOffer,
    p_seeking: seeking,
    p_total_team_size: totalTeamSize || null,
    p_is_couple: isCouple,
    p_partner_name: partnerName || null,
    p_partner_phone: partnerPhone || null,
    p_partner_email: partnerEmail || null,
  });

  if (error || !data) {
    return { ok: false, error: "Something went wrong saving your registration. Please try again." };
  }

  const result = data as {
    error?: string;
    id?: string;
    access_code?: string;
    full_name?: string;
    edition_id?: string;
    already_registered?: boolean;
  };

  if (result.error) return { ok: false, error: result.error };

  // Already registered: the RPC deliberately returns no code and no id. We must NOT
  // mint a session or reveal a credential for an identity the caller has not proven
  // they own — route them to the "I have a code" door instead.
  if (result.already_registered) {
    return { ok: true, status: "already_registered" };
  }

  if (!result.id || !result.access_code || !result.edition_id) {
    return { ok: false, error: "Something went wrong saving your registration. Please try again." };
  }

  // Fresh registration only: auto-login with a session scoped to the row we just
  // created (its code was generated in this same call).
  const cookieStore = await cookies();
  cookieStore.set(
    "yifi_session",
    JSON.stringify({
      type: "member",
      id: result.id,
      name: result.full_name,
      editionId: result.edition_id,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    }
  );

  return { ok: true, status: "registered", accessCode: result.access_code };
}

/**
 * Pre-fill known Yi members from the directory by email (name + phone only;
 * the directory has no sector/chapter). Returns null when there is no match,
 * so the form simply leaves fields blank — never blocks registration.
 */
export async function prefillByEmail(email: string): Promise<PrefillResult> {
  const clean = (email || "").trim();
  if (!clean || !clean.includes("@")) return null;

  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_prefill_by_email", { p_email: clean });
  if (!data) return null;

  const row = data as { full_name?: string | null };
  return row.full_name ? { full_name: row.full_name } : null;
}
