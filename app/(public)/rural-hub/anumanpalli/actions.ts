"use server";

/**
 * Public, no-login writer for the Anumanpalli village feedback form.
 * Guarded before every insert (lib/rural-hub/guard.ts) — see the 2.36M-row
 * waitlist flood for why a public writer never ships without one.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { SURVEY_KEY } from "@/lib/rural-hub/anumanpalli-survey";
import { checkRuralFeedbackAbuse, ruralFeedbackTable } from "@/lib/rural-hub/guard";
import { parseFeedback } from "@/lib/rural-hub/validate";
import type { FeedbackState } from "@/lib/rural-hub/types";

export async function sendRuralFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const parsed = parseFeedback(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const sb = createAdminSupabaseClient();
  const guard = await checkRuralFeedbackAbuse(
    sb,
    SURVEY_KEY,
    String(formData.get("website") ?? "")
  );
  if (!guard.ok) return { ok: false, message: guard.error };

  const { error } = await ruralFeedbackTable(sb).insert({
    survey_key: SURVEY_KEY,
    ...parsed.row,
    ip: guard.ip,
  });
  if (error) {
    console.error("[rural-hub] feedback insert failed:", error.message);
    return {
      ok: false,
      message: "Could not save your answers. Please try again in a minute.",
    };
  }
  return { ok: true, message: "" };
}
