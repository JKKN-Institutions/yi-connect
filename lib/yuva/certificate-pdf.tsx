/**
 * Yi Youth Academy — e-certificate PDF (Phase 14).
 *
 * Body copy is the Yi-approved "Certificate of Completion" wording (2026-06-11).
 * Variable zones filled per student at issue time: student name, institution,
 * program name, dates, issue date, certificate number. A bespoke designer
 * background can later replace the layout — the props contract below survives
 * the swap (it's the data the system fills in).
 *
 * Donor pattern: lib/yi-future/consent-pdf.tsx (@react-pdf/renderer,
 * renderToBuffer, Node runtime). Rendered server-side at issue time inside
 * app/youth-academy/actions/certificates.ts, stored in the private
 * `yuva-certificates` bucket, served via short-lived signed URLs.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ─── PUBLIC PROPS ───────────────────────────────────────────────────
export interface CertificatePdfProps {
  studentName: string;
  /** Student's institution name (their college). Null → "of …" clause omitted. */
  institutionName: string | null;
  programName: string;
  /** Academy display name, e.g. "Yi Erode Youth Academy". */
  academyName: string;
  /** Absolute HTTPS URL of the academy logo (yuva-public bucket) or null. */
  logoUrl: string | null;
  /** Chapter name, e.g. "Erode" (shown under the signature block). */
  chapter: string;
  /** Run start/end as display strings (already formatted) or null. */
  startDate: string | null;
  endDate: string | null;
  /** Permanent certificate number, e.g. "YYA-2026-0001". */
  certificateNo: string;
  /** Issue date as a display string. */
  issuedOn: string;
  /**
   * Per-academy signature blocks (configured in the UI, decision 2026-06-11).
   * `label` is required; `name` is optional (shown above the line if present).
   * Rendered max 3 blocks. EMPTY array → fall back to the two generic blocks
   * (Chapter Chair / Yi {chapter}; Institution Coordinator / {academyName}) so
   * existing certificates do not regress.
   */
  signatories: { label: string; name?: string | null }[];
}

// ─── STYLES (dummy design — navy/amber Yi palette) ─────────────────
const NAVY = "#0f2557";
const AMBER = "#F5A623";
const SLATE = "#5b6478";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 20,
    fontFamily: "Helvetica",
    color: NAVY,
  },
  frame: {
    flex: 1,
    borderWidth: 2,
    borderColor: NAVY,
    padding: 5,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: AMBER,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  watermark: {
    position: "absolute",
    top: "28%",
    left: "38%",
    width: 200,
    height: 200,
    opacity: 0.05,
    objectFit: "contain",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  logo: {
    width: 56,
    height: 56,
    marginRight: 14,
    objectFit: "contain",
  },
  academyBlock: {
    flexDirection: "column",
    alignItems: "center",
  },
  academyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    color: NAVY,
    textTransform: "uppercase",
  },
  academySub: {
    fontSize: 8,
    color: SLATE,
    letterSpacing: 2,
    marginTop: 3,
    textTransform: "uppercase",
  },
  rule: {
    width: 120,
    borderBottomWidth: 1.5,
    borderBottomColor: AMBER,
    marginVertical: 8,
  },
  certTitle: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    color: NAVY,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  certSubtitle: {
    fontSize: 9,
    color: SLATE,
    letterSpacing: 1.5,
    marginTop: 3,
    textTransform: "uppercase",
  },
  presentedTo: {
    fontSize: 10,
    color: SLATE,
    marginTop: 12,
    letterSpacing: 1,
  },
  studentName: {
    fontSize: 24,
    fontFamily: "Times-BoldItalic",
    color: NAVY,
    marginTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: SLATE,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  bodyText: {
    fontSize: 11,
    color: "#27314a",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 1.5,
    maxWidth: 620,
  },
  bodyPara: {
    fontSize: 10,
    color: "#27314a",
    marginTop: 7,
    textAlign: "center",
    lineHeight: 1.5,
    maxWidth: 620,
  },
  congrats: {
    fontSize: 10,
    fontFamily: "Times-Italic",
    color: SLATE,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 1.4,
    maxWidth: 620,
  },
  issueLine: {
    fontSize: 10,
    color: NAVY,
    marginTop: 8,
  },
  issueLabel: {
    fontFamily: "Helvetica-Bold",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  programName: {
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 28,
  },
  signatureBlock: {
    width: 170,
    alignItems: "center",
  },
  signatureLine: {
    alignSelf: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    height: 26,
    marginBottom: 5,
    justifyContent: "flex-end",
  },
  signatureName: {
    fontSize: 11,
    fontFamily: "Times-Italic",
    color: NAVY,
    textAlign: "center",
    paddingBottom: 3,
  },
  signatureLabel: {
    fontSize: 8,
    color: SLATE,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d8e2",
  },
  footerText: {
    fontSize: 8,
    color: SLATE,
    letterSpacing: 1,
  },
  certNo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 1,
  },
});

// ─── THE COMPONENT ──────────────────────────────────────────────────
export function CertificatePDF(props: CertificatePdfProps) {
  const dateRange =
    props.startDate && props.endDate
      ? `${props.startDate} to ${props.endDate}`
      : (props.startDate ?? props.endDate ?? null);

  // Configured signature blocks (decision 2026-06-11). Trim, drop entries with
  // a blank label, cap at 3. EMPTY → fall back to the original two generic
  // blocks so already-issued certificates do not regress.
  const configured = (props.signatories ?? [])
    .map((s) => ({
      label: (s.label ?? "").trim(),
      name: (s.name ?? "").trim() || null,
    }))
    .filter((s) => s.label.length > 0)
    .slice(0, 3);
  const signatureBlocks: { label: string; name: string | null }[] =
    configured.length > 0
      ? configured
      : [
          { label: `Chapter Chair\nYi ${props.chapter}`, name: null },
          {
            label: `Institution Coordinator\n${props.academyName}`,
            name: null,
          },
        ];

  return (
    <Document
      title={`Certificate ${props.certificateNo} — ${props.studentName}`}
      author={props.academyName}
      subject={`Certificate of Completion — ${props.programName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.innerFrame}>
            {/* Faint centered watermark (academy logo) — anti-blank zone */}
            {props.logoUrl ? (
              <Image src={props.logoUrl} style={styles.watermark} fixed />
            ) : null}

            {/* Placeholder zone: academy display name + logo */}
            <View style={styles.headerRow}>
              {props.logoUrl ? (
                // Remote https URL works when rendering on Node.
                <Image src={props.logoUrl} style={styles.logo} />
              ) : null}
              <View style={styles.academyBlock}>
                <Text style={styles.academyName}>{props.academyName}</Text>
                <Text style={styles.academySub}>
                  Young Indians · Yi YUVA · CII
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            <Text style={styles.certTitle}>Certificate</Text>
            <Text style={styles.certSubtitle}>of Completion</Text>

            {/* Variable zone: student name */}
            <Text style={styles.presentedTo}>This is to certify that</Text>
            <Text style={styles.studentName}>{props.studentName}</Text>

            {/* Approved body copy (variable zones: institution, program, dates) */}
            <Text style={styles.bodyText}>
              {props.institutionName ? (
                <>
                  of <Text style={styles.bold}>{props.institutionName}</Text>{" "}
                </>
              ) : null}
              has successfully completed the{" "}
              <Text style={styles.programName}>{props.programName}</Text>{" "}
              Certificate Program conducted by{" "}
              <Text style={styles.bold}>Yi YUVA</Text> through the{" "}
              <Text style={styles.bold}>{props.academyName}</Text>
              {dateRange ? (
                <>
                  {" "}from <Text style={styles.bold}>{dateRange}</Text>
                </>
              ) : null}
              .
            </Text>
            <Text style={styles.bodyPara}>
              The participant has successfully completed all requirements of the
              program and demonstrated commitment to learning, leadership, and
              personal development throughout the course.
            </Text>
            <Text style={styles.bodyPara}>
              In recognition of this achievement, this Certificate of Completion
              is hereby awarded.
            </Text>
            <Text style={styles.issueLine}>
              <Text style={styles.issueLabel}>Date of Issue: </Text>
              {props.issuedOn}
            </Text>
            <Text style={styles.congrats}>
              We congratulate {props.studentName} on this accomplishment and wish
              them continued success in their academic, professional, and
              leadership journey.
            </Text>

            {/* Placeholder zone: signature blocks (dummy — Director's
                design will define the real signatories/artwork) */}
            <View style={styles.signatureRow}>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>
                  Chapter Chair{"\n"}Yi {props.chapter}
                </Text>
              </View>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>
                  Institution Coordinator{"\n"}{props.academyName}
                </Text>
              </View>
            </View>

            {/* Placeholder zone: certificate number + issue date */}
            <View style={styles.footerRow}>
              <Text style={styles.certNo}>
                Certificate No: {props.certificateNo}
              </Text>
              <Text style={styles.footerText}>
                Young Indians · Yi YUVA · CII
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Render the certificate to a PDF Buffer (server-side, Node runtime). */
export async function renderCertificatePdfBuffer(
  props: CertificatePdfProps
): Promise<Buffer> {
  const element = <CertificatePDF {...props} />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await renderToBuffer(element as any);
}
