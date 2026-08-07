/**
 * Delegate Roster PDF for the Yi-Future national admin table.
 *
 * Rendered by /yi-future/api/delegates/export?format=pdf. Landscape A4 so the
 * contact columns fit without wrapping. Styling follows lib/yi-future/finalist-pdf
 * (navy/gold) so the two documents read as one family.
 *
 * The header restates the filters that produced the file — an exported roster
 * with no provenance is impossible to trust a week later.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { DelegateExportRecord } from "@/lib/yi-future/delegate-filters";

/**
 * Unicode small-capital letters (IPA/Phonetic Extensions) → plain capitals.
 *
 * These have NO Unicode decomposition — NFKD leaves them untouched — so without
 * this map they are simply dropped, and a real delegate named "M.ᴛʜᴀɴɪɢᴀɪᴠᴇʟ"
 * prints as "M.". Verified against the live table, which holds exactly that row.
 */
const SMALL_CAPS: Record<string, string> = {
  "ᴀ": "A", "ʙ": "B", "ᴄ": "C", "ᴅ": "D", "ᴇ": "E",
  "ꜰ": "F", "ɢ": "G", "ʜ": "H", "ɪ": "I", "ᴊ": "J",
  "ᴋ": "K", "ʟ": "L", "ᴍ": "M", "ɴ": "N", "ᴏ": "O",
  "ᴘ": "P", "ʀ": "R", "ꜱ": "S", "ᴛ": "T", "ᴜ": "U",
  "ᴠ": "V", "ᴡ": "W", "ʏ": "Y", "ᴢ": "Z",
};

/**
 * Make a string safe for the built-in Helvetica font.
 *
 * @react-pdf's standard fonts encode WinAnsi/Latin-1 only; anything outside it
 * draws as garbage — a team literally named "Tech Titans 🐯" printed as
 * "Tech Titans ⚙%". Rather than embed an emoji font (colour emoji are not
 * supported anyway), normalise down to what the font can actually draw.
 *
 * Order matters: smart punctuation → ASCII, then small-caps → capitals, then
 * NFKD for anything that genuinely decomposes, and only then drop the rest.
 *
 * Final guard: if sanitising destroyed most of the text, return the RAW string.
 * Garbled output is visible and reportable; a blank or truncated name is a
 * silently missing person, which is the worse failure on a roster.
 */
function pdfSafe(raw: string): string {
  if (!raw) return "";
  const mapped = raw
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[ɐ-ʯᴀ-ᵿꜰꜱ]/g, (c) => SMALL_CAPS[c] ?? c);
  const out = mapped
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^ -ÿ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const kept = out.replace(/\s/g, "").length;
  const original = raw.replace(/\s/g, "").length;
  if (!out || kept < original * 0.6) return raw;
  return out;
}

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";
const SLATE = "#6b6b86";
const LINE = "#e4e4ef";
const ZEBRA = "#f8f8fc";

// Landscape A4 is 842pt wide; 32pt margins leave 778pt of usable width.
const COLS = {
  name: 118,
  email: 150,
  phone: 66,
  chapter: 62,
  college: 132,
  course: 68,
  team: 92,
  code: 46,
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 34,
    paddingHorizontal: 32,
    fontSize: 7.5,
    color: NAVY,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 6,
    marginBottom: 4,
  },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  subtitle: { fontSize: 7.5, color: SLATE, marginTop: 2 },
  countBadge: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GOLD },
  countLabel: { fontSize: 6.5, color: SLATE, textAlign: "right" },

  noticeRow: {
    backgroundColor: "#fff6e6",
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginTop: 6,
  },
  noticeText: { fontSize: 6.5, color: NAVY },

  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingVertical: 4,
    marginTop: 8,
  },
  headCell: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    paddingRight: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 3,
  },
  rowAlt: { backgroundColor: ZEBRA },
  cell: { paddingRight: 4 },
  muted: { color: SLATE },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: SLATE,
  },
});

export interface DelegateRosterPDFProps {
  rows: DelegateExportRecord[];
  /** Human-readable filter summary, e.g. "Region SRTN · Chapter Erode". */
  filterSummary: string;
  /** Exact number matching the filters — may exceed rows.length when capped. */
  totalMatching: number;
  /** Set when the document was truncated to keep it openable. */
  cappedAt: number | null;
  generatedAt: string;
  includeAccessCode: boolean;
}

export function DelegateRosterPDF({
  rows,
  filterSummary,
  totalMatching,
  cappedAt,
  generatedAt,
  includeAccessCode,
}: DelegateRosterPDFProps) {
  return (
    <Document
      title={`Yi-Future delegates — ${filterSummary}`}
      author="Yi Connect"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.title}>Future 6.0 — Delegate Roster</Text>
            <Text style={s.subtitle}>{pdfSafe(filterSummary)}</Text>
          </View>
          <View>
            <Text style={s.countBadge}>{totalMatching.toLocaleString("en-IN")}</Text>
            <Text style={s.countLabel}>delegates matching filters</Text>
          </View>
        </View>

        {cappedAt !== null && (
          <View style={s.noticeRow}>
            <Text style={s.noticeText}>
              {`Showing the first ${cappedAt.toLocaleString("en-IN")} of ${totalMatching.toLocaleString("en-IN")} delegates, sorted by name, to keep this document openable. Export to Excel for the complete list.`}
            </Text>
          </View>
        )}

        <View style={s.headRow} fixed>
          <Text style={[s.headCell, { width: COLS.name }]}>Full Name</Text>
          <Text style={[s.headCell, { width: COLS.email }]}>Email</Text>
          <Text style={[s.headCell, { width: COLS.phone }]}>Phone</Text>
          <Text style={[s.headCell, { width: COLS.chapter }]}>Chapter</Text>
          <Text style={[s.headCell, { width: COLS.college }]}>College</Text>
          <Text style={[s.headCell, { width: COLS.course }]}>Course</Text>
          <Text style={[s.headCell, { width: COLS.team }]}>Team</Text>
          {includeAccessCode && (
            <Text style={[s.headCell, { width: COLS.code }]}>Code</Text>
          )}
        </View>

        {rows.map((r, i) => (
          <View
            key={`${r.email || r.phone || "row"}-${i}`}
            style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row}
            wrap={false}
          >
            <Text style={[s.cell, { width: COLS.name }]}>{pdfSafe(r.name)}</Text>
            <Text style={[s.cell, { width: COLS.email }]}>{pdfSafe(r.email)}</Text>
            <Text style={[s.cell, { width: COLS.phone }]}>{pdfSafe(r.phone)}</Text>
            <Text style={[s.cell, { width: COLS.chapter }]}>
              {pdfSafe(r.chapter)}
            </Text>
            <Text style={[s.cell, { width: COLS.college }]}>
              {pdfSafe(r.college)}
            </Text>
            <Text style={[s.cell, { width: COLS.course }]}>{pdfSafe(r.course)}</Text>
            <Text
              style={
                r.team === "no team"
                  ? [s.cell, s.muted, { width: COLS.team }]
                  : [s.cell, { width: COLS.team }]
              }
            >
              {pdfSafe(r.team)}
            </Text>
            {includeAccessCode && (
              <Text style={[s.cell, { width: COLS.code }]}>{r.accessCode}</Text>
            )}
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>Generated {generatedAt} · Yi Connect</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
