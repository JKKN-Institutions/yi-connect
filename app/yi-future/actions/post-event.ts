"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

export type PostEventInput = {
  turnout_count: number | null;
  key_moments: string | null;
  press_coverage_links: string[];
  media_gallery_paths: string[];
};

export type PostEventReportRow = {
  id: string;
  event_id: string;
  authored_by: string | null;
  turnout_count: number | null;
  key_moments: string | null;
  press_coverage_links: string[];
  media_gallery_paths: string[];
  status: "draft" | "submitted";
  created_at: string;
  submitted_at: string | null;
};

async function requireUser(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id };
}

/**
 * Fetches the post-event report for a given national event (if any).
 */
export async function getPostEventReport(
  eventId: string
): Promise<PostEventReportRow | null> {
  if (!eventId) return null;
  const svc = await createServiceClient();
  const { data } = await (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            c: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: PostEventReportRow | null;
            }>;
          };
        };
      };
    };
  })
    .schema("future")
    .from("post_event_reports")
    .select(
      "id, event_id, authored_by, turnout_count, key_moments, press_coverage_links, media_gallery_paths, status, created_at, submitted_at"
    )
    .eq("event_id", eventId)
    .maybeSingle();

  return data ?? null;
}

/**
 * UPSERT post-event report as DRAFT.
 * Host chapter only — caller authentication enforced via Supabase Auth.
 */
export async function saveDraft(
  eventId: string,
  input: PostEventInput
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Login required." };
  if (!eventId) return { ok: false, error: "Event id is required." };

  const svc = await createServiceClient();

  // Check existing
  const existing = await getPostEventReport(eventId);

  const turnout =
    input.turnout_count !== null && Number.isFinite(input.turnout_count)
      ? Math.max(0, Math.floor(input.turnout_count))
      : null;
  const keyMoments = input.key_moments?.trim() || null;
  const links = (input.press_coverage_links ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const gallery = (input.media_gallery_paths ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (existing) {
    if (existing.status === "submitted") {
      return {
        ok: false,
        error: "Report already submitted — drafts are locked.",
      };
    }
    const { error } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          update: (
            row: never
          ) => {
            eq: (
              c: string,
              v: string
            ) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    })
      .schema("future")
      .from("post_event_reports")
      .update({
        turnout_count: turnout,
        key_moments: keyMoments,
        press_coverage_links: links,
        media_gallery_paths: gallery,
        status: "draft",
      } as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          insert: (
            row: never
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .schema("future")
      .from("post_event_reports")
      .insert({
        event_id: eventId,
        authored_by: user.userId,
        turnout_count: turnout,
        key_moments: keyMoments,
        press_coverage_links: links,
        media_gallery_paths: gallery,
        status: "draft",
      } as never);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/host/post-event");
  return { ok: true, message: "Draft saved." };
}

/**
 * Flip status to 'submitted' and stamp `submitted_at`.
 */
export async function submit(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Login required." };
  if (!eventId) return { ok: false, error: "Event id is required." };

  const existing = await getPostEventReport(eventId);
  if (!existing) {
    return {
      ok: false,
      error: "No draft found — save a draft first.",
    };
  }
  if (existing.status === "submitted") {
    return { ok: false, error: "Report already submitted." };
  }

  const svc = await createServiceClient();
  const { error } = await (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        update: (
          row: never
        ) => {
          eq: (
            c: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .schema("future")
    .from("post_event_reports")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    } as never)
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/host/post-event");
  return { ok: true, message: "Report submitted." };
}
