"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { getAdminContext, hasPermission } from "../_guard";
import type { CommunityReply, PostStatus } from "@/lib/yifi/community/types";

/**
 * Server actions for the YiFi community moderation console (Agent 4).
 *
 * Every action is gated by getAdminContext() + hasPermission(ctx, "community")
 * and fails CLOSED — a missing permission returns { ok:false, error } rather
 * than silently redirecting (rule #27). All writes go through SECURITY DEFINER
 * RPCs via the service client, matching the rest of the yifi admin surface.
 */

const COMMUNITY_PATH = "/yifi/admin/community";

export type SeedResult = { ok: true; count: number } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };
export type RepliesResult =
  | { ok: true; replies: CommunityReply[] }
  | { ok: false; error: string };
export type RealAuthor = {
  full_name: string | null;
  email: string | null;
  registrant_id: string | null;
};
export type RevealResult =
  | { ok: true; author: RealAuthor }
  | { ok: false; error: string };
export type SuggestResult =
  | { ok: true; count: number; names: string[] }
  | { ok: false; error: string };

type Gate =
  | { ok: true; editionId: string }
  | { ok: false; error: string };

/** Resolve the caller's admin context and require the "community" permission. */
async function ensureCommunityAdmin(): Promise<Gate> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "community")) {
    return { ok: false, error: "You don't have the community permission." };
  }
  return { ok: true, editionId: ctx.editionId };
}

/**
 * (a) Seed starter "challenge" drafts from the census for every registrant who
 * completed it. Idempotent inside the RPC. Returns the number of drafts created.
 */
export async function seedDrafts(): Promise<SeedResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_community_seed_drafts", {
    p_edition_id: gate.editionId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(COMMUNITY_PATH);
  const count = typeof data === "number" ? data : Number(data) || 0;
  return { ok: true, count };
}

/** (c) Hide / Remove / Restore(publish) a post. */
export async function setStatus(
  postId: string,
  status: PostStatus
): Promise<SimpleResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;
  if (status !== "published" && status !== "hidden" && status !== "removed") {
    return { ok: false, error: "Invalid status." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_community_admin_set_status", {
    p_post_id: postId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(COMMUNITY_PATH);
  return { ok: true };
}

/** (c) Remove a single reply from a post. */
export async function removeReply(replyId: string): Promise<SimpleResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_community_admin_remove_reply", {
    p_reply_id: replyId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(COMMUNITY_PATH);
  return { ok: true };
}

/** (c) Lazily load the replies of a post so the admin can moderate them. */
export async function loadReplies(postId: string): Promise<RepliesResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;

  const svc = await createServiceClient();
  // Admin call: no registrant viewer. Anonymous author names come back masked;
  // the "reveal author" control unmasks them explicitly when needed.
  const { data, error } = await svc.rpc("yifi_community_get_post", {
    p_post_id: postId,
    p_viewer_registrant_id: null,
  });
  if (error) return { ok: false, error: error.message };

  const replies = (data as { replies?: CommunityReply[] } | null)?.replies;
  return { ok: true, replies: Array.isArray(replies) ? replies : [] };
}

/** (b) Resolve / dismiss a flag. */
export async function resolveFlag(
  flagId: string,
  status: "resolved" | "dismissed"
): Promise<SimpleResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;
  if (status !== "resolved" && status !== "dismissed") {
    return { ok: false, error: "Invalid flag status." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_community_admin_resolve_flag", {
    p_flag_id: flagId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(COMMUNITY_PATH);
  return { ok: true };
}

/**
 * (b) Unmask the real author of an anonymous post OR reply. Exactly one of the
 * two ids must be provided (the other is passed as null to the RPC).
 */
export async function revealAuthor(
  postId: string | null,
  replyId: string | null
): Promise<RevealResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;
  if ((postId ? 1 : 0) + (replyId ? 1 : 0) !== 1) {
    return { ok: false, error: "Provide exactly one of post or reply." };
  }

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_community_admin_real_author", {
    p_post_id: postId,
    p_reply_id: replyId,
  });
  if (error) return { ok: false, error: error.message };

  const row = (data ?? {}) as Partial<RealAuthor>;
  return {
    ok: true,
    author: {
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      registrant_id: row.registrant_id ?? null,
    },
  };
}

/**
 * Trigger the helper-suggestion engine for a post: inserts up to 5
 * "helper_suggestion" notifications for sector/challenge-matched registrants.
 * Returns how many helpers were suggested.
 */
export async function suggestHelpers(postId: string): Promise<SuggestResult> {
  const gate = await ensureCommunityAdmin();
  if (!gate.ok) return gate;

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_community_suggest_helpers", {
    p_post_id: postId,
  });
  if (error) return { ok: false, error: error.message };

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const names = rows
    .map((r) => {
      const name = r.full_name ?? r.name;
      return typeof name === "string" && name.length ? name : null;
    })
    .filter((n): n is string => n !== null);

  revalidatePath(COMMUNITY_PATH);
  return { ok: true, count: rows.length, names };
}
