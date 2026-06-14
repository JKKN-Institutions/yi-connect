"use server";

/**
 * Smart Guide — server actions for progress + instrumentation.
 *
 * A "use server" file may export ONLY async functions (no types/consts) or the
 * Vercel build breaks. All three are scoped to the signed-in user, and RLS
 * enforces row ownership too (see migrations/guide-tables.sql). Reads/writes
 * FAIL SOFT — a progress hiccup must never block the guide or throw into the UI.
 *
 * ── ADAPT: fix the import path to your Supabase server client. ──
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isGuidePersona,
  GUIDE_EVENT_NAMES,
  GUIDE_SURFACES,
  type GuideEvent,
} from "@/lib/guide/types"; // ← adjust path

/** Completed step keys for the current user + persona (empty if logged out). */
export async function getCompletedSteps(persona: string): Promise<string[]> {
  try {
    if (!isGuidePersona(persona)) return []; // reject junk persona — public endpoint
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .schema("yi_connect")
      .from("guide_progress")
      .select("step_key")
      .eq("user_id", user.id)
      .eq("persona", persona);
    if (error) return [];
    return (data ?? []).map((r: { step_key: string }) => r.step_key);
  } catch {
    return [];
  }
}

/** Mark a step done/undone for the current user + persona. */
export async function toggleStep(
  persona: string,
  stepKey: string,
  done: boolean
): Promise<{ ok: boolean }> {
  try {
    if (!isGuidePersona(persona)) return { ok: false };
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    if (done) {
      // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING. The row is
      // immutable on conflict, so this avoids needing a guide_progress UPDATE
      // RLS policy (a DO UPDATE upsert would be RLS-denied on the re-check path).
      const { error } = await supabase
        .schema("yi_connect")
      .from("guide_progress")
        .upsert(
          { user_id: user.id, persona, step_key: stepKey },
          { onConflict: "user_id,persona,step_key", ignoreDuplicates: true }
        );
      return { ok: !error };
    }
    const { error } = await supabase
      .schema("yi_connect")
      .from("guide_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("persona", persona)
      .eq("step_key", stepKey);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/** Append one instrumentation event. Fire-and-forget; never throws into the UI. */
export async function logGuideEvent(event: GuideEvent): Promise<void> {
  try {
    // Validate against the runtime allow-lists — this is a public endpoint, so a
    // caller could POST arbitrary strings and poison the shared metrics table.
    if (
      !(GUIDE_EVENT_NAMES as readonly string[]).includes(event.name) ||
      !(GUIDE_SURFACES as readonly string[]).includes(event.surface) ||
      !isGuidePersona(event.persona)
    ) {
      return;
    }
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.schema("yi_connect").from("guide_events").insert({
      user_id: user?.id ?? null,
      name: event.name,
      persona: event.persona,
      surface: event.surface,
      step_key: event.stepKey ? event.stepKey.slice(0, 256) : null,
      context: event.context ? event.context.slice(0, 256) : null,
    });
  } catch {
    // analytics must never break the page
  }
}
