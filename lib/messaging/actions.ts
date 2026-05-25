"use server";

import { createServiceClient } from "@/lib/yi-future/supabase/server";

// ─── SHARED TYPES ──────────────────────────────────────────────────
export type SenderType = "delegate" | "mentor" | "admin" | "chair" | "member";

export type Message = {
  id: string;
  thread_id: string;
  sender_type: SenderType;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export type MessageThread = {
  id: string;
  team_id: string;
  mentor_id: string;
  context: string | null; // "yi_future", "yi_connect", etc.
  created_at: string;
  last_message_at: string;
};

export type ThreadListItem = {
  id: string;
  team_id: string;
  mentor_id: string;
  team_name: string;
  mentor_name: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender_type: SenderType | null;
};

export type Caller = {
  type: SenderType;
  id: string;
  name: string;
};

// ─── CORE SEND MESSAGE ─────────────────────────────────────────────
/**
 * Auth-agnostic send. The caller identity is injected by the
 * app-specific wrapper (Yi Future, Yi Connect, etc.) which is
 * responsible for validating access before calling this.
 */
export async function sendMessageCore(
  threadId: string,
  caller: Caller,
  body: string
): Promise<{ ok: true; data: Message } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message cannot be empty." };
  if (trimmed.length > 5000)
    return { ok: false, error: "Message too long (max 5000 chars)." };

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = (await svc
    .schema("future")
    .from("messages" as never)
    .insert({
      thread_id: threadId,
      sender_type: caller.type,
      sender_id: caller.id,
      body: trimmed,
      created_at: nowIso,
    } as never)
    .select("id, thread_id, sender_type, sender_id, body, created_at")
    .maybeSingle()) as unknown as {
    data: Omit<Message, "sender_name"> | null;
    error: { message: string } | null;
  };

  if (error || !data)
    return { ok: false, error: error?.message ?? "Could not send message." };

  // Bump thread.last_message_at
  await svc
    .schema("future")
    .from("message_threads" as never)
    .update({ last_message_at: nowIso } as never)
    .eq("id", threadId);

  return {
    ok: true,
    data: { ...data, sender_name: caller.name },
  };
}

// ─── CORE LIST MESSAGES ────────────────────────────────────────────
/**
 * Auth-agnostic list. The caller is responsible for verifying
 * access to this thread before calling.
 */
export async function listMessagesCore(
  threadId: string,
  limit = 200
): Promise<{ ok: true; data: Message[] } | { ok: false; error: string }> {
  const svc = await createServiceClient();
  const cap = Math.max(1, Math.min(limit, 500));

  const { data: rows } = (await svc
    .schema("future")
    .from("messages" as never)
    .select("id, thread_id, sender_type, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(cap)) as unknown as {
    data: Omit<Message, "sender_name">[] | null;
  };

  const list = rows ?? [];
  if (list.length === 0) return { ok: true, data: [] };

  // ─── Resolve sender display names in batched lookups ──────────
  const delegateIds = Array.from(
    new Set(
      list.filter((r) => r.sender_type === "delegate").map((r) => r.sender_id)
    )
  );
  const mentorIds = Array.from(
    new Set(
      list.filter((r) => r.sender_type === "mentor").map((r) => r.sender_id)
    )
  );
  const adminIds = Array.from(
    new Set(
      list
        .filter((r) => ["admin", "chair", "member"].includes(r.sender_type))
        .map((r) => r.sender_id)
    )
  );

  const nameMap = new Map<string, string>();

  if (delegateIds.length > 0) {
    const { data: delegates } = (await svc
      .schema("future")
      .from("delegates")
      .select("id, full_name")
      .in("id", delegateIds)) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    for (const d of delegates ?? []) {
      nameMap.set(`delegate:${d.id}`, d.full_name ?? "Delegate");
    }
  }

  if (mentorIds.length > 0) {
    const { data: mentors } = (await svc
      .schema("future")
      .from("mentors")
      .select("id, full_name")
      .in("id", mentorIds)) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    for (const m of mentors ?? []) {
      nameMap.set(`mentor:${m.id}`, m.full_name ?? "Mentor");
    }
  }

  if (adminIds.length > 0) {
    const { data: people } = (await svc
      .schema("yi_connect" as "public")
      .from("members" as never)
      .select("id, display_name")
      .in("id", adminIds)) as unknown as {
      data: { id: string; display_name: string | null }[] | null;
    };
    for (const p of people ?? []) {
      nameMap.set(`admin:${p.id}`, p.display_name ?? "Admin");
      nameMap.set(`chair:${p.id}`, p.display_name ?? "Chair");
      nameMap.set(`member:${p.id}`, p.display_name ?? "Member");
    }
  }

  const messages: Message[] = list.map((r) => ({
    ...r,
    sender_name:
      nameMap.get(`${r.sender_type}:${r.sender_id}`) ??
      r.sender_type.charAt(0).toUpperCase() + r.sender_type.slice(1),
  }));

  return { ok: true, data: messages };
}
