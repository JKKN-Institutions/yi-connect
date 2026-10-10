/**
 * Take Pride: map a myCII registration export (CSV, or rows pasted from a
 * spreadsheet) onto tp_delegates columns. PURE: no database, no Next.js, so
 * the same code runs in the browser, on the server and in a unit check.
 *
 * Decisions (documented because the export's exact columns are not known yet):
 * - Headers are matched loosely ("Delegate Name", "full_name", "NAME" all
 *   work). A name can also come from separate first + last name columns.
 * - Zone must resolve to one of TP_ZONES (South / West / North / East;
 *   "SR", "Southern Region", "south zone" etc. are accepted). A row whose zone
 *   is missing or unrecognised is SKIPPED with a reason, never guessed.
 * - Industry: an exact or synonym match maps to TP_INDUSTRIES. Anything else
 *   keeps the delegate's own words (the column has no fixed list; matching just
 *   gives no industry bonus). Blank becomes "Other". A row is never skipped
 *   for its industry.
 * - Email and phone are read so the mapping is complete and shown in the
 *   preview, but tp_delegates has no columns for them yet, so they are NOT
 *   stored. (Storing phone would let the WhatsApp share go straight to the
 *   delegate: a follow-up.)
 * - needs/offers stay empty: delegates fill them in on their pass.
 * - The same name + chapter twice in one file: the later row is skipped.
 */

import { TP_INDUSTRIES, TP_ZONES } from "./constants";

export const TP_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const TP_IMPORT_MAX_ROWS = 3000;

export type TpImportField =
  | "full_name"
  | "first_name"
  | "last_name"
  | "chapter"
  | "zone"
  | "business_name"
  | "role_title"
  | "industry"
  | "email"
  | "phone";

export type TpImportRow = {
  /** Spreadsheet row number (the header is row 1). */
  line: number;
  full_name: string;
  chapter: string;
  zone: (typeof TP_ZONES)[number];
  business_name: string | null;
  role_title: string | null;
  industry: string;
  /** matched = one of the fixed list; own = kept as written; blank = "Other". */
  industry_source: "matched" | "own" | "blank";
  email: string | null;
  phone: string | null;
};

export type TpImportSkip = { line: number; name: string; reason: string };

export type TpImportParse =
  | {
      ok: true;
      columns: Partial<Record<TpImportField, string>>;
      dataRows: number;
      rows: TpImportRow[];
      skipped: TpImportSkip[];
    }
  | { ok: false; error: string };

/** What the organiser sees before confirming an import. */
export type TpImportPreviewData = {
  columns: Record<string, string>;
  dataRows: number;
  ready: number;
  sample: TpImportRow[];
  skipped: TpImportSkip[];
};

// ------------------------------------------------------------------ CSV ----

/** RFC 4180 style: quoted fields, "" escapes, commas/newlines inside quotes, CRLF. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

/** Comma for a CSV file, tab when rows were pasted straight from a spreadsheet. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", "\t", ";"].map((d) => [d, first.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

// -------------------------------------------------------------- headers ----

const ALIASES: Record<TpImportField, string[]> = {
  full_name: ["name", "full name", "fullname", "delegate name", "delegate", "participant name", "participant", "member name", "attendee name", "attendee", "delegate full name", "name of the delegate", "name of delegate"],
  first_name: ["first name", "firstname", "given name", "fname"],
  last_name: ["last name", "lastname", "surname", "family name", "lname"],
  chapter: ["chapter", "yi chapter", "chapter name", "your chapter", "yi chapter name", "home chapter"],
  zone: ["zone", "region", "yi zone", "yi region", "zone name", "region name", "cii region"],
  business_name: ["company", "company name", "business", "business name", "organisation", "organization", "organisation name", "organization name", "firm", "firm name", "enterprise"],
  role_title: ["designation", "role", "title", "position", "job title", "your designation"],
  industry: ["industry", "sector", "industry sector", "business sector", "industry type", "type of industry", "line of business", "business type", "nature of business"],
  email: ["email", "email id", "e mail", "email address", "mail id", "e mail id", "mail"],
  phone: ["phone", "mobile", "mobile number", "mobile no", "phone number", "phone no", "contact", "contact number", "contact no", "whatsapp", "whatsapp number", "whatsapp no", "cell"],
};

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Which column index feeds each field. First matching header wins. */
export function mapHeaders(headers: string[]): Partial<Record<TpImportField, number>> {
  const norm = headers.map(normHeader);
  const found: Partial<Record<TpImportField, number>> = {};
  for (const field of Object.keys(ALIASES) as TpImportField[]) {
    const idx = norm.findIndex((h, i) => ALIASES[field].includes(h) && !Object.values(found).includes(i));
    if (idx >= 0) found[field] = idx;
  }
  return found;
}

// --------------------------------------------------------------- values ----

/** "SR", "Southern Region", "south zone", "SOUTH" -> "South". Unknown -> null. */
export function normaliseZone(raw: string): (typeof TP_ZONES)[number] | null {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .replace(/\b(region|zone|yi|cii)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const map: Record<string, (typeof TP_ZONES)[number]> = {
    south: "South", southern: "South", sr: "South", s: "South",
    west: "West", western: "West", wr: "West", w: "West",
    north: "North", northern: "North", nr: "North", n: "North",
    east: "East", eastern: "East", er: "East", e: "East",
  };
  return map[s] ?? null;
}

const INDUSTRY_SYNONYMS: [(typeof TP_INDUSTRIES)[number], RegExp][] = [
  ["Pharma", /\b(pharma\w*|drugs?|biotech\w*|life sciences?)\b/],
  ["Healthcare", /\b(health\w*|hospitals?|medical|clinics?|diagnostics?|wellness|dental)\b/],
  ["Food processing", /\b(food\w*|beverages?|f ?& ?b|bakery|spices?|dairy products|snacks?)\b/],
  ["Textiles", /\b(textiles?|garments?|apparel|fashion|spinning|weaving|fabrics?|yarn|knitwear|handloom)\b/],
  ["IT and software", /\b(it|ites|software|saas|tech|technology|technologies|information technology|digital|computers?|electronics)\b/],
  ["Real estate", /\b(real ?estate|realty|property|properties|builders?|promoters?)\b/],
  ["Construction", /\b(construction|infrastructure|infra|cement|civil|contractors?|architecture|interiors?)\b/],
  ["Energy", /\b(energy|power|solar|renewables?|oil|gas|petroleum|wind)\b/],
  ["Finance", /\b(finance|financial|banks?|banking|insurance|fintech|investments?|nbfc|chartered accountants?|accounting|wealth|ca)\b/],
  ["Hospitality", /\b(hospitality|hotels?|restaurants?|travel|tourism|resorts?|catering|events?)\b/],
  ["Logistics", /\b(logistics?|transport\w*|shipping|freight|courier|warehous\w*|supply chain|cargo)\b/],
  ["Agriculture", /\b(agri\w*|agro\w*|farming|farms?|plantations?|horticulture|dairy|poultry|aqua\w*)\b/],
  ["Education", /\b(education\w*|edtech|schools?|colleges?|training|academy|universit\w*|coaching)\b/],
  ["Media", /\b(media|advertising|marketing|entertainment|films?|publishing|pr|branding|printing)\b/],
  ["Retail", /\b(retail|trading|traders?|trade|wholesale|distribut\w*|e ?commerce|fmcg|dealers?|stores?|jewell?ery)\b/],
  ["Manufacturing", /\b(manufactur\w*|engineering|auto\w*|steel|plastics?|chemicals?|industr\w*|machinery|foundry|packaging|rubber|paper|metals?|castings?)\b/],
];

/** Fixed-list value when it can be recognised, else the delegate's own words. */
export function normaliseIndustry(raw: string): { industry: string; source: TpImportRow["industry_source"] } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { industry: "Other", source: "blank" };
  const exact = TP_INDUSTRIES.find((i) => i.toLowerCase() === t.toLowerCase());
  if (exact) return { industry: exact, source: "matched" };
  const s = t.toLowerCase().replace(/[^a-z0-9&]+/g, " ");
  for (const [industry, re] of INDUSTRY_SYNONYMS) if (re.test(s)) return { industry, source: "matched" };
  return { industry: t.slice(0, 60), source: "own" };
}

function clean(v: string | undefined, max: number): string {
  return (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Lowercased name|chapter: the duplicate key, here and on the server. */
export function delegateKey(fullName: string, chapter: string): string {
  return `${fullName.trim().toLowerCase().replace(/\s+/g, " ")}|${chapter.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

// ----------------------------------------------------------------- main ----

export function mapImport(text: string): TpImportParse {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste the CSV text or choose a .csv file first." };
  if (new TextEncoder().encode(text).length > TP_IMPORT_MAX_BYTES) {
    return { ok: false, error: "That file is bigger than 2 MB. Split it into smaller files." };
  }
  const body = text.replace(/^﻿/, "");
  const all = parseDelimited(body, detectDelimiter(body));
  const grid = all.filter((r) => r.some((c) => c.trim() !== ""));
  if (grid.length < 2) return { ok: false, error: "No delegate rows found. The first line must be the column names, then one delegate per line." };

  const headers = grid[0];
  const idx = mapHeaders(headers);
  if (idx.full_name === undefined && idx.first_name === undefined) {
    return { ok: false, error: `No name column found. Columns seen: ${headers.map((h) => h.trim()).filter(Boolean).join(", ")}. Name one column "Name".` };
  }
  if (idx.chapter === undefined) return { ok: false, error: `No chapter column found. Columns seen: ${headers.map((h) => h.trim()).filter(Boolean).join(", ")}.` };
  if (idx.zone === undefined) {
    return { ok: false, error: "No zone or region column found. Every delegate needs a zone (South, West, North or East). Add a Zone column and try again." };
  }

  const data = grid.slice(1);
  if (data.length > TP_IMPORT_MAX_ROWS) {
    return { ok: false, error: `That is ${data.length} rows. The limit is ${TP_IMPORT_MAX_ROWS} per import, so split the file.` };
  }

  // Each data row's spreadsheet row number, counting blank lines too.
  const lineOf = new Map<string[], number>();
  all.forEach((r, i) => lineOf.set(r, i + 1));

  const columns: Partial<Record<TpImportField, string>> = {};
  for (const [f, i] of Object.entries(idx) as [TpImportField, number][]) columns[f] = headers[i].trim();

  const rows: TpImportRow[] = [];
  const skipped: TpImportSkip[] = [];
  const seen = new Set<string>();
  const get = (r: string[], f: TpImportField, max: number) => (idx[f] === undefined ? "" : clean(r[idx[f]!], max));

  for (const r of data) {
    const line = lineOf.get(r) ?? 0;
    const name = get(r, "full_name", 120) || clean(`${get(r, "first_name", 60)} ${get(r, "last_name", 60)}`, 120);
    const chapter = get(r, "chapter", 80);
    const zoneRaw = get(r, "zone", 40);
    if (!name) {
      skipped.push({ line, name: "(no name)", reason: "Name is empty" });
      continue;
    }
    if (!chapter) {
      skipped.push({ line, name, reason: "Chapter is empty" });
      continue;
    }
    const zone = normaliseZone(zoneRaw);
    if (!zone) {
      skipped.push({ line, name, reason: zoneRaw ? `Zone "${zoneRaw}" is not South, West, North or East` : "Zone is empty" });
      continue;
    }
    const key = delegateKey(name, chapter);
    if (seen.has(key)) {
      skipped.push({ line, name, reason: "Same name and chapter appears earlier in this file" });
      continue;
    }
    seen.add(key);
    const ind = normaliseIndustry(get(r, "industry", 80));
    const email = get(r, "email", 160).toLowerCase();
    const phone = get(r, "phone", 40).replace(/[^\d+]/g, "");
    rows.push({
      line,
      full_name: name,
      chapter,
      zone,
      business_name: get(r, "business_name", 120) || null,
      role_title: get(r, "role_title", 80) || null,
      industry: ind.industry,
      industry_source: ind.source,
      email: email || null,
      phone: phone || null,
    });
  }

  return { ok: true, columns, dataRows: data.length, rows, skipped };
}
