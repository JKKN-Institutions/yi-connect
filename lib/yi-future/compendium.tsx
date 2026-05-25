/**
 * Compendium PDF generator.
 *
 * Self-contained @react-pdf/renderer implementation that bundles every
 * published whitepaper for an edition into a single downloadable PDF.
 *
 * Handbook refs: [HPB §6 Whitepaper, HPB §9 National Deliverables]
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { BRAND } from "./constants";

export interface CompendiumWhitepaper {
  title: string;
  track_name: string;
  track_icon: string | null;
  host_chapter_name: string;
  executive_summary: string | null;
  sections: { heading: string; body: string }[];
}

export interface CompendiumData {
  edition_name: string;
  edition_slug: string;
  published_at: Date;
  whitepapers: CompendiumWhitepaper[];
}

const styles = StyleSheet.create({
  // Cover page
  cover: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
    backgroundColor: BRAND.colors.ivory,
    height: "100%",
  },
  coverBrandStrip: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginBottom: 40,
  },
  coverBrandItem: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    letterSpacing: 2,
  },
  coverBrandDot: {
    fontSize: 11,
    color: BRAND.colors.yiGold,
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: "Helvetica",
    color: BRAND.colors.navy,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 80,
  },
  coverAccent: {
    width: 80,
    height: 3,
    backgroundColor: BRAND.colors.yiGold,
    marginBottom: 40,
  },
  coverMeta: {
    fontSize: 10,
    color: BRAND.colors.navy,
    opacity: 0.5,
    textAlign: "center",
    marginTop: 20,
  },
  coverTagline: {
    fontSize: 12,
    fontFamily: "Helvetica-Oblique",
    color: BRAND.colors.yiSaffron,
    textAlign: "center",
    marginBottom: 6,
  },

  // Standard page
  page: {
    padding: 50,
    paddingBottom: 70,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: BRAND.colors.navy,
    backgroundColor: "#FFFFFF",
  },

  // TOC
  tocTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    marginBottom: 6,
  },
  tocSubtitle: {
    fontSize: 10,
    color: BRAND.colors.navy,
    opacity: 0.6,
    marginBottom: 24,
  },
  tocItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
  },
  tocItemLeft: {
    flexDirection: "column",
    flex: 1,
  },
  tocItemNumber: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.yiGold,
    marginRight: 10,
  },
  tocItemTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    marginBottom: 2,
  },
  tocItemMeta: {
    fontSize: 9,
    color: BRAND.colors.navy,
    opacity: 0.6,
  },

  // Whitepaper section
  wpHeader: {
    borderLeftWidth: 4,
    borderLeftColor: BRAND.colors.yiGold,
    paddingLeft: 12,
    marginBottom: 20,
  },
  wpLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.yiSaffron,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  wpTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    marginBottom: 6,
    lineHeight: 1.25,
  },
  wpMeta: {
    fontSize: 10,
    color: BRAND.colors.navy,
    opacity: 0.65,
  },
  execSummaryBox: {
    backgroundColor: BRAND.colors.ivory,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.colors.yiGold,
    padding: 12,
    marginBottom: 18,
  },
  execSummaryLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  execSummaryText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: BRAND.colors.navy,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.navy,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 11,
    lineHeight: 1.55,
    color: BRAND.colors.navy,
    marginBottom: 10,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: BRAND.colors.navy,
    opacity: 0.5,
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND.colors.yiGold,
  },
});

function Footer({ compendiumTitle }: { compendiumTitle: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>{compendiumTitle}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function CoverPage({ data }: { data: CompendiumData }) {
  return (
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBrandStrip}>
        <Text style={styles.coverBrandItem}>Yi</Text>
        <Text style={styles.coverBrandDot}>•</Text>
        <Text style={styles.coverBrandItem}>Yi YUVA</Text>
        <Text style={styles.coverBrandDot}>•</Text>
        <Text style={styles.coverBrandItem}>CII</Text>
      </View>

      <Text style={styles.coverTagline}>{BRAND.tagline}</Text>
      <Text style={styles.coverTitle}>
        {data.edition_name}
        {"\n"}Compendium
      </Text>
      <View style={styles.coverAccent} />
      <Text style={styles.coverSubtitle}>
        Policy Whitepapers — {BRAND.program}
      </Text>

      <Text style={styles.coverMeta}>
        {data.whitepapers.length} whitepaper
        {data.whitepapers.length === 1 ? "" : "s"} • Generated{" "}
        {data.published_at.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </Text>
    </Page>
  );
}

function TocPage({
  data,
  compendiumTitle,
}: {
  data: CompendiumData;
  compendiumTitle: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.tocTitle}>Contents</Text>
      <Text style={styles.tocSubtitle}>
        {data.whitepapers.length} published whitepaper
        {data.whitepapers.length === 1 ? "" : "s"} from {data.edition_name}
      </Text>

      {data.whitepapers.map((wp, i) => (
        <View key={i} style={styles.tocItem} wrap={false}>
          <View style={styles.tocItemLeft}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.tocItemNumber}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.tocItemTitle}>{wp.title}</Text>
            </View>
            <Text style={styles.tocItemMeta}>
              {wp.track_icon && !wp.track_icon.startsWith("/") ? `${wp.track_icon} ` : ""}
              {wp.track_name} · {wp.host_chapter_name}
            </Text>
          </View>
        </View>
      ))}

      <Footer compendiumTitle={compendiumTitle} />
    </Page>
  );
}

function WhitepaperPage({
  wp,
  index,
  compendiumTitle,
}: {
  wp: CompendiumWhitepaper;
  index: number;
  compendiumTitle: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.wpHeader}>
        <Text style={styles.wpLabel}>
          Whitepaper {String(index + 1).padStart(2, "0")}
          {"  •  "}
          {wp.track_icon && !wp.track_icon.startsWith("/") ? `${wp.track_icon} ` : ""}
          {wp.track_name}
        </Text>
        <Text style={styles.wpTitle}>{wp.title}</Text>
        <Text style={styles.wpMeta}>Host Chapter: {wp.host_chapter_name}</Text>
      </View>

      {wp.executive_summary ? (
        <View style={styles.execSummaryBox} wrap={false}>
          <Text style={styles.execSummaryLabel}>Executive Summary</Text>
          <Text style={styles.execSummaryText}>{wp.executive_summary}</Text>
        </View>
      ) : null}

      {wp.sections.map((section, i) => (
        <View key={i}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <Footer compendiumTitle={compendiumTitle} />
    </Page>
  );
}

function CompendiumDocument({ data }: { data: CompendiumData }) {
  const compendiumTitle = `${data.edition_name} Compendium`;
  return (
    <Document
      title={compendiumTitle}
      author={BRAND.organizations.join(" · ")}
      subject={`Policy Whitepapers — ${BRAND.programFull}`}
      creator="YiFuture Platform"
    >
      <CoverPage data={data} />
      {data.whitepapers.length > 0 ? (
        <TocPage data={data} compendiumTitle={compendiumTitle} />
      ) : null}
      {data.whitepapers.map((wp, i) => (
        <WhitepaperPage
          key={i}
          wp={wp}
          index={i}
          compendiumTitle={compendiumTitle}
        />
      ))}
    </Document>
  );
}

export async function generateCompendiumPdf(
  data: CompendiumData
): Promise<Buffer> {
  // Cast element to any — renderToBuffer's DocumentProps type is overly strict
  // and doesn't allow custom components. Runtime behavior is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CompendiumDocument, { data }) as any;
  const buf = await renderToBuffer(element);
  return buf as Buffer;
}
