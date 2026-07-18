"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";

type Session = { id: string; editionId: string };

async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.editionId) return null;
    return { id: parsed.id, editionId: parsed.editionId };
  } catch {
    return null;
  }
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

const POST_TYPES = ["challenge", "best_practice", "industry"] as const;

/**
 * Create a fresh community post (status 'published').
 */
export async function createPost(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const type = clean(formData.get("post_type"));
  const title = clean(formData.get("title"));
  const body = clean(formData.get("body"));
  const sector = clean(formData.get("sector"));
  const isAnonymous = formData.get("is_anonymous") === "on";

  if (!POST_TYPES.includes(type as (typeof POST_TYPES)[number])) {
    return { error: "Pick a valid post type." };
  }
  if (title.length < 3 || title.length > 140) {
    return { error: "Title must be 3-140 characters." };
  }
  if (body.length < 3) {
    return { error: "Add a bit more detail to your post." };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("yifi_community_create_post", {
    p_edition_id: session.editionId,
    p_author: session.id,
    p_type: type,
    p_title: title,
    p_body: body,
    p_sector: sector || null,
    p_is_anonymous: isAnonymous,
  });

  if (error) return { error: "Could not publish your post. Try again." };

  revalidatePath("/yifi/community");
  return { success: true, id: data as string };
}

/**
 * Approve a census-seeded draft: apply edits and publish it.
 */
export async function approveDraft(input: {
  postId: string;
  title: string;
  body: string;
  sector: string | null;
  isAnonymous: boolean;
}) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 140) {
    return { error: "Title must be 3-140 characters." };
  }
  if (body.length < 3) {
    return { error: "Add a bit more detail before sharing." };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_approve_draft", {
    p_post_id: input.postId,
    p_author: session.id,
    p_title: title,
    p_body: body,
    p_sector: input.sector?.trim() || null,
    p_is_anonymous: input.isAnonymous,
  });

  if (error) return { error: "Could not share this. Try again." };

  revalidatePath("/yifi/me/community");
  revalidatePath("/yifi/community");
  return { success: true };
}

/**
 * Discard a census-seeded draft (status -> 'removed').
 */
export async function discardDraft(postId: string) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_discard_draft", {
    p_post_id: postId,
    p_author: session.id,
  });

  if (error) return { error: "Could not discard this. Try again." };

  revalidatePath("/yifi/me/community");
  return { success: true };
}

/**
 * Mark one of the member's notifications as read.
 */
export async function markNotificationRead(id: string) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("yifi_community_mark_notification_read", {
    p_id: id,
  });

  if (error) return { error: "Could not update. Try again." };

  revalidatePath("/yifi/me/community");
  return { success: true };
}
