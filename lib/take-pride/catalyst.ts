import "server-only";

import { createHmac } from "node:crypto";
import { callerIp } from "@/lib/yi-future/registration-guard";
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
export type MemberMatch = "email" | "phone";

export type CatalystPartner = TpPartner & {
  member_person_id: string | null;
  member_match: MemberMatch | null;
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
 * was merged) and HOW it matched, or null. The applicant only ever sees the
 * price; the person and the match method are shown to real organisers on the
 * desk so a wrong match can be caught before a payment is confirmed.
 *
 * The filters are deliberately loose (ilike / suffix) and the exact rule is
 * applied here in code, so odd stored formats ("+91 98765 43210", stray
 * capitals or spaces) still match. Fails CLOSED to "no match" (the standard
 * price) if the directory cannot be read; an organiser can still correct it.
 */
export async function findYiMember(email: string, phone: string): Promise<{ personId: string; via: MemberMatch } | null> {
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
    if (hit) return { personId: hit, via: "email" };
  }
  if (wantPhone) {
    const { data, error } = await db
      .from("people")
      .select("id, email, phone, merged_into")
      .eq("is_active", true)
      .like("phone", `%${wantPhone.slice(-4)}`)
      .limit(500);
    const hit = error ? null : pick(data as Row[] | null, (r) => last10(r.phone) === wantPhone);
    if (hit) return { personId: hit, via: "phone" };
  }
  return null;
}

/**
 * For the REAL organiser desk only (never review mode, never the partner):
 * who each member-price sign-up matched, and whether that person holds any
 * active Yi role. "In the directory but no Yi role" covers bulk-imported
 * accounts, YIP / Yi-Future participants and students, so the organiser
 * should check those before confirming. READ-ONLY on yi_directory.
 */
export type MemberMatchInfo = { name: string; hasRole: boolean };

export async function memberMatchDetails(personIds: string[]): Promise<Map<string, MemberMatchInfo>> {
  const ids = [...new Set(personIds.filter(Boolean))];
  const out = new Map<string, MemberMatchInfo>();
  if (!ids.length) return out;
  const db = tpService().schema("yi_directory");
  const [people, roles] = await Promise.all([
    db.from("people").select("id, full_name").in("id", ids),
    db.from("role_assignments").select("person_id").in("person_id", ids).eq("is_active", true),
  ]);
  const withRole = new Set(((roles.data ?? []) as { person_id: string }[]).map((r) => r.person_id));
  for (const p of (people.data ?? []) as { id: string; full_name: string | null }[]) {
    out.set(p.id, { name: p.full_name || "(no name on record)", hasRole: roles.error ? false : withRole.has(p.id) });
  }
  return out;
}

// ----------------------------------------------------- sign-up limits ----

/** Sign-ups allowed from one network in a rolling hour, and platform-wide. */
export const SIGNUP_LIMIT_PER_IP_PER_HOUR = 6;
export const SIGNUP_LIMIT_PER_HOUR = 60;
export const SIGNUP_LIMIT_MESSAGE =
  "Too many sign-ups were tried from here in the last hour. Please wait an hour and try again, or ask the Take Pride team.";

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "take-pride-2026").update(ip).digest("hex");
}

/**
 * Rate limit for the public Catalyst form. Insert first, then count, so
 * parallel calls cannot slip past (same pattern as recordScan). Only an HMAC
 * of the IP is stored. FAILS CLOSED: a database error refuses the sign-up.
 * Runs before the duplicate-email check and the member check, because both
 * answers say something about other people.
 */
export async function allowSignupAttempt(): Promise<boolean> {
  const db = tpService();
  const ipHash = hashIp(await callerIp());
  const { error } = await db.from("tp_signup_attempts").insert({ ip_hash: ipHash });
  if (error) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const all = await db.from("tp_signup_attempts").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (all.error || all.count === null || all.count > SIGNUP_LIMIT_PER_HOUR) return false;
  let mine = db.from("tp_signup_attempts").select("id", { count: "exact", head: true }).gte("created_at", since);
  mine = ipHash ? mine.eq("ip_hash", ipHash) : mine.is("ip_hash", null);
  const r = await mine;
  if (r.error || r.count === null || r.count > SIGNUP_LIMIT_PER_IP_PER_HOUR) return false;
  return true;
}

// ------------------------------------------------------ cancellation ----

/**
 * When a partner is cancelled, every open meeting with them (asked or
 * accepted) is declined and its time and table are freed, so delegates no
 * longer see it, cannot accept it, and the table is free for someone else.
 *
 * sampleOnly (review mode): only meetings with SAMPLE delegates are touched,
 * so a review session never writes a row tied to a real delegate.
 * Returns false if the database failed (the caller says so; re-running the
 * cancel clears whatever is left).
 */
export async function declineOpenMeetings(partnerId: string, opts: { sampleOnly: boolean }): Promise<boolean> {
  const db = tpService();
  const patch = { status: "declined", slot_key: null, table_no: null, responded_at: new Date().toISOString() };
  if (!opts.sampleOnly) {
    const { error } = await db.from("tp_meetings").update(patch).eq("partner_id", partnerId).in("status", ["requested", "accepted"]);
    return !error;
  }
  const { data, error } = await db
    .from("tp_meetings")
    .select("id, delegate:tp_delegates!inner(is_sample)")
    .eq("partner_id", partnerId)
    .in("status", ["requested", "accepted"])
    .eq("delegate.is_sample", true);
  if (error) return false;
  const ids = ((data ?? []) as { id: string }[]).map((m) => m.id);
  if (!ids.length) return true;
  const { error: uErr } = await db.from("tp_meetings").update(patch).in("id", ids).in("status", ["requested", "accepted"]);
  return !uErr;
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
