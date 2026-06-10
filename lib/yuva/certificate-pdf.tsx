/**
 * Yi Youth Academy — e-certificate PDF (Phase 14).
 *
 * ⚠️ DESIGN FILE PENDING FROM THE DIRECTOR — this is the clean DUMMY design
 * for the v1 build. Placeholder zones (per spec Assumptions): student name,
 * program name, academy display name + logo, dates, certificate number,
 * signature blocks. Swap the layout for the Director's design file when it
 * arrives; the props contract below should survive the swap.
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
}

// ─── STYLES (dummy design — navy/amber Yi palette) ─────────────────
const NAVY = "#0f2557";
const AMBER = "#F5A623";
const SLATE = "#5b6478";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 28,
    fontFamily: "Helvetica",
    color: NAVY,
  },
  frame: {
    flex: 1,
    borderWidth: 2,
    borderColor: NAVY,
    padding: 6,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: AMBER,
    paddingVertical: 28,
    paddingHorizontal: 48,
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
    marginVertical: 12,
  },
  certTitle: {
    fontSize: 26,
    fontFamily: "Times-Bold",
    color: NAVY,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  certSubtitle: {
    fontSize: 10,
    color: SLATE,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: "uppercase",
  },
  presentedTo: {
    fontSize: 10,
    color: SLATE,
    marginTop: 20,
    letterSpacing: 1,
  },
  studentName: {
    fontSize: 30,
    fontFamily: "Times-BoldItalic",
    color: NAVY,
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: SLATE,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  bodyText: {
    fontSize: 11,
    color: "#27314a",
    marginTop: 16,
    textAlign: "center",
    lineHeight: 1.6,
    maxWidth: 520,
  },
  programName: {
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  datesLine: {
    fontSize: 10,
    color: SLATE,
    marginTop: 6,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: "auto",
    paddingTop: 24,
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
      ? `${props.startDate} – ${props.endDate}`
      : (props.startDate ?? props.endDate ?? null);

  return (
    <Document
      title={`Certificate ${props.certificateNo} — ${props.studentName}`}
      author={props.academyName}
      subject={`Certificate of Completion — ${props.programName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.innerFrame}>
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

            {/* Placeholder zone: student name */}
            <Text style={styles.presentedTo}>This is to certify that</Text>
            <Text style={styles.studentName}>{props.studentName}</Text>

            {/* Placeholder zones: program name + dates */}
            <Text style={styles.bodyText}>
              has successfully completed the program{" "}
              <Text style={styles.programName}>{props.programName}</Text>
              {" "}conducted by {props.academyName}.
            </Text>
            {dateRange ? (
              <Text style={styles.datesLine}>Program dates: {dateRange}</Text>
            ) : null}

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
                Issued on {props.issuedOn} · Yi Youth Academy
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
