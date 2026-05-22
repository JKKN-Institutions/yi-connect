/**
 * Track Whitepaper PDF generator.
 * Renders an A4 multi-page document via @react-pdf/renderer.
 * Handbook ref: [HPB §7.1]
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BRAND } from "@/lib/yi-future/constants";

// ─── LEGACY TYPES (kept for compatibility with existing imports) ────
export interface WhitepaperSection {
  title: string;
  body: string;
  order: number;
}

export interface WhitepaperData {
  edition_name: string;
  track_name: string;
  host_chapter_name?: string;
  executive_summary?: string;
  sections: WhitepaperSection[];
  published_at?: string;
}

/**
 * Default section templates for a Track Whitepaper.
 * Host chapter fills the bodies; auto-pulls finalist submissions into Top Solutions.
 */
export const DEFAULT_WHITEPAPER_SECTIONS: WhitepaperSection[] = [
  {
    title: "Executive Summary",
    body: "One-page summary of the track, top recommendations, and impact potential.",
    order: 1,
  },
  {
    title: "Problem Landscape",
    body:
      "Context of the 3 problem statements in this track, national priorities, policy baseline.",
    order: 2,
  },
  {
    title: "Top Solutions",
    body:
      "Consolidated finalist solutions with policy recommendations, execution roadmap, scalability, and impact framework.",
    order: 3,
  },
  {
    title: "Policy Recommendations",
    body:
      "Synthesized policy asks drawn from top teams' work, aligned with national priorities.",
    order: 4,
  },
  {
    title: "Implementation Roadmap",
    body: "Proposed 3-year phased implementation path with responsible actors.",
    order: 5,
  },
  {
    title: "Impact Measurement Framework",
    body:
      "Metrics, KPIs, and monitoring methodology for adopted recommendations.",
    order: 6,
  },
];

// ─── PDF GENERATOR INPUT ────────────────────────────────────────────
export interface WhitepaperPdfData {
  title: string;
  edition_name: string;
  track_name: string;
  track_icon: string | null;
  host_chapter_name: string;
  executive_summary: string | null;
  sections: { heading: string; body: string }[];
  cover_image_url: string | null;
  published_at: string | null;
}

// ─── STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontSize: 11,
    lineHeight: 1.55,
    color: BRAND.colors.navy,
    fontFamily: "Helvetica",
  },
  // Cover
  coverPage: {
    paddingTop: 120,
    paddingBottom: 72,
    paddingHorizontal: 72,
    fontFamily: "Helvetica",
    color: BRAND.colors.navy,
  },
  coverEyebrow: {
    fontSize: 10,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: BRAND.colors.yiGold,
    marginBottom: 16,
    fontFamily: "Helvetica-Bold",
  },
  coverTitle: {
    fontSize: 34,
    lineHeight: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 28,
    color: BRAND.colors.navy,
  },
  coverDivider: {
    width: 64,
    height: 3,
    backgroundColor: BRAND.colors.yiSaffron,
    marginBottom: 28,
  },
  coverMetaRow: {
    marginBottom: 8,
    fontSize: 13,
    color: BRAND.colors.navy,
  },
  coverMetaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#6b6b86",
    marginBottom: 2,
    fontFamily: "Helvetica-Bold",
  },
  coverFooter: {
    position: "absolute",
    bottom: 72,
    left: 72,
    right: 72,
    fontSize: 10,
    color: "#6b6b86",
  },
  coverBrand: {
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    fontSize: 14,
    marginBottom: 4,
  },
  coverNote: {
    fontSize: 9,
    color: "#6b6b86",
    fontStyle: "italic",
    marginTop: 12,
  },

  // Body sections
  h1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    marginBottom: 6,
  },
  h1Accent: {
    width: 36,
    height: 2,
    backgroundColor: BRAND.colors.yiGold,
    marginBottom: 14,
  },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.yiGold,
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4dc",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#8a8aa0",
  },
  footerLeft: { fontSize: 8, color: "#8a8aa0" },
  footerRight: { fontSize: 8, color: "#8a8aa0" },
});

// ─── HELPERS ────────────────────────────────────────────────────────
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unpublished draft";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// ─── PAGE FOOTER ────────────────────────────────────────────────────
function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>
        {BRAND.program} · Yi YUVA
      </Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) =>
          `page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ─── PDF DOCUMENT ───────────────────────────────────────────────────
function WhitepaperDocument({ data }: { data: WhitepaperPdfData }) {
  const paragraphs = data.executive_summary
    ? splitParagraphs(data.executive_summary)
    : [];
  const trackLabel = data.track_icon
    ? `${data.track_icon} ${data.track_name}`
    : data.track_name;

  return (
    <Document
      title={data.title}
      author={`${BRAND.program} · ${data.host_chapter_name}`}
      subject={`${data.track_name} Whitepaper`}
      creator={BRAND.programFull}
    >
      {/* ─── COVER PAGE ───────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverEyebrow}>Track Whitepaper</Text>
        <Text style={styles.coverTitle}>{data.title}</Text>
        <View style={styles.coverDivider} />

        <View style={{ marginBottom: 18 }}>
          <Text style={styles.coverMetaLabel}>Track</Text>
          <Text style={styles.coverMetaRow}>{trackLabel}</Text>
        </View>
        <View style={{ marginBottom: 18 }}>
          <Text style={styles.coverMetaLabel}>Host Chapter</Text>
          <Text style={styles.coverMetaRow}>{data.host_chapter_name}</Text>
        </View>
        <View style={{ marginBottom: 18 }}>
          <Text style={styles.coverMetaLabel}>Edition</Text>
          <Text style={styles.coverMetaRow}>{data.edition_name}</Text>
        </View>
        <View style={{ marginBottom: 18 }}>
          <Text style={styles.coverMetaLabel}>Published</Text>
          <Text style={styles.coverMetaRow}>
            {formatDate(data.published_at)}
          </Text>
        </View>

        {data.cover_image_url && (
          <Text style={styles.coverNote}>
            Cover image available online at the published URL.
          </Text>
        )}

        <View style={styles.coverFooter}>
          <Text style={styles.coverBrand}>{BRAND.programFull}</Text>
          <Text>{BRAND.tagline}</Text>
          <Text>{BRAND.organizations.join("  ·  ")}</Text>
        </View>
      </Page>

      {/* ─── EXECUTIVE SUMMARY ─────────────────────────────── */}
      {paragraphs.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Overview</Text>
          <Text style={styles.h1}>Executive Summary</Text>
          <View style={styles.h1Accent} />
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
          <PageFooter />
        </Page>
      )}

      {/* ─── SECTIONS ──────────────────────────────────────── */}
      {data.sections.map((section, idx) => {
        const bodyParas = splitParagraphs(section.body);
        return (
          <Page key={idx} size="A4" style={styles.page}>
            <Text style={styles.h2}>
              Section {String(idx + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.h1}>{section.heading || "Untitled"}</Text>
            <View style={styles.h1Accent} />
            {bodyParas.length > 0 ? (
              bodyParas.map((p, i) => (
                <Text key={i} style={styles.paragraph}>
                  {p}
                </Text>
              ))
            ) : (
              <Text style={styles.paragraph}>—</Text>
            )}
            <PageFooter />
          </Page>
        );
      })}
    </Document>
  );
}

// ─── PUBLIC API ─────────────────────────────────────────────────────
export async function generateWhitepaperPdf(
  data: WhitepaperPdfData
): Promise<Buffer> {
  const element = React.createElement(WhitepaperDocument, { data });
  // `renderToBuffer` accepts a DocumentElement; our createElement returns
  // a valid React element wrapping <Document>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await renderToBuffer(element as any);
}
