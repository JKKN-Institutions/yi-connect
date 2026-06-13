/**
 * Yi Youth Academy guide — downloadable / shareable PDF (A4 portrait).
 *
 * Same content source as the in-app view (lib/yuva/guide/content.ts) so the two
 * never drift. Donor pattern: lib/yuva/certificate-pdf.tsx (@react-pdf/renderer,
 * renderToBuffer, Node runtime, brand logo by absolute HTTPS URL so it survives
 * Vercel serverless). Built-in Helvetica only.
 *
 * Glyph safety (rule: visual artifacts must eyeball clean): Helvetica's encoding
 * has no arrow glyph, so the "→" used in the on-screen copy would render as tofu
 * in the PDF. `safe()` swaps arrows for ASCII "->". Dashes/quotes are WinAnsi-OK.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  GUIDES,
  GUIDE_GLOSSARY,
  PLANNED_LOCALE_NOTE,
  type GuideLane,
  type GuideContent,
} from "@/lib/yuva/guide/content";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";
const BRAND_LOGO_URL = `${APP_URL}/youth-academy/academy-logo.jpg`;

/** Relative app paths → absolute, so links work from a downloaded/shared PDF. */
function absUrl(href: string): string {
  return href.startsWith("http") ? href : `${APP_URL}${href}`;
}

const NAVY = "#0f2557";
const AMBER = "#b45309"; // amber-700 — readable on white in print
const AMBER_BG = "#fef3c7"; // amber-100
const SLATE = "#5b6478";
const LINE = "#e2e8f0";

/** Replace glyphs Helvetica can't encode (arrows → tofu) with ASCII. */
function safe(s: string): string {
  return s.replace(/[→➔➤➙➜]/g, "->");
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingVertical: 40,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    color: NAVY,
    fontSize: 11,
    lineHeight: 1.4,
  },
  mast: { width: 128, height: 63, objectFit: "contain", marginBottom: 14 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  laneLabel: {
    marginTop: 8,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: AMBER,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tagline: { marginTop: 2, fontSize: 11, color: SLATE },

  journeyBox: {
    marginTop: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    padding: 10,
  },
  journeyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: AMBER,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  journeyText: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold" },

  sectionWrap: { marginTop: 18 },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
  },
  step: { flexDirection: "row", marginBottom: 8 },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AMBER_BG,
    color: AMBER,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 3,
    marginRight: 8,
  },
  stepBody: { flex: 1 },
  stepAction: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e293b" },
  stepDetail: { fontSize: 10, color: SLATE, marginTop: 2 },
  tip: {
    marginTop: 4,
    backgroundColor: AMBER_BG,
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
    fontSize: 10,
    color: "#92400e",
  },
  link: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textDecoration: "underline",
  },

  faqHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 18,
    marginBottom: 6,
  },
  faqQ: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e293b", marginTop: 6 },
  faqA: { fontSize: 10, color: SLATE, marginTop: 2 },

  help: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
    fontSize: 10,
    color: "#334155",
  },
  helpLabel: { fontFamily: "Helvetica-Bold", color: NAVY },

  whyBox: { marginTop: 12, backgroundColor: AMBER_BG, borderRadius: 8, padding: 10 },
  whyText: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e293b" },
  startLink: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: AMBER,
    textDecoration: "underline",
  },
  glossaryHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 18,
    marginBottom: 4,
  },
  termWord: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e293b", marginTop: 6 },
  termDef: { fontSize: 10, color: SLATE, marginTop: 1 },
  localeNote: { marginTop: 16, fontSize: 9, color: "#94a3b8", textAlign: "center" },
});

function GuideDocument({ content }: { content: GuideContent }) {
  return (
    <Document
      title={`Yi Youth Academy — ${content.label} guide`}
      author="Yi Youth Academy"
    >
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={BRAND_LOGO_URL} style={styles.mast} />
        <Text style={styles.title}>How to use Yi Youth Academy</Text>
        <Text style={styles.laneLabel}>{safe(content.label)}</Text>
        <Text style={styles.tagline}>{safe(content.tagline)}</Text>

        <View style={styles.whyBox} wrap={false}>
          <Text style={styles.whyText}>{safe(content.whyItMatters)}</Text>
          <Link src={absUrl(content.startHere.href)} style={styles.startLink}>
            {`${safe(content.startHere.label)} ->`}
          </Link>
        </View>

        <View style={styles.journeyBox}>
          <Text style={styles.journeyLabel}>Your journey at a glance</Text>
          <Text style={styles.journeyText}>
            {content.journey.map((n) => safe(n)).join("   >   ")}
          </Text>
        </View>

        {content.sections.map((section, sIdx) => (
          <View key={sIdx} style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>
              {sIdx + 1}. {safe(section.heading)}
            </Text>
            {section.steps.map((step, i) => (
              <View key={i} style={styles.step} wrap={false}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepAction}>{safe(step.action)}</Text>
                  {step.detail && (
                    <Text style={styles.stepDetail}>{safe(step.detail)}</Text>
                  )}
                  {step.tip && (
                    <Text style={styles.tip}>Tip: {safe(step.tip)}</Text>
                  )}
                  {step.link && (
                    <Link src={absUrl(step.link.href)} style={styles.link}>
                      {`${safe(step.link.label)} ->`}
                    </Link>
                  )}
                  {step.image && (
                    /* eslint-disable-next-line jsx-a11y/alt-text */
                    <Image
                      src={absUrl(step.image.src)}
                      style={{
                        marginTop: 6,
                        width: 260,
                        height: 260 * (step.image.height / step.image.width),
                        borderWidth: 1,
                        borderColor: LINE,
                        borderRadius: 4,
                      }}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}

        {content.faqs.length > 0 && (
          <View wrap={false}>
            <Text style={styles.faqHeading}>Common questions</Text>
            {content.faqs.map((faq, i) => (
              <View key={i}>
                <Text style={styles.faqQ}>{safe(faq.q)}</Text>
                <Text style={styles.faqA}>{safe(faq.a)}</Text>
              </View>
            ))}
          </View>
        )}

        <View>
          <Text style={styles.glossaryHeading}>Words to know</Text>
          {GUIDE_GLOSSARY.map((t, i) => (
            <View key={i} wrap={false}>
              <Text style={styles.termWord}>{safe(t.term)}</Text>
              <Text style={styles.termDef}>{safe(t.def)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.help}>
          <Text>
            <Text style={styles.helpLabel}>Need help? </Text>
            {safe(content.help)}
          </Text>
        </View>

        <Text style={styles.localeNote}>{safe(PLANNED_LOCALE_NOTE)}</Text>
      </Page>
    </Document>
  );
}

export async function renderGuidePdfBuffer(lane: GuideLane): Promise<Buffer> {
  const element = <GuideDocument content={GUIDES[lane]} />;
  return await renderToBuffer(element as any);
}
