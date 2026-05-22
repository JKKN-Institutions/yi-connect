/**
 * Connections Data Layer (Stutzee Feature 4A)
 *
 * Fetching functions for scan-to-connect networking.
 *
 * Note: We avoid `use cache` here because every query is scoped to the current
 * authenticated member. React's `cache()` gives us request-level dedup, which
 * is the right granularity for this data.
 */

import 'server-only';
import { cache } from 'react';
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from '@/lib/supabase/server';
import type {
  ConnectionEventGroup,
  ConnectionWithMember,
  MyProfileQr,
  PublicConnectProfile,
} from '@/types/connection';

// ============================================================================
// Public scan-landing lookup
// ============================================================================

/**
 * Look up a member by their permanent profile QR token.
 *
 * Returns null if:
 *  - Token not found
 *  - Member has opted out of networking (allow_networking_qr = false)
 *
 * This function uses the anon-key server client (subject to RLS). Because
 * `members` RLS currently restricts SELECT to same-chapter viewers, we use
 * the service-role key here to let cross-chapter scans work — the scan URL
 * is itself a capability (the scanner already has the token), and we only
 * expose a narrow public-safe field set.
 */
export async function getMemberByQrToken(
  token: string
): Promise<PublicConnectProfile | null> {
  if (!token || typeof token !== 'string') return null;

  // Use service-role client so cross-chapter scans work. We manually limit the
  // returned columns to the public-safe set.
  const { createAdminSupabaseClient } = await import('@/lib/supabase/server');
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('members')
    .select(
      `
      id,
      company,
      designation,
      industry,
      linkedin_url,
      allow_networking_qr,
      profile:profiles(
        full_name,
        avatar_url
      ),
      chapter:chapters(
        name
      )
    `
    )
    .eq('profile_qr_token', token)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.allow_networking_qr) return null;

  const profile = (data.profile as any) ?? {};
  const chapter = (data.chapter as any) ?? null;

  return {
    id: data.id,
    full_name: profile.full_name ?? 'Yi Member',
    avatar_url: profile.avatar_url ?? null,
    company: data.company,
    designation: data.designation,
    industry: data.industry,
    linkedin_url: data.linkedin_url,
    chapter_name: chapter?.name ?? null,
  };
}

// ============================================================================
// Current user's QR metadata
// ============================================================================

/**
 * Get the currently-authenticated member's profile QR token + opt-out flag.
 * Request-level cached.
 */
export const getMyProfileQr = cache(
  async (): Promise<MyProfileQr | null> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('members')
      .select('profile_qr_token, allow_networking_qr')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      profile_qr_token: (data as any).profile_qr_token as string,
      allow_networking_qr: (data as any).allow_networking_qr as boolean,
    };
  }
);

// ============================================================================
// Address book — my connections, grouped by event
// ============================================================================

/**
 * Return all connections created by `memberId`, grouped by event (null event
 * becomes its own "No event (direct scan)" group). Each connection includes
 * an `is_mutual` flag set true when the target has also connected back.
 */
export async function getMyConnections(
  memberId: string
): Promise<ConnectionEventGroup[]> {
  if (!memberId) return [];

  // RLS-aware client (member_connections RLS scoped to from/to_member_id = auth.uid()).
  const supabase = await createServerSupabaseClient();
  // Admin client for the member/profile/chapter expansion. The `yi_connect.members`
  // RLS currently has a recursive policy (42P17) that breaks any embed through
  // `members`, so we fetch member metadata via service-role after the RLS-checked
  // member_connections read. We scope every admin lookup by `to_member_id` already
  // owned by the requester (memberId), so no cross-chapter data is leaked.
  const admin = createAdminSupabaseClient();

  // 1. Rows where I am `from` (what I scanned). RLS enforces from_member_id = auth.uid().
  const { data: mine, error: mineErr } = await supabase
    .from('member_connections')
    .select('id, from_member_id, to_member_id, event_id, note, created_at')
    .eq('from_member_id', memberId)
    .order('created_at', { ascending: false });

  if (mineErr) {
    console.error('[getMyConnections] mine error:', {
      message: mineErr.message,
      code: (mineErr as any).code,
      details: (mineErr as any).details,
      hint: (mineErr as any).hint,
    });
    return [];
  }
  const rows = mine ?? [];

  if (rows.length === 0) return [];

  const otherIds = Array.from(
    new Set(rows.map((r: any) => r.to_member_id).filter(Boolean))
  );
  const eventIds = Array.from(
    new Set(rows.map((r: any) => r.event_id).filter(Boolean))
  );

  // 2. Fetch member metadata + profile + chapter via service-role to dodge the
  //    recursive RLS on members. Restricted to the to_member_ids the user owns.
  const [
    { data: membersData },
    { data: profilesData },
    { data: eventsData },
  ] = await Promise.all([
    otherIds.length > 0
      ? admin
          .from('members')
          .select('id, company, designation, linkedin_url, chapter_id')
          .in('id', otherIds as string[])
      : Promise.resolve({ data: [] as any[] }),
    otherIds.length > 0
      ? admin
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', otherIds as string[])
      : Promise.resolve({ data: [] as any[] }),
    eventIds.length > 0
      ? admin
          .from('events')
          .select('id, title, start_date')
          .in('id', eventIds as string[])
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const chapterIds = Array.from(
    new Set(
      (membersData ?? [])
        .map((m: any) => m.chapter_id)
        .filter(Boolean)
    )
  );
  const { data: chaptersData } =
    chapterIds.length > 0
      ? await admin
          .from('chapters')
          .select('id, name')
          .in('id', chapterIds as string[])
      : { data: [] as any[] };

  const memberById = new Map(
    (membersData ?? []).map((m: any) => [m.id, m])
  );
  const profileById = new Map(
    (profilesData ?? []).map((p: any) => [p.id, p])
  );
  const eventById = new Map(
    (eventsData ?? []).map((e: any) => [e.id, e])
  );
  const chapterById = new Map(
    (chaptersData ?? []).map((c: any) => [c.id, c])
  );

  // 3. Compute mutual flags from reverse rows (RLS lets `to` see incoming).
  let reverseSet = new Set<string>();
  if (otherIds.length > 0) {
    const { data: reverse } = await supabase
      .from('member_connections')
      .select('from_member_id, to_member_id')
      .eq('to_member_id', memberId)
      .in('from_member_id', otherIds as string[]);
    reverseSet = new Set(
      (reverse ?? []).map((r: any) => r.from_member_id)
    );
  }

  const enriched: ConnectionWithMember[] = rows.map((r: any) => {
    const tm = memberById.get(r.to_member_id) ?? {};
    const tmProfile = profileById.get(r.to_member_id) ?? {};
    const tmChapter = tm.chapter_id ? chapterById.get(tm.chapter_id) : null;
    const ev = r.event_id ? eventById.get(r.event_id) : null;
    return {
      id: r.id,
      from_member_id: r.from_member_id,
      to_member_id: r.to_member_id,
      event_id: r.event_id,
      note: r.note,
      created_at: r.created_at,
      to_member: {
        id: tm.id ?? r.to_member_id,
        full_name: tmProfile.full_name ?? 'Yi Member',
        avatar_url: tmProfile.avatar_url ?? null,
        company: tm.company ?? null,
        designation: tm.designation ?? null,
        linkedin_url: tm.linkedin_url ?? null,
        chapter_name: tmChapter?.name ?? null,
      },
      event: ev
        ? {
            id: ev.id,
            title: ev.title,
            start_date: ev.start_date,
          }
        : null,
      is_mutual: reverseSet.has(r.to_member_id),
    };
  });

  // Group by event
  const groups = new Map<string, ConnectionEventGroup>();
  for (const c of enriched) {
    const key = c.event_id ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        event_id: c.event_id,
        event_title: c.event?.title ?? null,
        event_date: c.event?.start_date ?? null,
        connections: [],
      });
    }
    groups.get(key)!.connections.push(c);
  }

  // Order: events by date desc, "no event" group last
  const arr = Array.from(groups.values());
  arr.sort((a, b) => {
    if (a.event_id === null) return 1;
    if (b.event_id === null) return -1;
    const da = a.event_date ? new Date(a.event_date).getTime() : 0;
    const db = b.event_date ? new Date(b.event_date).getTime() : 0;
    return db - da;
  });
  return arr;
}

// ============================================================================
// Mutual count between two members (for member detail page)
// ============================================================================

/**
 * Count connections where either direction exists between the two members.
 * Used on `/members/[id]` to show "X mutual connections" (here: how many
 * times A and B have connected to each other).
 */
export async function getMutualConnectionCount(
  memberId1: string,
  memberId2: string
): Promise<number> {
  if (!memberId1 || !memberId2 || memberId1 === memberId2) return 0;
  const supabase = await createServerSupabaseClient();

  const { count, error } = await supabase
    .from('member_connections')
    .select('id', { count: 'exact', head: true })
    .or(
      `and(from_member_id.eq.${memberId1},to_member_id.eq.${memberId2}),and(from_member_id.eq.${memberId2},to_member_id.eq.${memberId1})`
    );

  if (error) {
    console.error('[getMutualConnectionCount] error:', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Has the current user already connected to `targetMemberId`?
 * Used to decide whether to show "Connect" or "Connected" on member detail.
 */
export async function hasConnectedTo(
  fromId: string,
  toId: string
): Promise<boolean> {
  if (!fromId || !toId || fromId === toId) return false;
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from('member_connections')
    .select('id', { count: 'exact', head: true })
    .eq('from_member_id', fromId)
    .eq('to_member_id', toId);
  return (count ?? 0) > 0;
}
