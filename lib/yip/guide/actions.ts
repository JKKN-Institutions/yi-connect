"use server";

/**
 * YIP guide — adoption-layer server actions (progress + events).
 *
 * A "use server" file may export ONLY async functions. All fail SOFT — a
 * progress/analytics hiccup must never throw into the UI or block the guide.
 *
 * Mixed-auth reality (mirrors lib/yuva/guide/actions.ts):
 *   - guide_progress is the organiser setup checklist → written via the AUTH
 *     user client so auth.uid() + RLS apply (students/jury/volunteers use the
 *     yip_session access-code cookie, NOT a Supabase session, so getUser() is
 *     null → they get the plain guide; that's intended).
 *   - guide_events fire for everyone → written via the SERVICE client (the
 *     action validates the payload), so anonymous/cookie events log without
 *     needing anon grants. user_id is the organiser auth id, else null.
 *
 * The shared @/lib/supabase/server clients default to the yi_connect schema,
 * where guide_progress / guide_events live (the YIP-pinned lib/yip/supabase
 * client is schema-locked to "yip", so it is intentionally NOT used here).
 */
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase/server";
import {
  isGuidePersona,
  GUIDE_EVENT_NAMES,
  GUIDE_SURFACES,
  type GuideEvent,
} from "@/lib/yip/guide/types";

/** Completed step keys for the current organiser + lane (empty if not authed). */
export async function getCompletedSteps(persona: string): Promise<string[]> {
  try {
    if (!isGuidePersona(persona)) return [];
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
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

/** Mark a step done/undone for the current organiser + lane. */
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
      // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING (no UPDATE policy
      // needed; the row is immutable on conflict).
      const { error } = await supabase
        .from("guide_progress")
        .upsert(
          { user_id: user.id, persona, step_key: stepKey },
          { onConflict: "user_id,persona,step_key", ignoreDuplicates: true }
        );
      return { ok: !error };
    }
    const { error } = await supabase
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
    // Public endpoint — validate against the runtime allow-lists before insert.
    if (
      !(GUIDE_EVENT_NAMES as readonly string[]).includes(event.name) ||
      !(GUIDE_SURFACES as readonly string[]).includes(event.surface) ||
      !isGuidePersona(event.persona)
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
