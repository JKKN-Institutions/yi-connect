import "server-only";

import { tpService } from "./supabase";
import { isToken } from "./auth";
import { getPartnerByToken } from "./data";
import type { TpPartner } from "./types";

/*
 * Catalyst Partner helpers added by take_pride_05:
 *  - member / standard price, decided on the server against yi_directory.people
 *  - team scanners (tp_partner_team): up to TEAM_MAX extra people per partner
 *  - cancellations (tp_partners.cancelled_at / cancel_note / refund_decision)
 */

export const TEAM_MAX = 2;

export type RefundDecision = "refund_due" | "no_refund" | "credit";

/** tp_partners with the take_pride_05 columns (select("*") already returns them). */
export type CatalystPartner = TpPartner & {
  member_person_id: string | null;
  cancelled_at: string | null;
  cancel_note: string | null;
  refund_decision: RefundDecision | null;
};

export type TeamMember = { id: string; partner_id: string; name: string; token: string; active: boolean; created_at: string };

export async function getCatalystPartner(token: string): Promise<CatalystPartner | null> {
  return (await getPartnerByToken(token)) as CatalystPartner | null;
}

/**
 * Seats taken = REAL partners who have at least sent payment and are NOT
 * cancelled. Sample (demo) partners never hold a seat.
 */
export async function seatsTakenActive(): Promise<number> {
  const { count, error } = await tpService()
    .from("tp_partners")
    .select("id", { count: "exact", head: true })
    .eq("is_sample", false)
    .in("status", ["payment_submitted", "confirmed"])
    .is("cancelled_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ------------------------------------------------------- member price ----

const normEmail = (s: string) => s.trim().toLowerCase();
const last10 = (s: string | null | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

/**
 * Is this applicant in the Yi member list? READ-ONLY on yi_directory.people:
 * an ACTIVE person whose email matches (lower/trim) or whose mobile has the
 * same last 10 digits. Returns the person id (the canonical one when the row
 * was merged) or null. Never says anything about other people: the caller
 * only learns "matched you" or "did not".
 *
 * The filters are deliberately loose (ilike / suffix) and the exact rule is
 * applied here in code, so odd stored formats ("+91 98765 43210", stray
 * capitals or spaces) still match. Fails CLOSED to "no match" (the standard
 * price) if the directory cannot be read; an organiser can still correct it.
 */
export async function findYiMember(email: string, phone: string): Promise<string | null> {
  const db = tpService().schema("yi_directory");
  const wantEmail = normEmail(email);
  const wantPhone = last10(phone);
  type Row = { id: string; email: string | null; phone: string | null; merged_into: string | null };
  const pick = (rows: Row[] | null, ok: (r: Row) => boolean) => {
    const r = (rows ?? []).find(ok);
    return r ? r.merged_into ?? r.id : null;
  };

  if (wantEmail) {
    const { data, error } = await db
      .from("people")
      .select("id, email, phone, merged_into")
      .eq("is_active", true)
      .ilike("email", `%${wantEmail}%`)
      .limit(50);
    const hit = error ? null : pick(data as Row[] | null, (r) => !!r.email && normEmail(r.email) === wantEmail);
    if (hit) return hit;
  }
  if (wantPhone) {
    const { data, error } = await db
      .from("people")
      .select("id, email, phone, merged_into")
      .eq("is_active", true)
      .like("phone", `%${wantPhone.slice(-4)}`)
      .limit(500);
    const hit = error ? null : pick(data as Row[] | null, (r) => last10(r.phone) === wantPhone);
    if (hit) return hit;
  }
  return null;
}

// -------------------------------------------------------------- team ----

export async function listTeam(partnerId: string): Promise<TeamMember[]> {
  const { data, error } = await tpService()
    .from("tp_partner_team")
    .select("id, partner_id, name, token, active, created_at")
    .eq("partner_id", partnerId)
    .eq("active", true)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

export async function getTeamMemberByToken(token: string): Promise<TeamMember | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService()
    .from("tp_partner_team")
    .select("id, partner_id, name, token, active, created_at")
    .eq("token", token)
    .maybeSingle();
  return (data as TeamMember | null) ?? null;
}

export async function getPartnerById(id: string): Promise<CatalystPartner | null> {
  const { data } = await tpService().from("tp_partners").select("*").eq("id", id).maybeSingle();
  return (data as CatalystPartner | null) ?? null;
}

/**
 * Who is scanning: the partner owner (partner token) or an ACTIVE team member
 * (team token). The partner is always resolved on the server. A removed team
 * member resolves to null, the same as an unknown link.
 */
export type Scanner = { partner: CatalystPartner; team: TeamMember | null };

export async function resolveScanner(token: string): Promise<Scanner | null> {
  if (!isToken(token)) return null;
  const partner = await getCatalystPartner(token);
  if (partner) return { partner, team: null };
  const team = await getTeamMemberByToken(token);
  if (!team || !team.active) return null;
  const owner = await getPartnerById(team.partner_id);
  return owner ? { partner: owner, team } : null;
}

export type TeamLeadRow = {
  id: string;
  note: string | null;
  created_at: string;
  delegate: { full_name: string; chapter: string; business_name: string | null; industry: string } | null;
};

/** Only the leads THIS team member scanned. */
export async function getTeamMemberLeads(teamId: string): Promise<TeamLeadRow[]> {
  const { data, error } = await tpService()
    .from("tp_leads")
    .select("id, note, created_at, delegate:tp_delegates(full_name, chapter, business_name, industry)")
    .eq("scanned_by_team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TeamLeadRow[];
}

/** lead id -> team member name, for the partner's own lead list. */
export async function leadScannerNames(partnerId: string): Promise<Map<string, string>> {
  const { data } = await tpService()
    .from("tp_leads")
    .select("id, team:tp_partner_team(name)")
    .eq("partner_id", partnerId)
    .not("scanned_by_team_id", "is", null);
  const m = new Map<string, string>();
  for (const r of (data ?? []) as unknown as { id: string; team: { name: string } | null }[]) {
    if (r.team?.name) m.set(r.id, r.team.name);
  }
  return m;
}
