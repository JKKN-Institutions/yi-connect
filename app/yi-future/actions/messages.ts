"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "./auth";
import {
  sendMessageCore,
  listMessagesCore,
  type SenderType as SharedSenderType,
  type Message as SharedMessage,
} from "@/lib/messaging/actions";

// ─── TYPES ──────────────────────────────────────────────────────────
// Re-export the shared types so existing consumers keep working unchanged.
export type SenderType = SharedSenderType;
export type Message = SharedMessage;

export type Thread = {
  id: string;
  team_id: string;
  mentor_id: string;
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

export type ActionResult<T = void> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

// ─── ACCESS HELPERS ─────────────────────────────────────────────────

/**
 * Returns true if delegate is on the team that owns this thread,
 * OR is the mentor for this thread (when called as mentor).
 */
async function callerCanAccessThread(threadId: string): Promise<{
  ok: boolean;
  threadRow?: Thread;
  caller?: {
    type: SenderType;
    id: string;
    name: string;
  };
}> {
  const session = await readSession();
  if (!session) return { ok: false };
  if (session.type !== "delegate" && session.type !== "mentor") {
    return { ok: false };
  }

  const svc = await createServiceClient();
  const { data: thread } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select("id, team_id, mentor_id, created_at, last_message_at")
    .eq("id", threadId)
    .maybeSingle()) as unknown as { data: Thread | null };

  if (!thread) return { ok: false };

  if (session.type === "mentor") {
    if (thread.mentor_id !== session.id) return { ok: false };
    return {
      ok: true,
      threadRow: thread,
      caller: {
        type: "mentor",
        id: session.id,
        name: session.name ?? "Mentor",
      },
    };
  }

  // delegate — must be a member of this team
  const { data: member } = (await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", thread.team_id)
    .eq("delegate_id", session.id)
    .maybeSingle()) as unknown as { data: { delegate_id: string } | null };

  if (!member) return { ok: false };

  return {
    ok: true,
    threadRow: thread,
    caller: {
      type: "delegate",
      id: session.id,
      name: session.name ?? "Delegate",
    },
  };
}

// ─── GET OR CREATE THREAD ───────────────────────────────────────────

export async function getOrCreateThread(
  teamId: string,
  mentorId: string
): Promise<ActionResult<Thread>> {
  const session = await readSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const svc = await createServiceClient();

  // Look up existing
  const { data: existing } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select("id, team_id, mentor_id, created_at, last_message_at")
    .eq("team_id", teamId)
    .eq("mentor_id", mentorId)
    .maybeSingle()) as unknown as { data: Thread | null };

  if (existing) return { ok: true, data: existing };

  const { data: inserted, error } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .insert({ team_id: teamId, mentor_id: mentorId } as never)
    .select("id, team_id, mentor_id, created_at, last_message_at")
    .maybeSingle()) as unknown as {
    data: Thread | null;
    error: { message: string } | null;
  };

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Could not create thread." };
  }
  return { ok: true, data: inserted };
}

// ─── SEND MESSAGE ───────────────────────────────────────────────────

export async function sendMessage(
  threadId: string,
  body: string
): Promise<ActionResult<Message>> {
  const access = await callerCanAccessThread(threadId);
  if (!access.ok || !access.caller || !access.threadRow) {
    return { ok: false, error: "Not authorized to post on this thread." };
  }

  // Delegate to shared core (handles insert + thread timestamp bump)
  const coreResult = await sendMessageCore(threadId, access.caller, body);
  if (!coreResult.ok) return coreResult;

  const trimmed = body.trim();

  // Yi Future-specific: notification log entry — recipient is the OTHER side
  const svc = await createServiceClient();
  const recipientType: SenderType =
    access.caller.type === "mentor" ? "delegate" : "mentor";

  // Best-effort lookup of recipient email for the log
  let recipientEmail = "unknown@yifuture.local";
  let recipientSubjectId: string | null = null;
  try {
    if (recipientType === "mentor") {
      const { data: m } = (await svc
        .schema("future")
        .from("mentors")
        .select("id, email")
        .eq("id", access.threadRow.mentor_id)
        .maybeSingle()) as unknown as {
        data: { id: string; email: string | null } | null;
      };
      if (m) {
        recipientSubjectId = m.id;
        if (m.email) recipientEmail = m.email;
      }
    } else {
      // notify the team captain (best proxy for "team")
      const { data: team } = (await svc
        .schema("future")
        .from("teams")
        .select("captain_id")
        .eq("id", access.threadRow.team_id)
        .maybeSingle()) as unknown as {
        data: { captain_id: string | null } | null;
      };
      if (team?.captain_id) {
        const { data: d } = (await svc
          .schema("future")
          .from("delegates")
          .select("id, email")
          .eq("id", team.captain_id)
          .maybeSingle()) as unknown as {
          data: { id: string; email: string | null } | null;
        };
        if (d) {
          recipientSubjectId = d.id;
          if (d.email) recipientEmail = d.email;
        }
      }
    }
  } catch {
    // log lookup is best-effort; never fail the send
  }

  await svc
    .schema("future")
    .from("notification_log" as never)
    .insert({
      trigger_type: "custom",
      recipient_email: recipientEmail,
      recipient_subject_type: recipientType,
      recipient_subject_id: recipientSubjectId,
      subject_line: `New message from ${access.caller.name}`,
      body_preview: trimmed.slice(0, 140),
      status: "pending",
    } as never);

  revalidatePath("/yi-future/mentor/messages");
  revalidatePath("/yi-future/me/messages");

  return coreResult;
}

// ─── LIST MESSAGES ──────────────────────────────────────────────────

export async function listMessages(
  threadId: string,
  limit = 200
): Promise<ActionResult<Message[]>> {
  const access = await callerCanAccessThread(threadId);
  if (!access.ok) {
    return { ok: false, error: "Not authorized to read this thread." };
  }

  // Delegate to shared core (handles query + sender name resolution)
  return listMessagesCore(threadId, limit);
}

// ─── LIST THREADS (mentor side) ─────────────────────────────────────

export async function listThreadsForMentor(
  mentorId: string
): Promise<ActionResult<ThreadListItem[]>> {
  const session = await readSession();
  if (!session || session.type !== "mentor" || session.id !== mentorId) {
    return { ok: false, error: "Not authorized." };
  }

  const svc = await createServiceClient();

  const { data: threads } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select("id, team_id, mentor_id, created_at, last_message_at, teams(team_name)")
    .eq("mentor_id", mentorId)
    .order("last_message_at", { ascending: false })) as unknown as {
    data:
      | (Thread & { teams: { team_name: string } | null })[]
      | null;
  };

  const list = threads ?? [];
  return { ok: true, data: await enrichWithLastMessage(list, "mentor") };
}

// ─── LIST THREADS (delegate / team side) ────────────────────────────

export async function listThreadsForTeam(
  teamId: string
): Promise<ActionResult<ThreadListItem[]>> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Not authorized." };
  }

  const svc = await createServiceClient();

  // Verify caller is on this team
  const { data: member } = (await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", teamId)
    .eq("delegate_id", session.id)
    .maybeSingle()) as unknown as { data: { delegate_id: string } | null };
  if (!member) return { ok: false, error: "Not on this team." };

  const { data: threads } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select(
      "id, team_id, mentor_id, created_at, last_message_at, mentors(full_name), teams(team_name)"
    )
    .eq("team_id", teamId)
    .order("last_message_at", { ascending: false })) as unknown as {
    data:
      | (Thread & {
          mentors: { full_name: string | null } | null;
          teams: { team_name: string } | null;
        })[]
      | null;
  };

  const list = threads ?? [];
  return { ok: true, data: await enrichWithLastMessage(list, "delegate") };
}

// ─── HELPER: attach mentor/team names + last message preview ────────

async function enrichWithLastMessage(
  threads: Array<
    Thread & {
      mentors?: { full_name: string | null } | null;
      teams?: { team_name: string } | null;
    }
  >,
  perspective: SenderType
): Promise<ThreadListItem[]> {
  if (threads.length === 0) return [];

  const svc = await createServiceClient();
  const ids = threads.map((t) => t.id);

  // Pull a small slice of recent messages and pick the latest per thread
  const { data: recent } = (await svc
    .schema("future")
    .from("messages" as never)
    .select("thread_id, sender_type, body, created_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: false })
    .limit(ids.length * 4)) as unknown as {
    data:
      | {
          thread_id: string;
          sender_type: SenderType;
          body: string;
          created_at: string;
        }[]
      | null;
  };

  const lastByThread = new Map<
    string,
    { sender_type: SenderType; body: string }
  >();
  for (const r of recent ?? []) {
    if (!lastByThread.has(r.thread_id)) {
      lastByThread.set(r.thread_id, {
        sender_type: r.sender_type,
        body: r.body,
      });
    }
  }

  // For mentor perspective we still need team names (already joined),
  // for delegate perspective we need mentor names (already joined).
  // If perspective is mentor and mentors weren't joined, fetch them.
  let mentorNameMap = new Map<string, string>();
  if (perspective === "mentor") {
    const mentorIds = Array.from(new Set(threads.map((t) => t.mentor_id)));
    const { data: ms } = (await svc
      .schema("future")
      .from("mentors")
      .select("id, full_name")
      .in("id", mentorIds)) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    mentorNameMap = new Map(
      (ms ?? []).map((m) => [m.id, m.full_name ?? "Mentor"])
    );
  }

  return threads.map((t) => {
    const last = lastByThread.get(t.id) ?? null;
    return {
      id: t.id,
      team_id: t.team_id,
      mentor_id: t.mentor_id,
      team_name: t.teams?.team_name ?? "Team",
      mentor_name:
        t.mentors?.full_name ??
        mentorNameMap.get(t.mentor_id) ??
        "Mentor",
      last_message_at: t.last_message_at,
      last_message_preview: last ? last.body.slice(0, 80) : null,
      last_message_sender_type: last ? last.sender_type : null,
    };
  });
}
