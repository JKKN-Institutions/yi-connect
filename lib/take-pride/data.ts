import "server-only";

import { tpService } from "./supabase";
import { isToken } from "./auth";
import type { TpAgendaItem, TpDelegate, TpMeeting, TpPartner, TpSettings } from "./types";

const DELEGATE_COLS =
  "id, token, badge_code, full_name, chapter, zone, business_name, industry, role_title, needs, offers, partner_meetings_opt_in, checked_in_at, is_sample";

export async function getSettings(): Promise<TpSettings> {
  const { data, error } = await tpService()
    .from("tp_settings")
    .select("member_fee_inr, standard_fee_inr, gst_pct, catalyst_seats, meeting_cap, payment_instructions")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error("Take Pride settings missing: " + (error?.message ?? "no row"));
  return { ...data, gst_pct: Number(data.gst_pct) } as TpSettings;
}

export async function listDelegates(): Promise<TpDelegate[]> {
  const { data, error } = await tpService().from("tp_delegates").select(DELEGATE_COLS).order("full_name").limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TpDelegate[];
}

/** Seats taken = partners who have at least sent payment. */
export async function seatsTaken(): Promise<number> {
  const { count, error } = await tpService()
    .from("tp_partners")
    .select("id", { count: "exact", head: true })
    .in("status", ["payment_submitted", "confirmed"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type AudienceStats = {
  total: number;
  isSample: boolean;
  byNeed: { tag: string; count: number }[];
  byZone: { zone: string; count: number }[];
  byIndustry: { industry: string; count: number }[];
};

export async function getAudienceStats(): Promise<AudienceStats> {
  const ds = await listDelegates();
  const tally = (keys: string[]) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    total: ds.length,
    isSample: ds.some((d) => d.is_sample),
    byNeed: tally(ds.flatMap((d) => d.needs)).map(([tag, count]) => ({ tag, count })),
    byZone: tally(ds.map((d) => d.zone)).map(([zone, count]) => ({ zone, count })),
    byIndustry: tally(ds.map((d) => d.industry)).map(([industry, count]) => ({ industry, count })),
  };
}

export async function getPartnerByToken(token: string): Promise<TpPartner | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService().from("tp_partners").select("*").eq("token", token).maybeSingle();
  return (data as TpPartner | null) ?? null;
}

export async function getDelegateByToken(token: string): Promise<TpDelegate | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService().from("tp_delegates").select(DELEGATE_COLS).eq("token", token).maybeSingle();
  return (data as TpDelegate | null) ?? null;
}

export async function getPartnerMeetings(partnerId: string): Promise<TpMeeting[]> {
  const { data, error } = await tpService().from("tp_meetings").select("*").eq("partner_id", partnerId);
  if (error) throw new Error(error.message);
  return (data ?? []) as TpMeeting[];
}

export type TpLeadRow = { id: string; note: string | null; created_at: string; delegate: TpDelegate };

export async function getPartnerLeads(partnerId: string): Promise<TpLeadRow[]> {
  const { data, error } = await tpService()
    .from("tp_leads")
    .select(`id, note, created_at, delegate:tp_delegates(${DELEGATE_COLS})`)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TpLeadRow[];
}

export type DelegateMeetingRow = TpMeeting & {
  partner: Pick<TpPartner, "business_name" | "member_name" | "chapter" | "industry" | "offers" | "pitch">;
};

export async function getDelegateMeetings(delegateId: string): Promise<DelegateMeetingRow[]> {
  const { data, error } = await tpService()
    .from("tp_meetings")
    .select("*, partner:tp_partners(business_name, member_name, chapter, industry, offers, pitch, status)")
    .eq("delegate_id", delegateId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // Only confirmed partners may reach a delegate.
  return ((data ?? []) as unknown as (DelegateMeetingRow & { partner: { status: string } })[]).filter(
    (m) => m.partner?.status === "confirmed"
  );
}

export async function getAgenda(): Promise<TpAgendaItem[]> {
  const { data, error } = await tpService().from("tp_agenda").select("*").order("day").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as TpAgendaItem[];
}

export type DeskOverview = {
  partners: TpPartner[];
  delegates: number;
  checkedIn: number;
  meetings: { requested: number; accepted: number; declined: number };
  leads: number;
  sampleDelegateToken: string | null;
};

export async function getDeskOverview(): Promise<DeskOverview> {
  const db = tpService();
  const [p, d, c, m, l, s] = await Promise.all([
    db.from("tp_partners").select("*").order("created_at", { ascending: false }),
    db.from("tp_delegates").select("id", { count: "exact", head: true }),
    db.from("tp_delegates").select("id", { count: "exact", head: true }).not("checked_in_at", "is", null),
    db.from("tp_meetings").select("status"),
    db.from("tp_leads").select("id", { count: "exact", head: true }),
    db.from("tp_delegates").select("token").eq("is_sample", true).order("badge_code").limit(1).maybeSingle(),
  ]);
  for (const r of [p, d, c, m, l]) if (r.error) throw new Error(r.error.message);
  const ms = (m.data ?? []) as { status: string }[];
  return {
    partners: (p.data ?? []) as TpPartner[],
    delegates: d.count ?? 0,
    checkedIn: c.count ?? 0,
    meetings: {
      requested: ms.filter((x) => x.status === "requested").length,
      accepted: ms.filter((x) => x.status === "accepted").length,
      declined: ms.filter((x) => x.status === "declined").length,
    },
    leads: l.count ?? 0,
    sampleDelegateToken: (s.data as { token: string } | null)?.token ?? null,
  };
}
