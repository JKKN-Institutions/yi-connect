"use server";

/**
 * YIP in-app community chat — server actions (FOUNDATION).
 *
 * ⚠️ CHILD SAFETY: YIP participants are MINORS (school students, Classes 9-12).
 * Every action in this file no-ops when the feature flag is OFF
 * (NEXT_PUBLIC_YIP_CHAT_ENABLED !== "true"), and the flag DEFAULTS OFF. This
 * feature MUST NOT be enabled in production until (a) a named Yi moderation
 * owner exists and (b) a child-safety review is complete.
 *
 * Authorization model:
 *   - The chat tables (yip.chat_channels / yip.chat_messages) are
 *     service-role-only (RLS on, zero anon/authenticated grants). The ONLY way
 *     to read or write them is through these gated server actions.
 *   - Students authenticate via the access-code `yip_session` cookie
 *     (requireParticipantSession). They may post in group channels OR DM a YUVA
 *     volunteer. There is NO student↔student DM path — neither the schema nor
 *     these actions can express one.
 *   - Moderators/organisers authenticate via Supabase Auth and are gated by
 *     getYipEventAccess(...).canManage (deleteMessage is moderation-only).
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const DISABLED = "Community chat is not enabled." as const;

// ─── Public shapes ──────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  eventId: string;
  kind: "party" | "committee" | "announcement";
  partyId: string | null;
  committeeName: string | null;
  name: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string | null;
  senderKind: "student" | "yuva" | "admin";
  senderParticipantId: string | null;
  senderVolunteerId: string | null;
  body: string;
  dmToVolunteerId: string | null;
  deletedAt: string | null;
  createdAt: string;
}

// ─── Untyped table access (chat_* not in generated DB types yet) ────
// Scoped to this file. Everything else on the service client stays typed.
type AnyTable = {
  select: (cols?: string) => AnyTable;
  insert: (row: Record<string, unknown>) => AnyTable;
  update: (row: Record<string, unknown>) => AnyTable;
  eq: (col: string, val: unknown) => AnyTable;
  is: (col: string, val: unknown) => AnyTable;
  order: (col: string, opts?: Record<string, unknown>) => AnyTable;
  limit: (n: number) => AnyTable;
  single: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  maybeSingle: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  then: Promise<{ data: RawAny[] | null; error: PgError | null }>["then"];
};
type RawAny = Record<string, unknown>;
type PgError = { code?: string; message: string };
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

function table(sb: ServiceClient, name: string): AnyTable {
  return (sb as unknown as { from: (t: string) => AnyTable }).from(name);
}

// ─── Row mappers ────────────────────────────────────────────────

function toChannel(r: RawAny): ChatChannel {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    kind: r.kind as ChatChannel["kind"],
    partyId: (r.party_id as string | null) ?? null,
    committeeName: (r.committee_name as string | null) ?? null,
    name: String(r.name),
    createdAt: String(r.created_at),
  };
}

function toMessage(r: RawAny): ChatMessage {
  return {
    id: String(r.id),
    channelId: (r.channel_id as string | null) ?? null,
    senderKind: r.sender_kind as ChatMessage["senderKind"],
    senderParticipantId: (r.sender_participant_id as string | null) ?? null,
    senderVolunteerId: (r.sender_volunteer_id as string | null) ?? null,
    body: String(r.body),
    dmToVolunteerId: (r.dm_to_volunteer_id as string | null) ?? null,
    deletedAt: (r.deleted_at as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

// ─── 1. List channels for an event ──────────────────────────────

export async function listChannels(
  eventId: string
): Promise<ActionResult<ChatChannel[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!eventId) return { success: false, error: "Missing event." };

  const sb = await createServiceClient();
  const { data, error } = (await table(sb, "chat_channels")
    .select("id, event_id, kind, party_id, committee_name, name, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []).map(toChannel) };
}

// ─── 2. List messages (channel thread OR a student↔YUVA DM thread) ──

type ListMessagesArgs =
  | { channelId: string }
  | { dmWithVolunteerId: string; participantId: string };

export async function listMessages(
  args: ListMessagesArgs
): Promise<ActionResult<ChatMessage[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };

  const sb = await createServiceClient();

  if ("channelId" in args) {
    if (!args.channelId) return { success: false, error: "Missing channel." };
    const { data, error } = (await table(sb, "chat_messages")
      .select(
        "id, channel_id, sender_kind, sender_participant_id, sender_volunteer_id, body, dm_to_volunteer_id, deleted_at, created_at"
      )
      .eq("channel_id", args.channelId)
      .order("created_at", { ascending: true })
      .limit(500)) as { data: RawAny[] | null; error: PgError | null };

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []).map(toMessage) };
  }

  // DM thread: the calling student may only read their OWN thread with a YUVA.
  const { dmWithVolunteerId, participantId } = args;
  if (!dmWithVolunteerId || !participantId) {
    return { success: false, error: "Missing DM thread parameters." };
  }

  // Resolve the participant's event from their session, and authorize them
  // against the participantId they claim. We need the eventId to bound the
  // thread, so look the participant up first via the service client, then
  // verify the session owns that participant.
  const { data: pRow } = (await table(sb, "participants")
    .select("id, event_id")
    .eq("id", participantId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!pRow) return { success: false, error: "Participant not found." };
  const eventId = String(pRow.event_id);

  const auth = await requireParticipantSession(participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  // The thread = messages where this participant is the student AND this
  // volunteer is the YUVA counterpart, in either direction.
  const { data, error } = (await table(sb, "chat_messages")
    .select(
      "id, channel_id, sender_kind, sender_participant_id, sender_volunteer_id, body, dm_to_volunteer_id, deleted_at, created_at"
    )
    .eq("event_id", eventId)
    .eq("sender_participant_id", participantId)
    .eq("dm_to_volunteer_id", dmWithVolunteerId)
    .order("created_at", { ascending: true })
    .limit(500)) as { data: RawAny[] | null; error: PgError | null };

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []).map(toMessage) };
}

// ─── 3. Post a message into a group channel ─────────────────────
// A student posts into a channel via their access-code session. (YUVA / admin
// channel posting can be layered on later; the foundation ships the student
// path so the UI is usable.)

export async function postChannelMessage(args: {
  participantId: string;
  channelId: string;
  body: string;
}): Promise<ActionResult<ChatMessage>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };

  const body = (args.body ?? "").trim();
  if (!body) return { success: false, error: "Message cannot be empty." };
  if (body.length > 2000) {
    return { success: false, error: "Message is too long (max 2000 chars)." };
  }
  if (!args.channelId || !args.participantId) {
    return { success: false, error: "Missing channel or sender." };
  }

  const sb = await createServiceClient();

  // The channel must exist; we bind the message to the channel's event.
  const { data: ch } = (await table(sb, "chat_channels")
    .select("id, event_id")
    .eq("id", args.channelId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!ch) return { success: false, error: "Channel not found." };
  const eventId = String(ch.event_id);

  // Verify the access-code session owns this participant for this event.
  const auth = await requireParticipantSession(args.participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  const { data, error } = (await table(sb, "chat_messages")
    .insert({
      event_id: eventId,
      channel_id: args.channelId,
      sender_kind: "student",
      sender_participant_id: args.participantId,
      dm_to_volunteer_id: null,
      body,
    })
    .select(
      "id, channel_id, sender_kind, sender_participant_id, sender_volunteer_id, body, dm_to_volunteer_id, deleted_at, created_at"
    )
    .single()) as { data: RawAny | null; error: PgError | null };

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to post." };
  }
  return { success: true, data: toMessage(data) };
}

// ─── 4. Student → YUVA direct message ───────────────────────────
// The ONLY DM path. Sender MUST be a student (access-code session); recipient
// MUST be a volunteer flagged is_yuva on the same event. There is NO
// student↔student DM — the schema forbids it and so does this action.

export async function postDmToYuva(
  participantId: string,
  volunteerId: string,
  body: string
): Promise<ActionResult<ChatMessage>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };

  const text = (body ?? "").trim();
  if (!text) return { success: false, error: "Message cannot be empty." };
  if (text.length > 2000) {
    return { success: false, error: "Message is too long (max 2000 chars)." };
  }
  if (!participantId || !volunteerId) {
    return { success: false, error: "Missing sender or recipient." };
  }

  const sb = await createServiceClient();

  // Resolve the student's event (and confirm they exist).
  const { data: pRow } = (await table(sb, "participants")
    .select("id, event_id")
    .eq("id", participantId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!pRow) return { success: false, error: "Participant not found." };
  const eventId = String(pRow.event_id);

  // The sender MUST be a student via their own access-code session.
  const auth = await requireParticipantSession(participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  // The recipient MUST be a YUVA volunteer on the SAME event. This is what
  // forbids student→student DMs: the recipient column references volunteers,
  // and we additionally require is_yuva + same event.
  const { data: vol } = (await table(sb, "volunteers")
    .select("id, event_id, is_yuva")
    .eq("id", volunteerId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!vol) {
    return { success: false, error: "You can only message a YUVA mentor." };
  }
  if (String(vol.event_id) !== eventId) {
    return { success: false, error: "That mentor is not on your event." };
  }
  if (vol.is_yuva !== true) {
    return { success: false, error: "You can only message a YUVA mentor." };
  }

  const { data, error } = (await table(sb, "chat_messages")
    .insert({
      event_id: eventId,
      channel_id: null,
      sender_kind: "student",
      sender_participant_id: participantId,
      dm_to_volunteer_id: volunteerId,
      body: text,
    })
    .select(
      "id, channel_id, sender_kind, sender_participant_id, sender_volunteer_id, body, dm_to_volunteer_id, deleted_at, created_at"
    )
    .single()) as { data: RawAny | null; error: PgError | null };

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to send." };
  }
  return { success: true, data: toMessage(data) };
}

// ─── 5. Moderation: soft-delete a message ───────────────────────
// Organiser/chair only (getYipEventAccess.canManage). Never hard-deletes — sets
// deleted_at / deleted_by so the action is auditable.

export async function deleteMessage(
  messageId: string
): Promise<ActionResult> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!messageId) return { success: false, error: "Missing message." };

  const sb = await createServiceClient();

  const { data: msg } = (await table(sb, "chat_messages")
    .select("id, event_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!msg) return { success: false, error: "Message not found." };
  const eventId = String(msg.event_id);

  // Moderation is an organising capability.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to moderate this event." };
  }

  // We need the acting auth user's id for the audit stamp.
  const { createClient } = await import("@/lib/yip/supabase/server");
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = (await table(sb, "chat_messages")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", messageId)) as { data: RawAny[] | null; error: PgError | null };

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── 6. List YUVA mentors a student may DM ──────────────────────
// Convenience for the UI: the YUVA volunteers on the student's event. Gated by
// the student's own session.

export interface YuvaContact {
  volunteerId: string;
  name: string;
}

export async function listYuvaContacts(
  participantId: string
): Promise<ActionResult<YuvaContact[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!participantId) return { success: false, error: "Missing participant." };

  const sb = await createServiceClient();

  const { data: pRow } = (await table(sb, "participants")
    .select("id, event_id")
    .eq("id", participantId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!pRow) return { success: false, error: "Participant not found." };
  const eventId = String(pRow.event_id);

  const auth = await requireParticipantSession(participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  const { data, error } = (await table(sb, "volunteers")
    .select("id, full_name, is_yuva, event_id")
    .eq("event_id", eventId)
    .eq("is_yuva", true)
    .order("full_name", { ascending: true })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };

  if (error) return { success: false, error: error.message };
  return {
    success: true,
    data: (data ?? []).map((r) => ({
      volunteerId: String(r.id),
      name: String(r.full_name),
    })),
  };
}
