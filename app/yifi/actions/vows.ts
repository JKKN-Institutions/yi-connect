"use server";

import { createServiceClient } from "@/lib/yifi/supabase/server";

interface CreateVowInput {
  registrantId: string;
  editionId: string;
  category: string;
  vowText: string;
}

export async function createVow(input: CreateVowInput) {
  const { registrantId, editionId, category, vowText } = input;

  if (!vowText.trim() || vowText.length > 100) {
    return { error: "Vow must be 1-100 characters" };
  }

  if (!["business", "family_health", "yi"].includes(category)) {
    return { error: "Invalid vow category" };
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc("yifi_create_vow", {
    p_edition_id: editionId,
    p_registrant_id: registrantId,
    p_category: category,
    p_vow_text: vowText.trim(),
  });

  if (error) {
    return { error: "Failed to save vow. Try again." };
  }

  if (data?.error === "duplicate") {
    return { error: "You already have a vow in this category" };
  }

  return { success: true };
}
