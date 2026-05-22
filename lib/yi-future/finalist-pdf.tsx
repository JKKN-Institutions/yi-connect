/**
 * Finalist Roster PDF for Future 6.0 National Track Finals.
 *
 * Renders a branded document listing all shortlisted teams grouped by track.
 * Used by /api/finalists/[eventId]/pdf/route.tsx.
 *
 * Handbook refs: [HPB §4 Day 2, HPB §9 National Deliverables]
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── PUBLIC TYPES ────────────────────────────────────────────────────────────

export interface FinalistTeam {
  rank: number | null;
  team_name: string;
  chapter_name: string;
  problem_title: string;
  track_name: string;
  total_score: number | null;
  members_count: number;
  consent_status: string; // 'all_approved' | 'pending' | 'partial'
}

export interface FinalistRosterPDFProps {
  event: {
    name: string;
    start_date: string | null;
    venue: string | null;
    host_city: string;
  };
  finalists: FinalistTeam[];
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const LOGO_URL = "https://yifuture-platform.vercel.app/future-6-logo.png";
const NAVY = "#1a1a3e";
const GOLD = "#F5A623";
const SLATE = "#6b6b86";
const LIGHT_BG = "#f8f8fc";

// ─── STYLES ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 10,
    lineHeight: 1.5,
    color: NAVY,
    fontFamily: "Helvetica",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 10,
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 44, height: 44, marginRight: 12 },
  brandCol: { flexDirection: "column" },
  brandTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    color: NAVY,
  },
  brandSub: { fontSize: 8, color: SLATE, marginTop: 2, letterSpacing: 0.8 },
  headerRight: { fontSize: 8, color: SLATE, textAlign: "right" },

  // Cover title block
  docTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 1,
  },
  docSubtitle: {
    fontSize: 10,
    color: SLATE,
    textAlign: "center",
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 9,
    color: SLATE,
    textAlign: "center",
    marginBottom: 16,
  },
  summaryBadge: {
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
  },

  // Track section
  trackHeader: {
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 3,
  },
  trackTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.8,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d4d4dc",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4ef",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4ef",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: LIGHT_BG,
  },

  // Column widths (must sum to 100%)
  colRank: { width: "6%", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colTeam: { width: "22%", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colChapter: { width: "16%", fontSize: 9 },
  colProblem: { width: "34%", fontSize: 9 },
  colScore: { width: "10%", fontSize: 9, textAlign: "right" },
  colConsent: { width: "12%", fontSize: 9, textAlign: "center" },

  // Column header labels
  colHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4dc",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: SLATE,
  },
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function consentLabel(status: string): string {
  switch (status) {
    case "all_approved":
      return "All signed";
    case "partial":
      return "Partial";
    default:
      return "Pending";
  }
}

function groupByTrack(
  finalists: FinalistTeam[]
): Map<string, FinalistTeam[]> {
  const map = new Map<string, FinalistTeam[]>();
  for (const f of finalists) {
    const existing = map.get(f.track_name) ?? [];
    existing.push(f);
    map.set(f.track_name, existing);
  }
  return map;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function FinalistRosterPDF({
  event,
  finalists,
}: FinalistRosterPDFProps) {
  const byTrack = groupByTrack(finalists);
  const trackCount = byTrack.size;
  const totalTeams = finalists.length;

  const dateStr = event.start_date
    ? new Date(event.start_date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "long",
      })
    : "Date TBC";

  const venueStr = event.venue
    ? `${event.venue}, ${event.host_city}`
    : event.host_city;

  return (
    <Document
      title={`Future 6.0 — National Finalists — ${event.host_city}`}
      author="Yi YUVA · CII"
      subject="National Track Final Finalist Roster"
    >
      <Page size="A4" style={s.page}>
        {/* ── Brand header ── */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <Image src={LOGO_URL} style={s.logo} />
            <View style={s.brandCol}>
              <Text style={s.brandTitle}>Yi YUVA · FUTURE 6.0</Text>
              <Text style={s.brandSub}>Young Indians · CII</Text>
            </View>
          </View>
          <Text style={s.headerRight}>
            NATIONAL TRACK FINAL{"\n"}{event.host_city.toUpperCase()}
          </Text>
        </View>

        {/* ── Document title ── */}
        <Text style={s.docTitle}>National Finalists</Text>
        <Text style={s.docSubtitle}>{event.name}</Text>
        <Text style={s.docMeta}>
          {dateStr}  ·  {venueStr}
        </Text>

        {/* ── Summary badge ── */}
        <View style={s.summaryBadge}>
          <Text style={s.summaryText}>
            {totalTeams} team{totalTeams !== 1 ? "s" : ""} across{" "}
            {trackCount} track{trackCount !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* ── Per-track sections ── */}
        {Array.from(byTrack.entries()).map(([trackName, teams]) => (
          <View key={trackName} wrap={false}>
            {/* Track heading */}
            <View style={s.trackHeader}>
              <Text style={s.trackTitle}>
                {trackName.toUpperCase()}  ({teams.length} team
                {teams.length !== 1 ? "s" : ""})
              </Text>
            </View>

            {/* Column headers */}
            <View style={s.tableHeader}>
              <Text style={[s.colRank, s.colHeaderText]}>#</Text>
              <Text style={[s.colTeam, s.colHeaderText]}>Team</Text>
              <Text style={[s.colChapter, s.colHeaderText]}>Chapter</Text>
              <Text style={[s.colProblem, s.colHeaderText]}>Problem</Text>
              <Text style={[s.colScore, s.colHeaderText]}>Score</Text>
              <Text style={[s.colConsent, s.colHeaderText]}>Consent</Text>
            </View>

            {/* Data rows */}
            {teams.map((team, idx) => {
              const rowStyle = idx % 2 === 0 ? s.tableRow : s.tableRowAlt;
              return (
                <View key={`${trackName}-${team.team_name}`} style={rowStyle}>
                  <Text style={s.colRank}>
                    {team.rank != null ? String(team.rank) : "—"}
                  </Text>
                  <Text style={s.colTeam}>{team.team_name}</Text>
                  <Text style={s.colChapter}>{team.chapter_name}</Text>
                  <Text style={s.colProblem}>{team.problem_title}</Text>
                  <Text style={s.colScore}>
                    {team.total_score != null
                      ? team.total_score.toFixed(1)
                      : "—"}
                  </Text>
                  <Text style={s.colConsent}>
                    {consentLabel(team.consent_status)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text>Yi YUVA · Future 6.0 (2026) — Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
