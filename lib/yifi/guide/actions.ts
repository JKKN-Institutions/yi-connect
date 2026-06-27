"use server";

/**
 * YiFi guide — adoption-layer server actions (progress + events).
 *
 * A "use server" file may export ONLY async functions. All fail SOFT — a
 * progress/analytics hiccup must never throw into the UI or block the guide.
 *
 * Dual-auth reality (mirrors the Yuva install):
 *   - guide_progress is the ORGANISER setup checklist → written via the AUTH
 *     user client so auth.uid() + RLS apply. Founders sign in with an access
 *     code (a `yifi_session` cookie, NOT a Supabase session), so getUser() is
 *     null for them → they get the plain guide with localStorage-only welcome
 *     dismissal; that's intended (guide_progress.user_id is uuid NOT NULL, so a
 *     codeless founder simply has no row to write).
 *   - guide_events fire for everyone → written via the SERVICE client (the
 *     action validates the payload), so founder/anonymous events log without
 *     needing anon grants. user_id is the organiser auth id, else null.
 *
 * Tables live in the yi_connect schema (both clients default to it). The `app`
 * discriminator buckets YiFi progress + events away from every other app's
 * same-named lane.
 */
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase/server";
import {
  isGuideLane,
  GUIDE_EVENT_NAMES,
  GUIDE_SURFACES,
  type GuideEvent,
} from "@/lib/yifi/guide/content";

// This app's value for the shared guide tables' `app` discriminator column, so
// YiFi progress + events never collide with another app's same-named lane.
const APP = "yifi";

/** Completed step keys for the current ORGANISER user + lane (empty if not authed). */
export async function getCompletedSteps(persona: string): Promise<string[]> {
  try {
    if (!isGuideLane(persona)) return [];
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("guide_progress")
      .select("step_key")
      .eq("user_id", user.id)
      .eq("app", APP)
      .eq("persona", persona);
    if (error) return [];
    return (data ?? []).map((r: { step_key: string }) => r.step_key);
  } catch {
    return [];
  }
}

/** Mark a step done/undone for the current organiser user + lane. */
export async function toggleStep(
  persona: string,
  stepKey: string,
  done: boolean
): Promise<{ ok: boolean }> {
  try {
    if (!isGuideLane(persona)) return { ok: false };
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    if (done) {
      // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING (no UPDATE policy
      // needed; the row is immutable on conflict).
      const { error } = await supabase
        .from("guide_progress")
        .upsert(
          { user_id: user.id, app: APP, persona, step_key: stepKey },
          { onConflict: "user_id,app,persona,step_key", ignoreDuplicates: true }
        );
      return { ok: !error };
    }
    const { error } = await supabase
      .from("guide_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("app", APP)
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
    // Public endpoint — validate against the runtime allow-lists before insert.
    if (
      !(GUIDE_EVENT_NAMES as readonly string[]).includes(event.name) ||
      !(GUIDE_SURFACES as readonly string[]).includes(event.surface) ||
      !isGuideLane(event.persona)
    ) {
      return;
    }
    // Resolve the actor without letting a missing session block the insert.
    let userId: string | null = null;
    try {
      const u = await createServerSupabaseClient();
      userId = (await u.auth.getUser()).data.user?.id ?? null;
    } catch {
      userId = null;
    }
    const svc = createAdminSupabaseClient();
    await svc.from("guide_events").insert({
      user_id: userId,
      app: APP,
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
