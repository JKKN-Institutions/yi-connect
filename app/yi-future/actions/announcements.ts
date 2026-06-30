"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  requireChapterAdmin,
  requireFutureNationalAdmin,
} from "@/lib/yi-future/auth/require-access";
import { readSession } from "./auth";
import { sendPushToSubject } from "./push";
import type {
  AnnouncementAudience,
  AnnouncementResult,
  DelegateAnnouncement,
  DelegateAnnouncementFeed,
  SentAnnouncement,
} from "./announcements-types";

// announcements / announcement_reads are not in the generated `future` types,
// so detach typing on the service client — the established pattern in this
// codebase (see push.ts, chapter-chairs.ts) for tables the Database type
// doesn't yet model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

// ─── DELIVERY (best-effort web push) ────────────────────────────────
// Only fans out to delegates that actually hold a push subscription, queried
// in bounded chunks so an "everyone" send can't make thousands of per-delegate
// calls. When VAPID is unconfigured (current prod state) sendPushToSubject is
// a no-op, so this stays cheap regardless.
async function pushToDelegates(
  svc: LooseClient,
  delegateIds: string[],
  title: string,
  body: string,
  url: string
): Promise<void> {
  if (delegateIds.length === 0) return;

  const subscribed = new Set<string>();
  for (let i = 0; i < delegateIds.length; i += 200) {
    const chunk = delegateIds.slice(i, i + 200);
    const { data } = await svc
      .schema("future")
      .from("push_subscriptions")
      .select("subject_id")
      .eq("subject_type", "delegate")
      .in("subject_id", chunk);
    for (const r of (data ?? []) as { subject_id: string }[]) {
      subscribed.add(r.subject_id);
    }
  }
  if (subscribed.size === 0) return;

  await Promise.all(
    [...subscribed].map((id) =>
      sendPushToSubject("delegate", id, {
        title,
        body,
        url,
        tag: "yi-future-announcement",
      })
    )
  );
}

// Resolve the delegate ids an announcement reaches (for push fan-out).
async function resolveRecipientIds(
  svc: LooseClient,
  a: {
    edition_id: string;
    audience: AnnouncementAudience;
    chapter_id: string | null;
    team_id: string | null;
    delegate_id: string | null;
    zone?: string | null;
  }
): Promise<string[]> {
  if (a.audience === "delegate") return a.delegate_id ? [a.delegate_id] : [];

  if (a.audience === "team") {
    if (!a.team_id) return [];
    const { data } = await svc
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .eq("team_id", a.team_id);
    return ((data ?? []) as { delegate_id: string }[]).map((r) => r.delegate_id);
  }

  // 'zone' → active delegates in any chapter of that region (Yi zone).
  if (a.audience === "zone") {
    if (!a.zone) return [];
    const { data: chRows } = await svc
      .schema("future")
      .from("chapters")
      .select("id")
      .eq("region", a.zone);
    const chapterIds = ((chRows ?? []) as { id: string }[]).map((c) => c.id);
    if (chapterIds.length === 0) return [];
    const { data } = await svc
      .schema("future")
      .from("delegates")
      .select("id")
      .eq("edition_id", a.edition_id)
      .eq("is_active", true)
      .in("chapter_id", chapterIds);
    return ((data ?? []) as { id: string }[]).map((r) => r.id);
  }

  // 'chapter' or 'everyone' → active delegates scoped by edition (+ chapter).
  let q = svc
    .schema("future")
    .from("delegates")
    .select("id")
    .eq("edition_id", a.edition_id)
    .eq("is_active", true);
  if (a.audience === "chapter" && a.chapter_id) {
    q = q.eq("chapter_id", a.chapter_id);
  }
  const { data } = await q;
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

// ─── CREATE (chapter admin → own delegates) ─────────────────────────
export async function createChapterAnnouncement(
  args: { chapterId: string; editionId: string; authorLabel: string },
  formData: FormData
): Promise<AnnouncementResult> {
  // Chapter-scope gate: a chair of chapter A cannot post under chapter B.
  await requireChapterAdmin(args.chapterId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const audienceRaw = String(formData.get("audience") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const teamId = String(formData.get("team_id") ?? "").trim() || null;
  const delegateId = String(formData.get("delegate_id") ?? "").trim() || null;

  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Message is required." };

  // Chapter admins may target their whole chapter, one team, or one delegate —
  // never "everyone" (that's a national action).
  const allowed: AnnouncementAudience[] = ["chapter", "team", "delegate"];
  if (!allowed.includes(audienceRaw as AnnouncementAudience)) {
    return { ok: false, error: "Pick who should receive this." };
  }
  const audience = audienceRaw as AnnouncementAudience;

  const svc = (await createServiceClient()) as LooseClient;

  // Validate the target belongs to this chapter (fail closed on mismatch).
  if (audience === "team") {
    if (!teamId) return { ok: false, error: "Select a team." };
    const { data: team } = await svc
      .schema("future")
      .from("teams")
      .select("chapter_id")
      .eq("id", teamId)
      .maybeSingle();
    if (!team || team.chapter_id !== args.chapterId) {
      return { ok: false, error: "That team is not in your chapter." };
    }
  }
  if (audience === "delegate") {
    if (!delegateId) return { ok: false, error: "Select a delegate." };
    const { data: del } = await svc
      .schema("future")
      .from("delegates")
      .select("chapter_id")
      .eq("id", delegateId)
      .maybeSingle();
    if (!del || del.chapter_id !== args.chapterId) {
      return { ok: false, error: "That delegate is not in your chapter." };
    }
  }

  const row = {
    edition_id: args.editionId,
    author_user_id: user?.id ?? null,
    author_name: args.authorLabel,
    author_scope: "chapter",
    audience,
    chapter_id: args.chapterId,
    team_id: audience === "team" ? teamId : null,
    delegate_id: audience === "delegate" ? delegateId : null,
    title,
    body,
    url,
  };

  const { data: inserted, error } = await svc
    .schema("future")
    .from("announcements")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const recipients = await resolveRecipientIds(svc, row);
  await pushToDelegates(
    svc,
    recipients,
    args.authorLabel,
    title,
    "/yi-future/me/announcements"
  );

  revalidatePath("/yi-future/chapter/announcements");
  void inserted;
  return {
    ok: true,
    message: `Announcement sent to ${recipients.length} delegate${
      recipients.length === 1 ? "" : "s"
    }.`,
  };
}

// ─── CREATE (national admin → everyone / one chapter) ───────────────
export async function createNationalAnnouncement(
  args: { editionId: string },
  formData: FormData
): Promise<AnnouncementResult> {
  await requireFutureNationalAdmin();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const audienceRaw = String(formData.get("audience") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const chapterId = String(formData.get("chapter_id") ?? "").trim() || null;
  const zone = String(formData.get("zone") ?? "").trim() || null;

  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Message is required." };

  const allowed: AnnouncementAudience[] = ["everyone", "chapter", "zone"];
  if (!allowed.includes(audienceRaw as AnnouncementAudience)) {
    return { ok: false, error: "Pick who should receive this." };
  }
  const audience = audienceRaw as AnnouncementAudience;
  if (audience === "chapter" && !chapterId) {
    return { ok: false, error: "Select a chapter." };
  }
  if (audience === "zone" && !zone) {
    return { ok: false, error: "Select a zone." };
  }

  const svc = (await createServiceClient()) as LooseClient;

  const row = {
    edition_id: args.editionId,
    author_user_id: user?.id ?? null,
    author_name: "Yi Future National",
    author_scope: "national",
    audience,
    chapter_id: audience === "chapter" ? chapterId : null,
    team_id: null,
    delegate_id: null,
    zone: audience === "zone" ? zone : null,
    title,
    body,
    url,
  };

  const { error } = await svc
    .schema("future")
    .from("announcements")
    .insert(row);
  if (error) return { ok: false, error: error.message };

  const recipients = await resolveRecipientIds(svc, row);
  await pushToDelegates(
    svc,
    recipients,
    "Yi Future National",
    title,
    "/yi-future/me/announcements"
  );

  revalidatePath("/yi-future/national/admin/announcements");
  return {
    ok: true,
    message: `Announcement sent to ${recipients.length} delegate${
      recipients.length === 1 ? "" : "s"
    }.`,
  };
}

// ─── DELETE (author scope) ──────────────────────────────────────────
export async function deleteAnnouncement(id: string): Promise<AnnouncementResult> {
  if (!id) return { ok: false, error: "Missing id." };
  const svc = (await createServiceClient()) as LooseClient;
  const { data: row } = await svc
    .schema("future")
    .from("announcements")
    .select("author_scope, chapter_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Announcement not found." };

  if (row.author_scope === "national") {
    await requireFutureNationalAdmin();
  } else {
    await requireChapterAdmin(row.chapter_id ?? null);
  }

  const { error } = await svc
    .schema("future")
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/announcements");
  revalidatePath("/yi-future/national/admin/announcements");
  return { ok: true, message: "Deleted." };
}

// ─── ADMIN HISTORY ──────────────────────────────────────────────────
async function withReadCounts(
  svc: LooseClient,
  rows: Omit<SentAnnouncement, "read_count">[]
): Promise<SentAnnouncement[]> {
  return Promise.all(
    rows.map(async (r) => {
      const { count } = await svc
        .schema("future")
        .from("announcement_reads")
        .select("delegate_id", { count: "exact", head: true })
        .eq("announcement_id", r.id);
      return { ...r, read_count: count ?? 0 };
    })
  );
}

export async function listChapterAnnouncements(
  chapterId: string,
  editionId: string
): Promise<SentAnnouncement[]> {
  const svc = (await createServiceClient()) as LooseClient;
  const { data } = await svc
    .schema("future")
    .from("announcements")
    .select(
      "id, title, body, audience, author_name, author_scope, chapter_id, team_id, delegate_id, created_at"
    )
    .eq("edition_id", editionId)
    .eq("chapter_id", chapterId)
    .eq("author_scope", "chapter")
    .order("created_at", { ascending: false });
  return withReadCounts(svc, (data ?? []) as Omit<SentAnnouncement, "read_count">[]);
}

export async function listNationalAnnouncements(
  editionId: string
): Promise<SentAnnouncement[]> {
  const svc = (await createServiceClient()) as LooseClient;
  const { data } = await svc
    .schema("future")
    .from("announcements")
    .select(
      "id, title, body, audience, author_name, author_scope, chapter_id, team_id, delegate_id, created_at"
    )
    .eq("edition_id", editionId)
    .eq("author_scope", "national")
    .order("created_at", { ascending: false });
  return withReadCounts(svc, (data ?? []) as Omit<SentAnnouncement, "read_count">[]);
}

// ─── DELEGATE FEED ──────────────────────────────────────────────────
// Returns announcements visible to the signed-in delegate, newest first, each
// flagged read/unread. Fetches the candidate set with a cheap edition+chapter
// filter, then narrows team/delegate targeting in JS against the delegate's own
// membership (announcement volume per edition is small).
export async function getDelegateAnnouncementFeed(): Promise<DelegateAnnouncementFeed> {
  const session = await readSession();
  if (!session || session.type !== "delegate") return { items: [], unread: 0 };

  const svc = (await createServiceClient()) as LooseClient;

  const { data: me } = await svc
    .schema("future")
    .from("delegates")
    .select("id, chapter_id, team_members(team_id)")
    .eq("id", session.id)
    .maybeSingle();
  if (!me) return { items: [], unread: 0 };

  const myChapterId: string | null = me.chapter_id ?? null;
  const myTeamIds = new Set<string>(
    ((me.team_members ?? []) as { team_id: string }[]).map((t) => t.team_id)
  );

  // The delegate's region (Yi zone) — for zone-targeted national announcements.
  let myRegion: string | null = null;
  if (myChapterId) {
    const { data: ch } = await svc
      .schema("future")
      .from("chapters")
      .select("region")
      .eq("id", myChapterId)
      .maybeSingle();
    myRegion = (ch as { region: string | null } | null)?.region ?? null;
  }

  // Candidates: this edition, and either edition-wide (chapter_id null) or my
  // chapter. Covers everyone / chapter / team / delegate (the latter three all
  // carry the author's chapter_id, which is mine when it concerns me).
  let q = svc
    .schema("future")
    .from("announcements")
    .select(
      "id, title, body, url, author_name, author_scope, audience, chapter_id, team_id, delegate_id, zone, created_at"
    )
    .eq("edition_id", session.edition_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (myChapterId) {
    q = q.or(`chapter_id.is.null,chapter_id.eq.${myChapterId}`);
  } else {
    q = q.is("chapter_id", null);
  }
  const { data: rows } = await q;

  type Row = {
    id: string;
    title: string;
    body: string;
    url: string | null;
    author_name: string | null;
    author_scope: "chapter" | "national";
    audience: AnnouncementAudience;
    chapter_id: string | null;
    team_id: string | null;
    delegate_id: string | null;
    zone: string | null;
    created_at: string;
  };

  const visible = ((rows ?? []) as Row[]).filter((r) => {
    if (r.audience === "everyone") return true;
    if (r.audience === "chapter") return r.chapter_id === myChapterId;
    if (r.audience === "team") return !!r.team_id && myTeamIds.has(r.team_id);
    if (r.audience === "delegate") return r.delegate_id === session.id;
    if (r.audience === "zone") return !!myRegion && r.zone === myRegion;
    return false;
  });

  // Read receipts for these announcements.
  const ids = visible.map((r) => r.id);
  const readSet = new Set<string>();
  if (ids.length > 0) {
    const { data: reads } = await svc
      .schema("future")
      .from("announcement_reads")
      .select("announcement_id")
      .eq("delegate_id", session.id)
      .in("announcement_id", ids);
    for (const r of (reads ?? []) as { announcement_id: string }[]) {
      readSet.add(r.announcement_id);
    }
  }

  const items: DelegateAnnouncement[] = visible.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    author_name: r.author_name,
    author_scope: r.author_scope,
    audience: r.audience,
    created_at: r.created_at,
    read: readSet.has(r.id),
  }));

  return { items, unread: items.filter((i) => !i.read).length };
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const session = await readSession();
  if (!session || session.type !== "delegate" || !id) return;
  const svc = (await createServiceClient()) as LooseClient;
  await svc
    .schema("future")
    .from("announcement_reads")
    .upsert(
      { announcement_id: id, delegate_id: session.id },
      { onConflict: "announcement_id,delegate_id" }
    );
  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/announcements");
}

export async function markAllAnnouncementsRead(): Promise<void> {
  const session = await readSession();
  if (!session || session.type !== "delegate") return;
  const { items } = await getDelegateAnnouncementFeed();
  const unread = items.filter((i) => !i.read);
  if (unread.length === 0) return;
  const svc = (await createServiceClient()) as LooseClient;
  await svc
    .schema("future")
    .from("announcement_reads")
    .upsert(
      unread.map((i) => ({ announcement_id: i.id, delegate_id: session.id })),
      { onConflict: "announcement_id,delegate_id" }
    );
  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/announcements");
}
