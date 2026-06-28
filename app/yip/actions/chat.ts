"use server";

/**
 * YIP in-app community chat — server actions (FOUNDATION).
 *
 * Every action in this file no-ops when the feature flag is OFF
 * (NEXT_PUBLIC_YIP_CHAT_ENABLED !== "true"). Enabled in production 2026-06-12.
 * Moderators (per programme policy): the chapter chair + chapter organisers
 * from the Yi directory — i.e. getYipEventAccess(...).canManage.
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
 *
 * Moderation layer (pre-event security sweep, 2026-06-12):
 *   - READS ARE GATED, FAIL CLOSED. listChannels / listMessages require either
 *     a participant access-code session (students see ONLY their channels:
 *     announcements + their party + their committee) or canManage on the event.
 *   - Moderation state is enforced at post time: frozen channels and muted
 *     students cannot post (channels OR YUVA DMs).
 *   - Students can report a message they can see (first report wins).
 *   - mod* actions are the organiser moderation surface (canManage only).
 *   - Retention policy: messages are kept for the event + 90 days (operational
 *     note — no cron exists yet; soft-deleted rows follow the same window).
 */

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import { isAllowedReaction } from "@/lib/yip/chat-reactions";

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
  frozenAt: string | null;
  createdAt: string;
}

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  /** True when the calling user has reacted with this emoji. */
  mine: boolean;
}

export interface ChatReplyPreview {
  id: string;
  senderName: string;
  body: string;
  deleted: boolean;
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
  /** WhatsApp-style reply: the message this one replies to (preview), if any. */
  replyToId: string | null;
  replyPreview: ChatReplyPreview | null;
  /** Aggregated emoji reactions on this message. */
  reactions: ChatReactionSummary[];
  /** Pin: set when an organiser has pinned this message to the channel. */
  pinnedAt: string | null;
}

// ─── Untyped table access (chat_* not in generated DB types yet) ────
// Scoped to this file. Everything else on the service client stays typed.
type AnyTable = {
  select: (
    cols?: string,
    opts?: { count?: "exact"; head?: boolean }
  ) => AnyTable;
  insert: (
    row: Record<string, unknown> | Record<string, unknown>[]
  ) => AnyTable;
  update: (row: Record<string, unknown>) => AnyTable;
  delete: () => AnyTable;
  eq: (col: string, val: unknown) => AnyTable;
  is: (col: string, val: unknown) => AnyTable;
  gte: (col: string, val: unknown) => AnyTable;
  in: (col: string, vals: unknown[]) => AnyTable;
  not: (col: string, op: string, val: unknown) => AnyTable;
  order: (col: string, opts?: Record<string, unknown>) => AnyTable;
  limit: (n: number) => AnyTable;
  single: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  maybeSingle: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  then: Promise<{
    data: RawAny[] | null;
    error: PgError | null;
    count: number | null;
  }>["then"];
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
    frozenAt: (r.frozen_at as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

// Shared column lists so every reader returns the same shape.
const CHANNEL_COLS =
  "id, event_id, kind, party_id, committee_name, name, frozen_at, created_at";
const MSG_COLS =
  "id, channel_id, sender_kind, sender_participant_id, sender_volunteer_id, body, dm_to_volunteer_id, deleted_at, created_at, reply_to_id, pinned_at";
const MOD_MSG_COLS = `${MSG_COLS}, reported_at, reported_by_participant_id`;

// ─── Internal helpers (NOT exported — a "use server" file may only export
// async functions) ──────────────────────────────────────────────

type ParticipantChatRow = {
  id: string;
  eventId: string;
  partyId: string | null;
  committeeName: string | null;
};

/** Load the fields channel membership is decided on, scoped to the event. */
async function loadParticipantChatRow(
  sb: ServiceClient,
  participantId: string,
  eventId: string
): Promise<ParticipantChatRow | null> {
  const { data } = (await table(sb, "participants")
    .select("id, event_id, party_id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!data) return null;
  return {
    id: String(data.id),
    eventId: String(data.event_id),
    partyId: (data.party_id as string | null) ?? null,
    committeeName: (data.committee_name as string | null) ?? null,
  };
}

/**
 * Channel membership rule (FAIL CLOSED). Uses the exact fields the channels
 * carry (chat_channels.party_id / committee_name) against the participant's
 * own allocation (participants.party_id / committee_name):
 *   - announcement → every participant of the event.
 *   - party        → only when BOTH sides have a party and they match.
 *   - committee    → only when BOTH sides have a non-empty committee name and
 *                    they match (trimmed, exact — same convention as
 *                    yuva-assignments / committee-scores).
 * Anything else (unknown kind, null bindings) → NOT visible.
 */
function channelVisibleToParticipant(
  ch: ChatChannel,
  p: ParticipantChatRow
): boolean {
  if (ch.kind === "announcement") return true;
  if (ch.kind === "party") {
    return Boolean(ch.partyId && p.partyId && ch.partyId === p.partyId);
  }
  if (ch.kind === "committee") {
    const chName = (ch.committeeName ?? "").trim();
    const pName = (p.committeeName ?? "").trim();
    return Boolean(chName && pName && chName === pName);
  }
  return false;
}

/**
 * Is this participant muted for this event? Tri-state so callers FAIL CLOSED:
 * a lookup error blocks the post instead of silently allowing it.
 */
async function checkMuted(
  sb: ServiceClient,
  eventId: string,
  participantId: string
): Promise<{ ok: true; muted: boolean } | { ok: false; error: string }> {
  const { data, error } = (await table(sb, "chat_mutes")
    .select("id")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (error) return { ok: false, error: "Could not send right now. Please try again." };
  return { ok: true, muted: Boolean(data) };
}

const MUTED_ERROR = "You can't send messages right now." as const;
const FROZEN_ERROR = "This channel is paused by the organisers." as const;

/** The acting organiser's auth user id (for audit stamps). */
async function getAuthUserId(): Promise<string | null> {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  return user?.id ?? null;
}

/** Organiser gate shared by every moderation action. FAIL CLOSED. */
async function requireManage(
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!eventId) return { ok: false, error: "Missing event." };
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { ok: false, error: "Not authorized to moderate this event." };
  }
  return { ok: true };
}

/** Resolve display names for sender ids (participants + volunteers). */
async function loadNameMaps(
  sb: ServiceClient,
  participantIds: string[],
  volunteerIds: string[]
): Promise<{ pNames: Map<string, string>; vNames: Map<string, string> }> {
  const pNames = new Map<string, string>();
  const vNames = new Map<string, string>();
  if (participantIds.length > 0) {
    const { data } = (await table(sb, "participants")
      .select("id, full_name")
      .in("id", participantIds)) as {
      data: RawAny[] | null;
      error: PgError | null;
    };
    for (const r of data ?? []) pNames.set(String(r.id), String(r.full_name));
  }
  if (volunteerIds.length > 0) {
    const { data } = (await table(sb, "volunteers")
      .select("id, full_name")
      .in("id", volunteerIds)) as {
      data: RawAny[] | null;
      error: PgError | null;
    };
    for (const r of data ?? []) vNames.set(String(r.id), String(r.full_name));
  }
  return { pNames, vNames };
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
    replyToId: (r.reply_to_id as string | null) ?? null,
    // replyPreview + reactions are filled by enrichMessages(); a bare row
    // (e.g. the just-inserted send result) starts empty and is enriched before return.
    replyPreview: null,
    reactions: [],
    pinnedAt: (r.pinned_at as string | null) ?? null,
  };
}

// ─── Reaction + reply enrichment ────────────────────────────────
// listMessages/post* return ChatMessage with reply previews + aggregated
// reactions. Identity of the caller (for the `mine` flag) is one of:
//   participant access-code session → { kind: "student", id: participantId }
//   organiser (canManage)           → { kind: "admin",   id: authUserId }
type ReactorIdentity = { kind: "student" | "yuva" | "admin"; id: string };

async function enrichMessages(
  sb: ServiceClient,
  msgs: ChatMessage[],
  me: ReactorIdentity | null
): Promise<ChatMessage[]> {
  if (msgs.length === 0) return msgs;
  const ids = msgs.map((m) => m.id);

  // 1) Reply previews — fetch the replied-to rows + their sender names.
  const replyIds = Array.from(
    new Set(msgs.map((m) => m.replyToId).filter((x): x is string => !!x))
  );
  const replyMap = new Map<string, ChatReplyPreview>();
  if (replyIds.length > 0) {
    const { data: repRows } = (await table(sb, "chat_messages")
      .select(
        "id, body, deleted_at, sender_participant_id, sender_volunteer_id"
      )
      .in("id", replyIds)) as { data: RawAny[] | null; error: PgError | null };
    const rows = repRows ?? [];
    const pIds = rows
      .map((r) => r.sender_participant_id as string | null)
      .filter((x): x is string => !!x);
    const vIds = rows
      .map((r) => r.sender_volunteer_id as string | null)
      .filter((x): x is string => !!x);
    const { pNames, vNames } = await loadNameMaps(sb, pIds, vIds);
    for (const r of rows) {
      const deleted = !!r.deleted_at;
      const name =
        pNames.get(String(r.sender_participant_id)) ??
        vNames.get(String(r.sender_volunteer_id)) ??
        "Someone";
      replyMap.set(String(r.id), {
        id: String(r.id),
        senderName: name,
        body: deleted ? "" : String(r.body ?? ""),
        deleted,
      });
    }
  }

  // 2) Reactions — aggregate per message + emoji, flag the caller's own.
  const reactionMap = new Map<string, Map<string, { count: number; mine: boolean }>>();
  const { data: reactRows } = (await table(sb, "chat_message_reactions")
    .select("message_id, emoji, reactor_kind, reactor_id")
    .in("message_id", ids)) as { data: RawAny[] | null; error: PgError | null };
  for (const r of reactRows ?? []) {
    const mid = String(r.message_id);
    const emoji = String(r.emoji);
    let perMsg = reactionMap.get(mid);
    if (!perMsg) {
      perMsg = new Map();
      reactionMap.set(mid, perMsg);
    }
    const cur = perMsg.get(emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (me && r.reactor_kind === me.kind && String(r.reactor_id) === me.id) {
      cur.mine = true;
    }
    perMsg.set(emoji, cur);
  }

  return msgs.map((m) => {
    const perMsg = reactionMap.get(m.id);
    const reactions: ChatReactionSummary[] = perMsg
      ? Array.from(perMsg.entries()).map(([emoji, v]) => ({
          emoji,
          count: v.count,
          mine: v.mine,
        }))
      : [];
    return {
      ...m,
      replyPreview: m.replyToId ? replyMap.get(m.replyToId) ?? null : null,
      reactions,
    };
  });
}

/**
 * Validate a reply anchor: returns the id only if it's a live (non-deleted)
 * message in the SAME channel and (when threadKey is specified) the same
 * sub-thread. Returns null for a missing/invalid/cross-channel anchor so the
 * message still posts, just without a dangling reply. FAIL SOFT (never throws).
 */
async function validateReplyAnchor(
  sb: ServiceClient,
  replyToId: string | null | undefined,
  channelId: string,
  threadKey: string | null | undefined
): Promise<string | null> {
  if (!replyToId) return null;
  const { data } = (await table(sb, "chat_messages")
    .select("id, channel_id, thread_key, deleted_at")
    .eq("id", replyToId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!data) return null;
  if (String(data.channel_id ?? "") !== channelId) return null;
  if (data.deleted_at) return null;
  // When the caller scopes to a sub-thread, the anchor must be in it too.
  if (threadKey !== undefined) {
    const anchorThread = (data.thread_key as string | null) ?? null;
    if (anchorThread !== threadKey) return null;
  }
  return replyToId;
}

// ─── 1. List channels for an event ──────────────────────────────
// GATED, FAIL CLOSED. Two legitimate callers:
//   * a participant (participantId set) — their access-code session must own
//     that participant for THIS event; they get ONLY the channels they belong
//     to (announcements + their party channel + their committee channel).
//   * an organiser (participantId absent) — must hold canManage on the event;
//     they see all channels.
// Any other caller is denied.

export async function listChannels(
  eventId: string,
  participantId?: string
): Promise<ActionResult<ChatChannel[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!eventId) return { success: false, error: "Missing event." };

  const sb = await createServiceClient();

  let participant: ParticipantChatRow | null = null;
  if (participantId) {
    const auth = await requireParticipantSession(participantId, eventId);
    if (!auth.ok) return { success: false, error: auth.error };
    participant = await loadParticipantChatRow(sb, participantId, eventId);
    if (!participant) {
      return { success: false, error: "Participant not found." };
    }
  } else {
    const access = await getYipEventAccess(eventId);
    if (!access.canManage) {
      return {
        success: false,
        error: "Not authorized to view this event's channels.",
      };
    }
  }

  const { data, error } = (await table(sb, "chat_channels")
    .select(CHANNEL_COLS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };

  if (error) return { success: false, error: error.message };

  const all = (data ?? []).map(toChannel);
  const p = participant;
  return {
    success: true,
    data: p ? all.filter((ch) => channelVisibleToParticipant(ch, p)) : all,
  };
}

// ─── 2. List messages (channel thread OR a student↔YUVA DM thread) ──

// GATED, FAIL CLOSED (same dual gating as listChannels):
//   * channel thread + participantId → the session must own the participant
//     AND the participant must be a member of that channel.
//   * channel thread without participantId → caller must hold canManage on
//     the channel's event.
//   * DM thread → the session must own the participant; the query itself is
//     bound to that participantId so it can never return another student's
//     thread.
// Moderator-removed messages are filtered server-side here; the organiser
// deleted-inclusive view is modListMessages.

type ListMessagesArgs =
  // threadKey scopes a channel read to a clause/amendment sub-thread:
  //   undefined → ALL messages (back-compatible: /yip/me/chat is unchanged)
  //   null      → only the general feed (thread_key IS NULL)
  //   "clause:…"/"amendment:…" → only that thread
  //
  // afterIso = live-poll cursor. When set, only messages with
  // created_at >= afterIso are returned (the boundary row repeats and is
  // de-duplicated client-side by id), so the WhatsApp-style live thread can
  // fetch ONLY what is new every few seconds instead of re-downloading the
  // whole 500-row window. Omit it for the initial full load.
  | {
      channelId: string;
      participantId?: string;
      threadKey?: string | null;
      afterIso?: string;
    }
  | { dmWithVolunteerId: string; participantId: string; afterIso?: string };

export async function listMessages(
  args: ListMessagesArgs
): Promise<ActionResult<ChatMessage[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };

  const sb = await createServiceClient();

  if ("channelId" in args) {
    if (!args.channelId) return { success: false, error: "Missing channel." };

    // Load the channel first — we gate on ITS event, never a caller-supplied one.
    const { data: chRow } = (await table(sb, "chat_channels")
      .select(CHANNEL_COLS)
      .eq("id", args.channelId)
      .maybeSingle()) as { data: RawAny | null; error: PgError | null };

    if (!chRow) return { success: false, error: "Channel not found." };
    const channel = toChannel(chRow);

    let me: ReactorIdentity | null = null;
    if (args.participantId) {
      const auth = await requireParticipantSession(
        args.participantId,
        channel.eventId
      );
      if (!auth.ok) return { success: false, error: auth.error };
      const p = await loadParticipantChatRow(
        sb,
        args.participantId,
        channel.eventId
      );
      if (!p || !channelVisibleToParticipant(channel, p)) {
        return {
          success: false,
          error: "You don't have access to this channel.",
        };
      }
      me = { kind: "student", id: args.participantId };
    } else {
      const access = await getYipEventAccess(channel.eventId);
      if (!access.canManage) {
        return { success: false, error: "Not authorized to read this channel." };
      }
      const uid = await getAuthUserId();
      if (uid) me = { kind: "admin", id: uid };
    }

    let mq = table(sb, "chat_messages")
      .select(MSG_COLS)
      .eq("channel_id", args.channelId)
      .is("deleted_at", null);
    // Per-clause/amendment thread scoping (see ListMessagesArgs).
    if (args.threadKey === null) mq = mq.is("thread_key", null);
    else if (typeof args.threadKey === "string")
      mq = mq.eq("thread_key", args.threadKey);

    // Live-poll delta: only rows at/after the cursor (boundary row de-duped
    // client-side by id). Omitted ⇒ full window (initial load).
    if (args.afterIso) mq = mq.gte("created_at", args.afterIso);

    const { data, error } = (await mq
      .order("created_at", { ascending: true })
      .limit(500)) as { data: RawAny[] | null; error: PgError | null };

    if (error) return { success: false, error: error.message };
    const enriched = await enrichMessages(sb, (data ?? []).map(toMessage), me);
    return { success: true, data: enriched };
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
  //
  // SECURITY (DM-branch audit, 2026-06-12): the session check above binds the
  // caller to `participantId` (requireParticipantSession verifies session.id
  // === participantId), AND the query below filters on
  // sender_participant_id = participantId. Both the cookie AND the query are
  // bound to the same id, so this can never return another student's thread.
  let dmq = table(sb, "chat_messages")
    .select(MSG_COLS)
    .eq("event_id", eventId)
    .eq("sender_participant_id", participantId)
    .eq("dm_to_volunteer_id", dmWithVolunteerId)
    .is("deleted_at", null);

  // Live-poll delta cursor (see ListMessagesArgs.afterIso).
  if (args.afterIso) dmq = dmq.gte("created_at", args.afterIso);

  const { data, error } = (await dmq
    .order("created_at", { ascending: true })
    .limit(500)) as { data: RawAny[] | null; error: PgError | null };

  if (error) return { success: false, error: error.message };
  const enriched = await enrichMessages(
    sb,
    (data ?? []).map(toMessage),
    { kind: "student", id: participantId }
  );
  return { success: true, data: enriched };
}

// ─── 3. Post a message into a group channel ─────────────────────
// A student posts into a channel via their access-code session. (YUVA / admin
// channel posting can be layered on later; the foundation ships the student
// path so the UI is usable.)

export async function postChannelMessage(args: {
  participantId: string;
  channelId: string;
  body: string;
  // Optional clause/amendment sub-thread anchor (null/undefined = general feed).
  threadKey?: string | null;
  // Optional WhatsApp-style reply anchor — must be a non-deleted message in the
  // SAME channel (validated below); ignored otherwise.
  replyToId?: string | null;
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
    .select(CHANNEL_COLS)
    .eq("id", args.channelId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (!ch) return { success: false, error: "Channel not found." };
  const channel = toChannel(ch);
  const eventId = channel.eventId;

  // Verify the access-code session owns this participant for this event.
  const auth = await requireParticipantSession(args.participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  // Membership: a student may only post in channels they belong to (same rule
  // as the read path — announcements + their party + their committee).
  const p = await loadParticipantChatRow(sb, args.participantId, eventId);
  if (!p || !channelVisibleToParticipant(channel, p)) {
    return { success: false, error: "You don't have access to this channel." };
  }

  // Announcements are organiser-broadcast only:
  // students keep READ access (channelVisibleToParticipant is unchanged) but
  // can never post into them. The organiser path is modPostAnnouncement.
  if (channel.kind === "announcement") {
    return { success: false, error: "Only organisers can post announcements." };
  }

  // Moderation state — enforced server-side, FAIL CLOSED.
  if (channel.frozenAt) return { success: false, error: FROZEN_ERROR };
  const mute = await checkMuted(sb, eventId, args.participantId);
  if (!mute.ok) return { success: false, error: mute.error };
  if (mute.muted) return { success: false, error: MUTED_ERROR };

  // Reply anchor — accept only a live message in THIS channel + thread.
  const replyToId = await validateReplyAnchor(
    sb,
    args.replyToId,
    args.channelId,
    args.threadKey ?? null
  );

  const { data, error } = (await table(sb, "chat_messages")
    .insert({
      event_id: eventId,
      channel_id: args.channelId,
      sender_kind: "student",
      sender_participant_id: args.participantId,
      dm_to_volunteer_id: null,
      body,
      thread_key: args.threadKey ?? null,
      reply_to_id: replyToId,
    })
    .select(MSG_COLS)
    .single()) as { data: RawAny | null; error: PgError | null };

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to post." };
  }
  const [enriched] = await enrichMessages(sb, [toMessage(data)], {
    kind: "student",
    id: args.participantId,
  });
  return { success: true, data: enriched };
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

  // Muted students cannot DM either — enforced server-side, FAIL CLOSED.
  const mute = await checkMuted(sb, eventId, participantId);
  if (!mute.ok) return { success: false, error: mute.error };
  if (mute.muted) return { success: false, error: MUTED_ERROR };

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

// ─── 7. Student report ──────────────────────────────────────────
// A student may flag a message THEY CAN SEE for the organisers. First report
// wins (reported_at / reported_by_participant_id are set once); re-reports are
// no-ops that still return success so the UI stays simple.

export async function reportMessage(args: {
  participantId: string;
  eventId: string;
  messageId: string;
}): Promise<ActionResult> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const { participantId, eventId, messageId } = args;
  if (!participantId || !eventId || !messageId) {
    return { success: false, error: "Missing report parameters." };
  }

  const auth = await requireParticipantSession(participantId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };

  const sb = await createServiceClient();

  const { data: msg } = (await table(sb, "chat_messages")
    .select(
      "id, event_id, channel_id, sender_participant_id, dm_to_volunteer_id, reported_at"
    )
    .eq("id", messageId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  // Deny with the same message whether the row is missing or out of scope —
  // a student probing foreign message ids learns nothing.
  if (!msg || String(msg.event_id) !== eventId) {
    return { success: false, error: "Message not found." };
  }

  // The reporter must be able to SEE the message (FAIL CLOSED).
  if (msg.channel_id) {
    const { data: chRow } = (await table(sb, "chat_channels")
      .select(CHANNEL_COLS)
      .eq("id", String(msg.channel_id))
      .maybeSingle()) as { data: RawAny | null; error: PgError | null };
    if (!chRow) return { success: false, error: "Message not found." };
    const p = await loadParticipantChatRow(sb, participantId, eventId);
    if (!p || !channelVisibleToParticipant(toChannel(chRow), p)) {
      return { success: false, error: "Message not found." };
    }
  } else {
    // DM: only messages in the student's OWN thread are visible to them.
    if (String(msg.sender_participant_id ?? "") !== participantId) {
      return { success: false, error: "Message not found." };
    }
  }

  // First report wins; later reports are a no-op success.
  if (msg.reported_at) return { success: true, data: null };

  const { error } = (await table(sb, "chat_messages")
    .update({
      reported_at: new Date().toISOString(),
      reported_by_participant_id: participantId,
    })
    .eq("id", messageId)
    .is("reported_at", null)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ════════════════════════════════════════════════════════════════
// ORGANISER MODERATION SURFACE
// Every mod* action below is flag-gated + getYipEventAccess(eventId).canManage
// gated (requireManage), and every cross-table row is verified against the
// SAME eventId before anything is returned or written — FAIL CLOSED.
// ════════════════════════════════════════════════════════════════

export interface ModChannel extends ChatChannel {
  messageCount: number;
  /** Distinct students who have posted (activity, not membership). */
  activeParticipants: number;
  /** ISO timestamp of the most recent message, or null if none. */
  lastMessageAt: string | null;
  /** Messages flagged by students, awaiting moderation. */
  reportedCount: number;
}

export interface ModMessage {
  id: string;
  channelId: string | null;
  channelName: string | null;
  senderKind: "student" | "yuva" | "admin";
  senderParticipantId: string | null;
  senderVolunteerId: string | null;
  senderName: string;
  body: string;
  dmToVolunteerId: string | null;
  deletedAt: string | null;
  reportedAt: string | null;
  pinnedAt: string | null;
  createdAt: string;
}

export interface ModDmThread {
  participantId: string;
  participantName: string;
  volunteerId: string;
  volunteerName: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ModMutedStudent {
  participantId: string;
  participantName: string;
  reason: string | null;
  createdAt: string;
}

function toModMessage(
  r: RawAny,
  pNames: Map<string, string>,
  vNames: Map<string, string>,
  channelNameById: Map<string, string>
): ModMessage {
  const kind = r.sender_kind as ModMessage["senderKind"];
  const pid = (r.sender_participant_id as string | null) ?? null;
  const vid = (r.sender_volunteer_id as string | null) ?? null;
  const channelId = (r.channel_id as string | null) ?? null;
  let senderName = "Organiser";
  if (kind === "student") senderName = (pid && pNames.get(pid)) || "Student";
  if (kind === "yuva") senderName = (vid && vNames.get(vid)) || "YUVA mentor";
  return {
    id: String(r.id),
    channelId,
    channelName: channelId ? (channelNameById.get(channelId) ?? null) : null,
    senderKind: kind,
    senderParticipantId: pid,
    senderVolunteerId: vid,
    senderName,
    body: String(r.body),
    dmToVolunteerId: (r.dm_to_volunteer_id as string | null) ?? null,
    deletedAt: (r.deleted_at as string | null) ?? null,
    reportedAt: (r.reported_at as string | null) ?? null,
    pinnedAt: (r.pinned_at as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

/** Resolve sender names + channel names for a batch of message rows. */
async function hydrateModMessages(
  sb: ServiceClient,
  eventId: string,
  rows: RawAny[]
): Promise<ModMessage[]> {
  const pIds = [
    ...new Set(
      rows
        .map((r) => (r.sender_participant_id as string | null) ?? null)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const vIds = [
    ...new Set(
      rows
        .map((r) => (r.sender_volunteer_id as string | null) ?? null)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const { pNames, vNames } = await loadNameMaps(sb, pIds, vIds);

  const channelNameById = new Map<string, string>();
  const { data: chans } = (await table(sb, "chat_channels")
    .select("id, name")
    .eq("event_id", eventId)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  for (const c of chans ?? []) channelNameById.set(String(c.id), String(c.name));

  return rows.map((r) => toModMessage(r, pNames, vNames, channelNameById));
}

// ─── 8. Moderation: channels with counts + freeze state ─────────

export async function modListChannels(
  eventId: string
): Promise<ActionResult<ModChannel[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();
  const { data, error } = (await table(sb, "chat_channels")
    .select(CHANNEL_COLS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (error) return { success: false, error: error.message };

  const channels = (data ?? []).map(toChannel);
  const stats = await Promise.all(
    channels.map(async (ch) => {
      const [totalRes, reportedRes, recentRes] = await Promise.all([
        // Accurate total (head count).
        table(sb, "chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id),
        // Flagged messages awaiting moderation.
        table(sb, "chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id)
          .not("reported_at", "is", null),
        // Recent window → last activity + distinct active students.
        table(sb, "chat_messages")
          .select("sender_participant_id, created_at")
          .eq("channel_id", ch.id)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      const recent = (recentRes.data ?? []) as {
        sender_participant_id: string | null;
        created_at: string;
      }[];
      const senders = new Set<string>();
      for (const r of recent) {
        if (r.sender_participant_id) senders.add(r.sender_participant_id);
      }

      return {
        messageCount: totalRes.count ?? 0,
        reportedCount: reportedRes.count ?? 0,
        lastMessageAt: recent[0]?.created_at ?? null,
        activeParticipants: senders.size,
      };
    })
  );

  return {
    success: true,
    data: channels.map((ch, i) => ({ ...ch, ...stats[i] })),
  };
}

// ─── 9. Moderation: full thread (channel OR a student↔YUVA DM) ──
// Includes soft-deleted messages (marked via deletedAt) and reported flags.

export async function modListMessages(
  eventId: string,
  args: { channelId: string } | { participantId: string; volunteerId: string }
): Promise<ActionResult<ModMessage[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();

  let rows: RawAny[] = [];
  if ("channelId" in args) {
    if (!args.channelId) return { success: false, error: "Missing channel." };
    // The channel must belong to the event the caller is authorised on.
    const { data: ch } = (await table(sb, "chat_channels")
      .select("id, event_id")
      .eq("id", args.channelId)
      .maybeSingle()) as { data: RawAny | null; error: PgError | null };
    if (!ch || String(ch.event_id) !== eventId) {
      return { success: false, error: "Channel not found." };
    }

    const { data, error } = (await table(sb, "chat_messages")
      .select(MOD_MSG_COLS)
      .eq("event_id", eventId)
      .eq("channel_id", args.channelId)
      .order("created_at", { ascending: true })
      .limit(1000)) as { data: RawAny[] | null; error: PgError | null };
    if (error) return { success: false, error: error.message };
    rows = data ?? [];
  } else {
    if (!args.participantId || !args.volunteerId) {
      return { success: false, error: "Missing DM thread parameters." };
    }
    const { data, error } = (await table(sb, "chat_messages")
      .select(MOD_MSG_COLS)
      .eq("event_id", eventId)
      .eq("sender_participant_id", args.participantId)
      .eq("dm_to_volunteer_id", args.volunteerId)
      .order("created_at", { ascending: true })
      .limit(1000)) as { data: RawAny[] | null; error: PgError | null };
    if (error) return { success: false, error: error.message };
    rows = data ?? [];
  }

  return { success: true, data: await hydrateModMessages(sb, eventId, rows) };
}

// ─── 10. Moderation: DM oversight list ──────────────────────────
// Distinct student↔YUVA pairs with last-message time, newest first.

export async function modListDmThreads(
  eventId: string
): Promise<ActionResult<ModDmThread[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();
  const { data, error } = (await table(sb, "chat_messages")
    .select("sender_participant_id, dm_to_volunteer_id, created_at")
    .eq("event_id", eventId)
    .not("dm_to_volunteer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000)) as { data: RawAny[] | null; error: PgError | null };
  if (error) return { success: false, error: error.message };

  type Pair = {
    participantId: string;
    volunteerId: string;
    lastMessageAt: string;
    messageCount: number;
  };
  const pairs = new Map<string, Pair>();
  for (const r of data ?? []) {
    const pid = (r.sender_participant_id as string | null) ?? null;
    const vid = (r.dm_to_volunteer_id as string | null) ?? null;
    if (!pid || !vid) continue;
    const key = `${pid}|${vid}`;
    const existing = pairs.get(key);
    if (existing) {
      existing.messageCount += 1;
    } else {
      // Rows arrive newest-first, so the first row per pair IS the last message.
      pairs.set(key, {
        participantId: pid,
        volunteerId: vid,
        lastMessageAt: String(r.created_at),
        messageCount: 1,
      });
    }
  }

  const list = [...pairs.values()];
  const { pNames, vNames } = await loadNameMaps(
    sb,
    [...new Set(list.map((t) => t.participantId))],
    [...new Set(list.map((t) => t.volunteerId))]
  );

  return {
    success: true,
    data: list.map((t) => ({
      ...t,
      participantName: pNames.get(t.participantId) ?? "Student",
      volunteerName: vNames.get(t.volunteerId) ?? "YUVA mentor",
    })),
  };
}

// ─── 11. Moderation: mute / unmute a student ────────────────────

export async function muteStudent(
  eventId: string,
  participantId: string,
  reason?: string
): Promise<ActionResult> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };
  if (!participantId) return { success: false, error: "Missing participant." };

  const sb = await createServiceClient();

  // The participant must belong to the event the caller is authorised on.
  const { data: pRow } = (await table(sb, "participants")
    .select("id, event_id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!pRow) {
    return { success: false, error: "Participant not found on this event." };
  }

  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Not signed in." };

  const { error } = (await table(sb, "chat_mutes").insert({
    event_id: eventId,
    participant_id: participantId,
    muted_by: userId,
    reason: reason?.trim() || null,
  })) as { data: RawAny[] | null; error: PgError | null };

  if (error) {
    // UNIQUE(event_id, participant_id) — already muted is a no-op success.
    if (error.code === "23505") return { success: true, data: null };
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}

export async function unmuteStudent(
  eventId: string,
  participantId: string
): Promise<ActionResult> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };
  if (!participantId) return { success: false, error: "Missing participant." };

  const sb = await createServiceClient();
  const { error } = (await table(sb, "chat_mutes")
    .delete()
    .eq("event_id", eventId)
    .eq("participant_id", participantId)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function listMutedStudents(
  eventId: string
): Promise<ActionResult<ModMutedStudent[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();
  const { data, error } = (await table(sb, "chat_mutes")
    .select("participant_id, reason, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (error) return { success: false, error: error.message };

  const rows = data ?? [];
  const { pNames } = await loadNameMaps(
    sb,
    [...new Set(rows.map((r) => String(r.participant_id)))],
    []
  );

  return {
    success: true,
    data: rows.map((r) => ({
      participantId: String(r.participant_id),
      participantName: pNames.get(String(r.participant_id)) ?? "Student",
      reason: (r.reason as string | null) ?? null,
      createdAt: String(r.created_at),
    })),
  };
}

// ─── 12. Moderation: freeze / unfreeze a channel ────────────────

async function setChannelFrozen(
  eventId: string,
  channelId: string,
  frozen: boolean
): Promise<ActionResult> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };
  if (!channelId) return { success: false, error: "Missing channel." };

  const sb = await createServiceClient();

  // The channel must belong to the event the caller is authorised on.
  const { data: ch } = (await table(sb, "chat_channels")
    .select("id, event_id")
    .eq("id", channelId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!ch || String(ch.event_id) !== eventId) {
    return { success: false, error: "Channel not found." };
  }

  const { error } = (await table(sb, "chat_channels")
    .update({ frozen_at: frozen ? new Date().toISOString() : null })
    .eq("id", channelId)) as { data: RawAny[] | null; error: PgError | null };

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function freezeChannel(
  eventId: string,
  channelId: string
): Promise<ActionResult> {
  return setChannelFrozen(eventId, channelId, true);
}

export async function unfreezeChannel(
  eventId: string,
  channelId: string
): Promise<ActionResult> {
  return setChannelFrozen(eventId, channelId, false);
}

// ─── 13. Moderation: reported-messages queue ────────────────────
// Undeleted messages with reported_at set, newest report first.

export async function listReportedMessages(
  eventId: string
): Promise<ActionResult<ModMessage[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();
  const { data, error } = (await table(sb, "chat_messages")
    .select(MOD_MSG_COLS)
    .eq("event_id", eventId)
    .not("reported_at", "is", null)
    .is("deleted_at", null)
    .order("reported_at", { ascending: false })
    .limit(500)) as { data: RawAny[] | null; error: PgError | null };
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: await hydrateModMessages(sb, eventId, data ?? []),
  };
}

// ─── 14. Moderation: seed the event's channels ──────────────────
// Child-safety review GAP 1: there was no channel-creation path at all, so
// flipping the flag would have shown students an empty chat. This action
// creates the standard channel set for an event:
//   * one `party` channel per yip.parties row (name = the party's name),
//   * one `committee` channel per DISTINCT trimmed non-empty
//     participants.committee_name,
//   * one `announcement` channel ("Announcements").
// IDEMPOTENT: there is no DB unique constraint on (event, kind, binding), so
// dedupe happens HERE — existing channels are read first and any desired
// channel that already exists (same kind + same party_id / trimmed committee
// name; any announcement channel counts) is skipped. Re-running after new
// parties/committees appear tops up the set and never duplicates.

export interface SeedChannelsSummary {
  created: number;
  pruned: number;
  keptWithMessages: number;
  skipped: number;
  total: number;
}

/** Identity of a channel for idempotency purposes (not exported — sync). */
function channelKey(
  kind: string,
  partyId: string | null,
  committeeName: string | null
): string {
  if (kind === "party") return `party|${partyId ?? ""}`;
  if (kind === "committee") return `committee|${(committeeName ?? "").trim()}`;
  return "announcement";
}

export async function seedChatChannels(
  eventId: string
): Promise<ActionResult<SeedChannelsSummary>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await createServiceClient();

  // What already exists for this event (the dedupe baseline).
  const { data: existingRows, error: existingErr } = (await table(
    sb,
    "chat_channels"
  )
    .select("id, kind, party_id, committee_name")
    .eq("event_id", eventId)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (existingErr) return { success: false, error: existingErr.message };

  const existing = new Set<string>();
  for (const r of existingRows ?? []) {
    existing.add(
      channelKey(
        String(r.kind),
        (r.party_id as string | null) ?? null,
        (r.committee_name as string | null) ?? null
      )
    );
  }

  // Desired set: parties …
  const { data: partyRows, error: partyErr } = (await table(sb, "parties")
    .select("id, name")
    .eq("event_id", eventId)
    .order("name", { ascending: true })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (partyErr) return { success: false, error: partyErr.message };

  // … committees (distinct trimmed non-empty committee_name) …
  const { data: pcRows, error: pcErr } = (await table(sb, "participants")
    .select("committee_name")
    .eq("event_id", eventId)
    .not("committee_name", "is", null)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (pcErr) return { success: false, error: pcErr.message };

  const committeeNames = [
    ...new Set(
      (pcRows ?? [])
        .map((r) => String(r.committee_name ?? "").trim())
        .filter((name) => name.length > 0)
    ),
  ].sort();

  // … and one announcements channel.
  type DesiredChannel = {
    kind: ChatChannel["kind"];
    party_id: string | null;
    committee_name: string | null;
    name: string;
  };
  const desired: DesiredChannel[] = [
    ...(partyRows ?? []).map(
      (p): DesiredChannel => ({
        kind: "party",
        party_id: String(p.id),
        committee_name: null,
        name: String(p.name),
      })
    ),
    ...committeeNames.map(
      (name): DesiredChannel => ({
        kind: "committee",
        party_id: null,
        committee_name: name,
        name,
      })
    ),
    {
      kind: "announcement",
      party_id: null,
      committee_name: null,
      name: "Announcements",
    },
  ];

  const toInsert = desired.filter(
    (d) => !existing.has(channelKey(d.kind, d.party_id, d.committee_name))
  );

  if (toInsert.length > 0) {
    const { error } = (await table(sb, "chat_channels").insert(
      toInsert.map((d) => ({ event_id: eventId, ...d }))
    )) as { data: RawAny[] | null; error: PgError | null };
    if (error) return { success: false, error: error.message };
  }

  // Prune ORPHAN party/committee channels — ones that match no CURRENT party /
  // committee. Without this the set is add-only: when a chapter changes its
  // committees after channels were first seeded, the old channels linger forever
  // and mislead (the bug this fixes). Announcements are never pruned. To never
  // lose history, only orphans with ZERO messages are deleted; an orphan that
  // still holds messages is kept and reported so a human can decide.
  const desiredKeys = new Set(
    desired.map((d) => channelKey(d.kind, d.party_id, d.committee_name))
  );
  const orphans = (existingRows ?? []).filter((r) => {
    const kind = String(r.kind);
    if (kind !== "party" && kind !== "committee") return false;
    return !desiredKeys.has(
      channelKey(
        kind,
        (r.party_id as string | null) ?? null,
        (r.committee_name as string | null) ?? null
      )
    );
  });

  let pruned = 0;
  let keptWithMessages = 0;
  for (const o of orphans) {
    const { count } = await table(sb, "chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", String(o.id));
    if ((count ?? 0) > 0) {
      keptWithMessages++;
      continue;
    }
    const { error: delErr } = (await table(sb, "chat_channels")
      .delete()
      .eq("id", String(o.id))) as {
      data: RawAny[] | null;
      error: PgError | null;
    };
    if (delErr) return { success: false, error: delErr.message };
    pruned++;
  }

  return {
    success: true,
    data: {
      created: toInsert.length,
      pruned,
      keptWithMessages,
      skipped: desired.length - toInsert.length,
      total: desired.length,
    },
  };
}

// ─── 15. Moderation: post an announcement ───────────────────────
// Child-safety review GAP 2(b): the organiser broadcast path. Strictly scoped
// to kind="announcement" channels of the gated event — organisers gain NO way
// to post into party/committee channels or DMs through this action.

export async function modPostAnnouncement(
  eventId: string,
  channelId: string,
  body: string
): Promise<ActionResult<ChatMessage>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  const gate = await requireManage(eventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const text = (body ?? "").trim();
  if (!text) return { success: false, error: "Announcement cannot be empty." };
  if (text.length > 2000) {
    return {
      success: false,
      error: "Announcement is too long (max 2000 chars).",
    };
  }
  if (!channelId) return { success: false, error: "Missing channel." };

  const sb = await createServiceClient();

  // The channel must belong to the event the caller is authorised on AND be
  // an announcement channel — both checks FAIL CLOSED.
  const { data: ch } = (await table(sb, "chat_channels")
    .select("id, event_id, kind")
    .eq("id", channelId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!ch || String(ch.event_id) !== eventId) {
    return { success: false, error: "Channel not found." };
  }
  if (String(ch.kind) !== "announcement") {
    return {
      success: false,
      error: "Organisers can only post in the announcements channel.",
    };
  }

  // Audit identity: the acting auth user is stamped on the row (sender_user).
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Not signed in." };

  const { data, error } = (await table(sb, "chat_messages")
    .insert({
      event_id: eventId,
      channel_id: channelId,
      sender_kind: "admin",
      sender_participant_id: null,
      sender_volunteer_id: null,
      sender_user: userId,
      dm_to_volunteer_id: null,
      body: text,
    })
    .select(MSG_COLS)
    .single()) as { data: RawAny | null; error: PgError | null };

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to post." };
  }
  return { success: true, data: toMessage(data) };
}

// ─── Reactions / Pin (WhatsApp-style message actions) ───────────
// Same gating as listMessages: a participant access-code session that can see
// the message's channel, OR an organiser with canManage. Reactions are open to
// either; pin/unpin is organiser-only.

type MessageAccess = {
  channelId: string | null;
  eventId: string;
  threadKey: string | null;
  me: ReactorIdentity;
};

/** Resolve + authorize the caller against a message they want to act on. */
async function resolveMessageAccess(
  sb: ServiceClient,
  messageId: string,
  participantId: string | undefined
): Promise<{ ok: true; ctx: MessageAccess } | { ok: false; error: string }> {
  const { data: m } = (await table(sb, "chat_messages")
    .select(
      "id, event_id, channel_id, thread_key, dm_to_volunteer_id, sender_participant_id, deleted_at"
    )
    .eq("id", messageId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!m) return { ok: false, error: "Message not found." };
  if (m.deleted_at) return { ok: false, error: "That message was removed." };

  const eventId = String(m.event_id);
  const channelId = (m.channel_id as string | null) ?? null;
  const threadKey = (m.thread_key as string | null) ?? null;

  if (participantId) {
    const auth = await requireParticipantSession(participantId, eventId);
    if (!auth.ok) return { ok: false, error: auth.error };

    if (channelId) {
      // Channel message — the participant must be a member of that channel.
      const { data: chRow } = (await table(sb, "chat_channels")
        .select(CHANNEL_COLS)
        .eq("id", channelId)
        .maybeSingle()) as { data: RawAny | null; error: PgError | null };
      if (!chRow) return { ok: false, error: "Channel not found." };
      const channel = toChannel(chRow);
      const p = await loadParticipantChatRow(sb, participantId, eventId);
      if (!p || !channelVisibleToParticipant(channel, p)) {
        return { ok: false, error: "You don't have access to this message." };
      }
    } else {
      // DM message — the caller must own the thread (they are the student side).
      if (String(m.sender_participant_id ?? "") !== participantId) {
        return { ok: false, error: "You don't have access to this message." };
      }
    }
    return {
      ok: true,
      ctx: { channelId, eventId, threadKey, me: { kind: "student", id: participantId } },
    };
  }

  // Organiser path.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { ok: false, error: "Not authorized for this message." };
  }
  const uid = await getAuthUserId();
  if (!uid) return { ok: false, error: "Not signed in." };
  return {
    ok: true,
    ctx: { channelId, eventId, threadKey, me: { kind: "admin", id: uid } },
  };
}

/** Current aggregated reactions for one message, from the caller's view. */
async function reactionsForMessage(
  sb: ServiceClient,
  messageId: string,
  me: ReactorIdentity
): Promise<ChatReactionSummary[]> {
  const { data } = (await table(sb, "chat_message_reactions")
    .select("emoji, reactor_kind, reactor_id")
    .eq("message_id", messageId)) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of data ?? []) {
    const emoji = String(r.emoji);
    const cur = byEmoji.get(emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.reactor_kind === me.kind && String(r.reactor_id) === me.id) {
      cur.mine = true;
    }
    byEmoji.set(emoji, cur);
  }
  return Array.from(byEmoji.entries()).map(([emoji, v]) => ({
    emoji,
    count: v.count,
    mine: v.mine,
  }));
}

/**
 * Toggle the caller's reaction (one of CHAT_REACTION_EMOJIS) on a message.
 * Returns the message's updated reaction summary so the client can patch it
 * immediately. Idempotent per (message, emoji, caller).
 */
export async function toggleReaction(args: {
  messageId: string;
  emoji: string;
  participantId?: string;
}): Promise<ActionResult<ChatReactionSummary[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!args.messageId) return { success: false, error: "Missing message." };
  if (!isAllowedReaction(args.emoji)) {
    return { success: false, error: "That reaction isn't allowed." };
  }

  const sb = await createServiceClient();
  const res = await resolveMessageAccess(sb, args.messageId, args.participantId);
  if (!res.ok) return { success: false, error: res.error };
  const { me } = res.ctx;

  const { data: existing } = (await table(sb, "chat_message_reactions")
    .select("id")
    .eq("message_id", args.messageId)
    .eq("emoji", args.emoji)
    .eq("reactor_kind", me.kind)
    .eq("reactor_id", me.id)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };

  if (existing) {
    const { error } = (await table(sb, "chat_message_reactions")
      .delete()
      .eq("id", String(existing.id))) as { error: PgError | null };
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = (await table(sb, "chat_message_reactions").insert({
      message_id: args.messageId,
      emoji: args.emoji,
      reactor_kind: me.kind,
      reactor_id: me.id,
    })) as { error: PgError | null };
    if (error) return { success: false, error: error.message };
  }

  return { success: true, data: await reactionsForMessage(sb, args.messageId, me) };
}

/** Pin a message to its channel (organiser only). */
export async function pinMessage(args: {
  messageId: string;
}): Promise<ActionResult<null>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!args.messageId) return { success: false, error: "Missing message." };
  const sb = await createServiceClient();
  // Organiser-only: resolve with no participant id forces the canManage gate.
  const res = await resolveMessageAccess(sb, args.messageId, undefined);
  if (!res.ok) return { success: false, error: res.error };
  const { error } = (await table(sb, "chat_messages")
    .update({ pinned_at: new Date().toISOString(), pinned_by: res.ctx.me.id })
    .eq("id", args.messageId)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/** Unpin a message (organiser only). */
export async function unpinMessage(args: {
  messageId: string;
}): Promise<ActionResult<null>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!args.messageId) return { success: false, error: "Missing message." };
  const sb = await createServiceClient();
  const res = await resolveMessageAccess(sb, args.messageId, undefined);
  if (!res.ok) return { success: false, error: res.error };
  const { error } = (await table(sb, "chat_messages")
    .update({ pinned_at: null, pinned_by: null })
    .eq("id", args.messageId)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/**
 * Pinned messages for a channel (newest pin first). Same membership gating as
 * listMessages; threadKey scopes to a sub-thread when given.
 */
export async function listPinnedMessages(args: {
  channelId: string;
  participantId?: string;
  threadKey?: string | null;
}): Promise<ActionResult<ChatMessage[]>> {
  if (!CHAT_ENABLED) return { success: false, error: DISABLED };
  if (!args.channelId) return { success: false, error: "Missing channel." };

  const sb = await createServiceClient();
  const { data: chRow } = (await table(sb, "chat_channels")
    .select(CHANNEL_COLS)
    .eq("id", args.channelId)
    .maybeSingle()) as { data: RawAny | null; error: PgError | null };
  if (!chRow) return { success: false, error: "Channel not found." };
  const channel = toChannel(chRow);

  let me: ReactorIdentity | null = null;
  if (args.participantId) {
    const auth = await requireParticipantSession(args.participantId, channel.eventId);
    if (!auth.ok) return { success: false, error: auth.error };
    const p = await loadParticipantChatRow(sb, args.participantId, channel.eventId);
    if (!p || !channelVisibleToParticipant(channel, p)) {
      return { success: false, error: "You don't have access to this channel." };
    }
    me = { kind: "student", id: args.participantId };
  } else {
    const access = await getYipEventAccess(channel.eventId);
    if (!access.canManage) {
      return { success: false, error: "Not authorized to read this channel." };
    }
    const uid = await getAuthUserId();
    if (uid) me = { kind: "admin", id: uid };
  }

  let mq = table(sb, "chat_messages")
    .select(MSG_COLS)
    .eq("channel_id", args.channelId)
    .is("deleted_at", null)
    .not("pinned_at", "is", null);
  if (args.threadKey === null) mq = mq.is("thread_key", null);
  else if (typeof args.threadKey === "string")
    mq = mq.eq("thread_key", args.threadKey);

  const { data, error } = (await mq.order("pinned_at", { ascending: false })) as {
    data: RawAny[] | null;
    error: PgError | null;
  };
  if (error) return { success: false, error: error.message };
  const enriched = await enrichMessages(sb, (data ?? []).map(toMessage), me);
  return { success: true, data: enriched };
}
