/**
 * CSV helpers for Take Pride downloads (partner leads, desk partners).
 * Pure functions only, no server or database imports, so they can be
 * checked with a plain node script.
 *
 * - RFC 4180: CRLF line endings; a cell holding a comma, quote, CR or LF is
 *   wrapped in quotes and its quotes are doubled.
 * - Formula-injection guard: a text cell starting with = + - @ (or a tab /
 *   carriage return) gets a leading apostrophe so Excel / Sheets treat it as
 *   text, never as a formula.
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : String(v);
  if (typeof v === "string" && FORMULA_START.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** A UTF-8 BOM keeps Excel from garbling non-ASCII names. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** "Kavya Foods & Co." -> "kavya-foods-co"; empty input -> fallback. */
export function slug(s: string, fallback = "take-pride"): string {
  const out = s
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return out || fallback;
}

/** ISO timestamp -> "2026-10-10 15:37" in Asia/Kolkata; blank when missing. */
export function istTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/* ─── Partner leads file ──────────────────────────────────────────────── */

/** Delegate fields a partner may see. Never phone or email. */
export type CsvDelegate = {
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  role_title: string | null;
  industry: string;
};

export const PARTNER_LEADS_HEADERS = [
  "source",
  "name",
  "chapter",
  "zone",
  "business",
  "role",
  "industry",
  "note",
  "scanned_at",
];

export function partnerLeadRows(
  leads: { note: string | null; created_at: string; delegate: CsvDelegate | null }[],
  acceptedMeetings: { slot: string | null; delegate: CsvDelegate | null }[]
): CsvValue[][] {
  const base = (d: CsvDelegate) => [d.full_name, d.chapter, d.zone, d.business_name, d.role_title, d.industry];
  const rows: CsvValue[][] = [];
  for (const l of leads) {
    if (!l.delegate) continue;
    rows.push(["lead", ...base(l.delegate), l.note, istTime(l.created_at)]);
  }
  for (const m of acceptedMeetings) {
    if (!m.delegate) continue;
    rows.push(["meeting", ...base(m.delegate), m.slot ? `Meeting slot: ${m.slot}` : "Meeting accepted", ""]);
  }
  return rows;
}

/* ─── Desk partners file ──────────────────────────────────────────────── */

export type CsvPartner = {
  id: string;
  business_name: string;
  member_name: string;
  chapter: string;
  zone: string | null;
  phone: string;
  email: string;
  status: string;
  amount_due_inr: number;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  confirmed_at: string | null;
  is_sample: boolean;
};

export const DESK_PARTNERS_HEADERS = [
  "business",
  "member",
  "chapter",
  "zone",
  "phone",
  "email",
  "status",
  "amount_due_inr",
  "payment_reference",
  "payment_submitted_at",
  "confirmed_at",
  "meetings_requested",
  "meetings_accepted",
  "leads",
  "is_sample",
];

/**
 * meetings_requested counts every request the partner sent (any status);
 * meetings_accepted counts the ones a delegate accepted.
 */
export function deskPartnerRows(
  partners: CsvPartner[],
  meetings: { partner_id: string; status: string }[],
  leads: { partner_id: string }[]
): CsvValue[][] {
  const req = new Map<string, number>();
  const acc = new Map<string, number>();
  const lds = new Map<string, number>();
  for (const m of meetings) {
    req.set(m.partner_id, (req.get(m.partner_id) ?? 0) + 1);
    if (m.status === "accepted") acc.set(m.partner_id, (acc.get(m.partner_id) ?? 0) + 1);
  }
  for (const l of leads) lds.set(l.partner_id, (lds.get(l.partner_id) ?? 0) + 1);
  return partners.map((p) => [
    p.business_name,
    p.member_name,
    p.chapter,
    p.zone,
    p.phone,
    p.email,
    p.status,
    p.amount_due_inr,
    p.payment_reference,
    istTime(p.payment_submitted_at),
    istTime(p.confirmed_at),
    req.get(p.id) ?? 0,
    acc.get(p.id) ?? 0,
    lds.get(p.id) ?? 0,
    p.is_sample ? "yes" : "no",
  ]);
}
