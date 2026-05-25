"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/yifi/supabase/server";

function getSessionRegistrantId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateCensus(formData: FormData) {
  const cookieStore = await cookies();
  const registrantId = getSessionRegistrantId(cookieStore);
  if (!registrantId) return { error: "Not logged in" };

  const sector = formData.get("sector") as string;
  const organisation = formData.get("organisation") as string;
  const designation = formData.get("designation") as string;
  const city = formData.get("city") as string;
  const challenge1 = formData.get("challenge1") as string;
  const challenge2 = formData.get("challenge2") as string;
  const challenge3 = formData.get("challenge3") as string;
  const offerCapital = formData.get("offer_capital") as string;
  const offerHours = formData.get("offer_hours") as string;
  const offerDistribution = formData.get("offer_distribution") as string;
  const offerCustomers = formData.get("offer_customers") as string;

  const challenges = [challenge1, challenge2, challenge3].filter(Boolean);
  const canOffer = {
    capital_range: offerCapital || null,
    hours_per_month: offerHours || null,
    distribution_reach: offerDistribution || null,
    customer_access: offerCustomers || null,
  };

  const supabase = await createServiceClient();

  const { error } = await supabase.rpc("yifi_update_census", {
    p_registrant_id: registrantId,
    p_sector: sector,
    p_organisation: organisation,
    p_designation: designation,
    p_city: city,
    p_challenges: challenges,
    p_can_offer: canOffer,
  });

  if (error) return { error: "Failed to save. Try again." };
  return { success: true };
}
