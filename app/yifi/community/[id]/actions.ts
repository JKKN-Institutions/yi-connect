"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";

interface Session {
  id: string;
  name: string;
  editionId: string;
}

/** Local (non-exported) helper — reads the acting registrant from the yifi_session cookie. */
async function readSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Post a reply on a community post. */
export async function addReply(
  postId: string,
  body: string,
  isAnonymous: boolean,
) {
  const session = await readSession();
  if (!session) return { error: "Your session has expired. Please rejoin." };

  const text = body.trim();
  if (!text) return { error: "Reply cannot be empty." };
  if (text.length > 4000) return { error: "Reply is too long (max 4000 characters)." };

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_add_reply", {
    p_post_id: postId,
    p_author: session.id,
    p_body: text,
    p_is_anonymous: isAnonymous,
  });

  if (error) return { error: "Could not post your reply. Try again." };

  revalidatePath(`/yifi/community/${postId}`);
  return { success: true };
}

/** Toggle the viewer's upvote on a reply. Returns the new upvoted state. */
export async function toggleUpvote(replyId: string, postId: string) {
  const session = await readSession();
  if (!session) return { error: "Your session has expired. Please rejoin." };

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("yifi_community_toggle_upvote", {
    p_reply_id: replyId,
    p_registrant_id: session.id,
  });

  if (error) return { error: "Could not register your vote. Try again." };

  revalidatePath(`/yifi/community/${postId}`);
  return { success: true, upvoted: Boolean(data) };
}

/** Mark a reply as the best answer. Only the post author may do this (guarded server-side). */
export async function markBest(postId: string, replyId: string) {
  const session = await readSession();
  if (!session) return { error: "Your session has expired. Please rejoin." };

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_mark_best", {
    p_post_id: postId,
    p_reply_id: replyId,
    p_asker: session.id,
  });

  if (error) return { error: "Could not mark the best answer. Try again." };

  revalidatePath(`/yifi/community/${postId}`);
  return { success: true };
}

/** Flag a post (replyId null) or a reply (parent post + reply id) for moderator review. */
export async function flagItem(
  postId: string,
  replyId: string | null,
  reason: string,
) {
  const session = await readSession();
  if (!session) return { error: "Your session has expired. Please rejoin." };

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_flag", {
    p_edition_id: session.editionId,
    p_post_id: postId,
    p_reply_id: replyId,
    p_flagged_by: session.id,
    p_reason: reason && reason.trim() ? reason.trim() : "Reported by member",
  });

  if (error) return { error: "Could not report this. Try again." };

  return { success: true };
}
