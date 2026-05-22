// ==========================================================================
// Registrations — shared types, constants, and CSV normalization helpers.
// ==========================================================================
// Handbook p.9: chapters share the Microsoft Forms registration link and
// download the CSV export to ingest into the platform. This module is the
// *single source of truth* for how we translate messy form headers into the
// canonical participant schema.
//
// IMPORTANT: No "use server". Everything here is sync / type-only so it can
// be imported from both server actions AND client components.
// ==========================================================================

// ── Enums (mirror the DB enums from migration 012) ────────────────────
export type RegistrationSource =
  | "microsoft_forms"
  | "platform_direct"
  | "csv_upload"
  | "manual";

export type RegistrationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "duplicate";

// ── Canonical student field keys ──────────────────────────────────────
// Matches the participants table columns we support during ingestion.
export type RegistrationField =
  | "full_name"
  | "school_name"
  | "class"
  | "section"
  | "phone"
  | "email"
  | "parent_phone"
  | "city"
  | "home_state";

export const REGISTRATION_FIELDS: {
  key: RegistrationField;
  label: string;
  required: boolean;
}[] = [
  { key: "full_name", label: "Full Name", required: true },
  { key: "school_name", label: "School", required: false },
  { key: "class", label: "Class", required: false },
  { key: "section", label: "Section", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "parent_phone", label: "Parent Phone", required: false },
  { key: "city", label: "City", required: false },
  { key: "home_state", label: "Home State", required: false },
];

// ── Display metadata ──────────────────────────────────────────────────
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export const REGISTRATION_STATUS_COLORS: Record<RegistrationStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-[#138808]/10 text-[#138808] border-[#138808]/20",
  rejected: "bg-red-100 text-red-700 border-red-200",
  duplicate: "bg-slate-100 text-slate-700 border-slate-200",
};

export const REGISTRATION_SOURCE_LABELS: Record<RegistrationSource, string> = {
  microsoft_forms: "Microsoft Forms",
  platform_direct: "Platform",
  csv_upload: "CSV Upload",
  manual: "Manual",
};

// ── Header normalization ──────────────────────────────────────────────
// Microsoft Forms exports include a mix of metadata columns (ID, Start time,
// Completion time, Email — the submitter's M365 email — Name — the
// submitter's name) and then the question columns. Teachers also frequently
// rename the form columns, so the matcher must be fuzzy.
//
// The rules:
//   1. Lowercase, strip diacritics, collapse non-alphanumeric to single space.
//   2. Score each candidate synonym against the header; pick best.
//   3. The FIRST occurrence wins in case of ties (ms_forms puts submitter
//      "Name" before the student name question, so we exclude pure "name"
//      when a stronger match exists further right — see SYNONYMS ordering).

type Synonym = { field: RegistrationField; patterns: string[] };

// NB: ordered so the most-specific patterns are tried first. Each pattern
// is the *normalized* form of the header (see normalizeHeader below).
const SYNONYMS: Synonym[] = [
  // full_name — put very specific student-name phrases first
  { field: "full_name", patterns: [
    "name of the participant",
    "name of participant",
    "name of the student",
    "name of student",
    "student name",
    "student full name",
    "participant name",
    "full name of student",
    "full name",
    "fullname",
    "student",
    "participant",
    "name",
  ]},

  // school_name
  { field: "school_name", patterns: [
    "name of the school",
    "name of school",
    "school name",
    "school",
    "institution",
    "institution name",
  ]},

  // class — must come before "section" matching to avoid "class/section" mis-match
  { field: "class", patterns: [
    "class grade",
    "grade class",
    "class or grade",
    "class",
    "grade",
    "std",
    "standard",
  ]},

  // section
  { field: "section", patterns: [
    "class section",
    "section",
    "div",
    "division",
  ]},

  // parent_phone — check before "phone" so "parent phone" doesn't collide
  { field: "parent_phone", patterns: [
    "parent phone number",
    "parent mobile number",
    "parent phone",
    "parent mobile",
    "parent contact",
    "guardian phone",
    "guardian mobile",
    "guardian contact",
    "father phone",
    "mother phone",
    "parents phone",
    "parents mobile",
  ]},

  // phone
  { field: "phone", patterns: [
    "student phone",
    "student mobile",
    "phone number",
    "mobile number",
    "contact number",
    "whatsapp",
    "whatsapp number",
    "phone",
    "mobile",
    "contact",
  ]},

  // email
  { field: "email", patterns: [
    "student email",
    "email id",
    "email address",
    "e mail",
    "email",
  ]},

  // city
  { field: "city", patterns: [
    "city or town",
    "city town",
    "city",
    "town",
  ]},

  // home_state
  { field: "home_state", patterns: [
    "home state",
    "state",
  ]},
];

// Microsoft-Forms-specific metadata columns we always ignore.
const IGNORED_HEADERS = new Set([
  "id",
  "start time",
  "completion time",
  "last modified time",
]);

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Build a header map: index-in-csv -> canonical field.
 * Ignores Microsoft Forms metadata columns.
 *
 * The first header that normalizes to one of a field's patterns wins. If
 * multiple headers match the same field, the first one is used and the
 * later ones are left unmapped (the organizer can override in the UI).
 */
export function buildHeaderMap(
  headers: string[]
): Record<number, RegistrationField> {
  const map: Record<number, RegistrationField> = {};
  const taken = new Set<RegistrationField>();

  const normalized = headers.map((h) => normalizeHeader(h));

  for (const syn of SYNONYMS) {
    if (taken.has(syn.field)) continue;
    // Longest pattern first (stronger signal wins).
    const orderedPatterns = [...syn.patterns].sort(
      (a, b) => b.length - a.length
    );
    let best: { idx: number; score: number } | null = null;
    for (let i = 0; i < normalized.length; i++) {
      if (IGNORED_HEADERS.has(normalized[i])) continue;
      if (Object.prototype.hasOwnProperty.call(map, i)) continue; // already used
      // Score this index against all patterns for this field. Keep the
      // highest score (exact match +1000 bonus) across all indexes.
      let idxScore = 0;
      for (const pat of orderedPatterns) {
        if (normalized[i] === pat) {
          idxScore = Math.max(idxScore, 1000 + pat.length);
        } else if (normalized[i].includes(pat)) {
          idxScore = Math.max(idxScore, pat.length);
        }
      }
      if (idxScore > 0 && (!best || idxScore > best.score)) {
        best = { idx: i, score: idxScore };
      }
    }
    if (best) {
      map[best.idx] = syn.field;
      taken.add(syn.field);
    }
  }

  return map;
}

// ── CSV parsing (RFC-4180 subset, handles quoted commas / escaped quotes)
export function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  // Normalize line endings. Walk char-by-char to respect quoted newlines.
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" && !inQ) {
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const [headers, ...data] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows: data };
}

// ── Row normalization ────────────────────────────────────────────────
export type NormalizedRegistration = {
  full_name: string;
  school_name: string | null;
  class: number | null;
  section: string | null;
  phone: string | null;
  email: string | null;
  parent_phone: string | null;
  city: string | null;
  home_state: string | null;
  raw: Record<string, string>;
  errors: string[];
};

function stripPhone(s: string | undefined): string | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9+]/g, "");
  if (digits.length === 0) return null;
  // Keep last 15 characters max (international), common formats fit in <=15.
  return digits.slice(-15);
}

function parseClass(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (isNaN(n)) return null;
  return n;
}

export function normalizeRow(
  headers: string[],
  row: string[],
  headerMap: Record<number, RegistrationField>
): NormalizedRegistration {
  const pick = (field: RegistrationField): string | undefined => {
    for (const [idxStr, f] of Object.entries(headerMap)) {
      if (f === field) {
        const v = row[Number(idxStr)];
        if (v !== undefined && v !== null && v.trim().length > 0) {
          return v.trim();
        }
      }
    }
    return undefined;
  };

  const raw: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    raw[headers[i]] = (row[i] ?? "").trim();
  }

  const fullName = pick("full_name") ?? "";
  const classNum = parseClass(pick("class"));

  const errors: string[] = [];
  if (!fullName) errors.push("Missing name");
  if (classNum !== null && (classNum < 9 || classNum > 12)) {
    errors.push(`Class ${classNum} out of range (9-12)`);
  }

  return {
    full_name: fullName,
    school_name: pick("school_name") ?? null,
    class: classNum,
    section: pick("section") ?? null,
    phone: stripPhone(pick("phone")),
    email: pick("email")?.toLowerCase() ?? null,
    parent_phone: stripPhone(pick("parent_phone")),
    city: pick("city") ?? null,
    home_state: pick("home_state") ?? null,
    raw,
    errors,
  };
}

// ── Debug helper (used by inline test in the client component) ───────
export function __debugHeaderSample(): { header: string; field: RegistrationField | null }[] {
  const sample = [
    "ID",
    "Start time",
    "Completion time",
    "Email",
    "Name",
    "Name of the Participant",
    "Name of the School",
    "Class / Grade",
    "Section",
    "Phone Number",
    "Parent Mobile Number",
    "Student Email",
    "City",
    "Home State",
  ];
  const map = buildHeaderMap(sample);
  return sample.map((h, i) => ({ header: h, field: map[i] ?? null }));
}
