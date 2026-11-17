/**
 * Activity log (audit trail) filters, wording and export rows, shared by the
 * Audit trail page and its download route. Pure on purpose: no database, no
 * "server-only", so the same filter runs on the page, in the export, and in a
 * plain script against a dump of the table.
 */

import type { AuditRow } from "./data";

export const ACTION_WORD: Record<string, string> = {
  create: "created",
  update: "updated",
  make_current: "made current",
  assign: "assigned",
  remove: "removed",
  edit_conflicts: "changed declared conflicts on",
  grant: "granted",
  revoke: "revoked",
  paste: "pasted",
  upload: "uploaded",
  apply_layer1: "applied Layer 1 scores from",
  set_layer1_manual: "typed a Layer 1 score for",
  // recognitions_06: Health Card per measure.
  apply_health_card_measures: "applied Health Card measure scores from",
  edit_health_card_measure: "edited a Health Card measure:",
  force_open_stage2: "forced Stage 2 open on",
  stage2_auto_opened_rm_missing: "opened Stage 2 automatically (Regional Mentor marks missing) on",
  edit: "edited",
  submit: "submitted",
  lock: "locked",
  decide: "decided on",
  unlock: "unlocked",
  // recognitions_02: the Regional Chair + RM check.
  nomination_check_passed: "passed the check of",
  nomination_returned: "sent back",
  nomination_resubmitted: "fixed and resubmitted",
};

export function words(s: string) {
  // Stored names keep "award" (e.g. entity "award"); people read "recognition".
  return s.replace(/_/g, " ").replace(/\bawards?\b/g, (m) => (m === "award" ? "recognition" : "recognitions"));
}

/** "submitted recognition scores", "created recognition", … as the page has always shown it. */
export function actionText(r: Pick<AuditRow, "action" | "entity">): string {
  return `${ACTION_WORD[r.action] ?? words(r.action)} ${words(r.entity)}`;
}

/** The detail jsonb as "key: value · key: value". The page shortens it; the export keeps everything. */
export function detailText(
  d: Record<string, unknown>,
  opts: { maxParts?: number; maxChars?: number; skip?: string[] } = {}
): string {
  const { maxParts = Infinity, maxChars = Infinity, skip = [] } = opts;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d ?? {})) {
    if (skip.includes(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${words(k)}: ${val.length > maxChars ? `${val.slice(0, maxChars)}…` : val}`);
    if (parts.length >= maxParts) break;
  }
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Filters (kept in the URL so a filtered view can be shared)
// ---------------------------------------------------------------------------

export type AuditFilter = {
  /** Part of the name of the person who did it ("system" finds the system's own actions). */
  who: string;
  /** yi.chapters id. */
  chapter: string;
  /** recognition_awards id. */
  award: string;
  /** Stored action code, e.g. nomination_draft_saved. */
  action: string;
  /** IST calendar days, YYYY-MM-DD, both inclusive. */
  from: string;
  to: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACTION = /^[a-z0-9_.]{1,80}$/;

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function param(sp: Params, key: string): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

/** Anything malformed is dropped (treated as "no filter"), never passed on. */
export function parseAuditFilter(sp: Params): AuditFilter {
  const pick = (key: string, ok: RegExp) => {
    const v = param(sp, key);
    return ok.test(v) ? v : "";
  };
  const from = pick("from", DAY);
  const to = pick("to", DAY);
  return {
    who: param(sp, "who").slice(0, 100),
    chapter: pick("chapter", UUID).toLowerCase(),
    award: pick("award", UUID).toLowerCase(),
    action: pick("action", ACTION),
    from: Number.isNaN(Date.parse(from)) ? "" : from,
    to: Number.isNaN(Date.parse(to)) ? "" : to,
  };
}

export function isFiltered(f: AuditFilter): boolean {
  return Object.values(f).some((v) => v !== "");
}

/** "?who=…&chapter=…" with only the filters that are set, plus any extras (page, format). */
export function auditQuery(f: AuditFilter, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type AuditLookups = {
  /** person id -> full name, for every actor in the rows. */
  personName: Map<string, string>;
  /** nomination id -> chapter id. */
  nominationChapter: Map<string, string>;
};

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v.toLowerCase() : null);

/**
 * Every chapter a row is about: detail.chapter_id, or the chapter of the
 * nomination it touched (entity_id or detail.nomination_id).
 */
export function chaptersOf(r: AuditRow, nominationChapter: Map<string, string>): string[] {
  const out = new Set<string>();
  const direct = str(r.detail?.chapter_id);
  if (direct) out.add(direct);
  for (const nid of [r.entity_id, r.detail?.nomination_id]) {
    const id = str(nid);
    const ch = id ? nominationChapter.get(id) : undefined;
    if (ch) out.add(ch.toLowerCase());
  }
  return [...out];
}

export function actorName(r: AuditRow, personName: Map<string, string>): string {
  return r.actor_person_id ? personName.get(r.actor_person_id) ?? "Unknown person" : "System";
}

const IST_MS = 330 * 60 * 1000;
const dayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);

export function filterAuditRows(rows: AuditRow[], f: AuditFilter, look: AuditLookups): AuditRow[] {
  const who = f.who.toLowerCase();
  const from = f.from ? dayStart(f.from) : null;
  const to = f.to ? dayStart(f.to) + 24 * 60 * 60 * 1000 : null;
  return rows.filter((r) => {
    if (who && !actorName(r, look.personName).toLowerCase().includes(who)) return false;
    if (f.chapter && !chaptersOf(r, look.nominationChapter).includes(f.chapter)) return false;
    if (f.award && (r.award_id ?? "").toLowerCase() !== f.award) return false;
    if (f.action && r.action !== f.action) return false;
    const at = Date.parse(r.at);
    if (from !== null && at < from) return false;
    if (to !== null && at >= to) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** 2026-11-07 15:51:35, in IST: sorts correctly as text in Excel. */
export function istStamp(iso: string): string {
  return new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 19).replace("T", " ");
}

export const AUDIT_EXPORT_HEAD = [
  "Time (IST)",
  "Person",
  "Role (current)",
  "What they did",
  "Action code",
  "Recognition",
  "Chapter",
  "Details",
];

export function auditExportRows(
  rows: AuditRow[],
  look: AuditLookups & {
    roles: Map<string, string>;
    awardTitle: Map<string, string>;
    chapterName: Map<string, string>;
  }
): string[][] {
  const out: string[][] = [AUDIT_EXPORT_HEAD];
  for (const r of rows) {
    const chapters = chaptersOf(r, look.nominationChapter);
    out.push([
      istStamp(r.at),
      actorName(r, look.personName),
      r.actor_person_id ? look.roles.get(r.actor_person_id) ?? "" : "",
      actionText(r),
      r.action,
      r.award_id ? look.awardTitle.get(r.award_id) ?? "A recognition no longer listed" : "",
      chapters.map((c) => look.chapterName.get(c) ?? "Chapter not found").join(", "),
      // The chapter has its own column, so its id is left out of the details.
      detailText(r.detail, { skip: ["chapter_id"] }),
    ]);
  }
  return out;
}

function cell(v: string): string {
  let s = String(v ?? "");
  // Neutralise spreadsheet formulas (CSV injection), as the stage sheet does.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 with a BOM so Excel keeps non-Latin names. */
export function toCsv(aoa: string[][]): string {
  return "﻿" + aoa.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
