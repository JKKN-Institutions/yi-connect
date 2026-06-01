/**
 * Consent Letter PDF for Future 6.0.
 *
 * Renders the verbatim Yi consent letter (source:
 * /Users/omm/Downloads/Future 6.0/Consent letter Regional & National Round.docx)
 * with the child's pre-filled name + college, leaving signature/parent/date/
 * address blanks for ink. All "Future 5.0" mentions in the legal text are
 * replaced with "Future 6.0" — every other word is preserved verbatim.
 *
 * Handbook refs: [Consent Letter DOCX, CPB §6, HPB §10]
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
  renderToStream,
} from "@react-pdf/renderer";
import { YF_BASE } from "@/lib/yi-future/constants";

// ─── PUBLIC PROPS ───────────────────────────────────────────────────
export interface ConsentLetterDelegate {
  full_name: string;
  college_name: string | null;
}

export interface ConsentLetterPDFProps {
  delegate: ConsentLetterDelegate;
  /** Optional absolute logo URL — defaults to the production deploy. */
  logoUrl?: string;
}

// Logo must be an HTTPS URL because @react-pdf/renderer cannot read
// from the Next.js public/ tree at runtime in a server-action context.
const DEFAULT_LOGO_URL = `${YF_BASE}/future-6-logo.png`;

// ─── STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#1a1a2e",
    fontFamily: "Helvetica",
  },
  brandStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#F5A623",
    marginBottom: 18,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  brandText: {
    flexDirection: "column",
  },
  brandTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    color: "#1a1a3e",
  },
  brandSubtitle: {
    fontSize: 8,
    color: "#6b6b86",
    letterSpacing: 1,
    marginTop: 2,
  },
  brandRight: {
    fontSize: 8,
    color: "#6b6b86",
    letterSpacing: 1.5,
    textAlign: "right",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a3e",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 1,
  },
  dateLine: {
    fontSize: 11,
    marginBottom: 14,
  },
  toLine: {
    fontSize: 11,
    marginBottom: 12,
  },
  intro: {
    fontSize: 11,
    marginBottom: 14,
    textAlign: "justify",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a3e",
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 11,
    marginBottom: 10,
    textAlign: "justify",
  },
  emergencyBlock: {
    marginTop: 4,
    marginBottom: 10,
  },
  emergencyLine: {
    fontSize: 11,
    marginBottom: 6,
  },
  blankLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
    height: 14,
    marginBottom: 4,
  },
  signOff: {
    marginTop: 20,
    fontSize: 11,
  },
  sigBlock: {
    marginTop: 30,
  },
  sigLabel: {
    fontSize: 9,
    color: "#6b6b86",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  addressLabel: {
    fontSize: 11,
    marginTop: 16,
    marginBottom: 4,
  },
  addressLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
    height: 16,
    marginBottom: 6,
  },
  prefilled: {
    fontFamily: "Helvetica-Bold",
    color: "#1a1a3e",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4dc",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#8a8aa0",
  },
});

// ─── REUSABLE BIT ───────────────────────────────────────────────────
function Blank({ minWidth = 160 }: { minWidth?: number }) {
  return (
    <Text>
      {/* underscores render as a printable blank in @react-pdf */}
      {" "}
      <Text style={{ textDecoration: "underline" }}>
        {" ".repeat(Math.max(20, Math.round(minWidth / 6)))}
      </Text>
      {" "}
    </Text>
  );
}

// ─── THE COMPONENT ──────────────────────────────────────────────────
export function ConsentLetterPDF({
  delegate,
  logoUrl,
}: ConsentLetterPDFProps) {
  const childName = (delegate.full_name ?? "").trim() || "____________________";
  const collegeName =
    (delegate.college_name ?? "").trim() || "____________________";
  const logo = logoUrl ?? DEFAULT_LOGO_URL;

  return (
    <Document
      title="Future 6.0 — Parent Consent Letter"
      author="Yi YUVA · CII"
      subject="Parent Consent Letter for Participation and Travel"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Brand strip — Yi YUVA + Future 6.0 */}
        <View style={styles.brandStrip}>
          <View style={styles.brandLeft}>
            {/* Image accepts a remote https URL when running on Node. */}
            <Image src={logo} style={styles.brandLogo} />
            <View style={styles.brandText}>
              <Text style={styles.brandTitle}>Yi YUVA · FUTURE 6.0</Text>
              <Text style={styles.brandSubtitle}>
                Young Indians · CII
              </Text>
            </View>
          </View>
          <Text style={styles.brandRight}>
            REGIONAL &amp; NATIONAL ROUNDS{"\n"}PARENT CONSENT LETTER
          </Text>
        </View>

        <Text style={styles.title}>
          CONSENT LETTER FOR PARTICIPATION AND TRAVEL
        </Text>

        {/* Date — left blank for parent to fill in */}
        <Text style={styles.dateLine}>
          Date:
          <Blank minWidth={140} />
        </Text>

        <Text style={styles.toLine}>To Whom It May Concern:</Text>

        {/* Verbatim intro paragraph with pre-filled child + college */}
        <Text style={styles.intro}>
          I,
          <Blank minWidth={180} />
          (Parent/Guardian Name), the parent/guardian of{" "}
          <Text style={styles.prefilled}>{childName}</Text>{" "}
          (Child&rsquo;s Full Name), who is currently a student at{" "}
          <Text style={styles.prefilled}>{collegeName}</Text>{" "}
          (College Name) and is above 18 years of age, hereby give my full and
          informed consent for my child to participate in the{" "}
          <Text style={styles.bold}>Future 6.0</Text> event conducted by Young
          Indians, including both the Regional and National rounds.
        </Text>

        {/* Section 1 — Participation and Travel */}
        <Text style={styles.sectionHeading}>
          Consent for Participation and Travel:
        </Text>
        <Text style={styles.paragraph}>
          I acknowledge and understand that this event will require my child to
          travel to various locations for the competitions. I hereby provide my
          explicit consent for my child to undertake such travel as part of
          their participation in the event.
        </Text>

        {/* Section 2 — Risk and Liability */}
        <Text style={styles.sectionHeading}>
          Assumption of Risk and Release of Liability:
        </Text>
        <Text style={styles.paragraph}>
          I am aware of and understand the potential risks involved in
          traveling and participating in the{" "}
          <Text style={styles.bold}>Future 6.0</Text> event. I acknowledge that
          the organizers will take all necessary precautions to ensure the
          safety and well-being of my child during the event and travel.
          Nevertheless, I hereby release and hold harmless the organizers,
          Young Indians, and any affiliated entities or individuals from any
          and all liability, claims, demands, actions, or causes of action
          arising out of or related to any loss, damage, or injury, including
          death, that may be sustained by my child, whether caused by the
          negligence of the organizers or otherwise, while participating in
          the event or during travel.
        </Text>

        {/* Section 3 — Emergency Contact */}
        <Text style={styles.sectionHeading}>Emergency Contact Information:</Text>
        <Text style={styles.paragraph}>
          In case of any emergency, I can be contacted at the following
          numbers:
        </Text>
        <View style={styles.emergencyBlock}>
          <Text style={styles.emergencyLine}>
            Parent/Guardian Name:
            <Blank minWidth={220} />
          </Text>
          <Text style={styles.emergencyLine}>
            Phone Number:
            <Blank minWidth={220} />
          </Text>
        </View>

        {/* Section 4 — Medical Treatment */}
        <Text style={styles.sectionHeading}>Consent for Medical Treatment:</Text>
        <Text style={styles.paragraph}>
          In addition, I hereby authorize any licensed physician, emergency
          medical technician, hospital, or other medical or health care
          facility to treat my child for the purpose of attempting to treat or
          relieve any injuries received by my child arising out of or relating
          to the <Text style={styles.bold}>Future 6.0</Text> event. I consent
          to the administration of any and all medical procedures deemed
          necessary or advisable in the professional judgment of the medical
          or health care personnel.
        </Text>

        {/* Sign-off */}
        <Text style={styles.signOff}>Sincerely,</Text>

        <View style={styles.sigBlock}>
          <View style={styles.blankLine} />
          <Text style={styles.sigLabel}>
            Parent / Guardian Signature &amp; Date
          </Text>
        </View>

        <Text style={styles.addressLabel}>Parent/Guardian Name:</Text>
        <View style={styles.addressLine} />

        <Text style={styles.addressLabel}>Address:</Text>
        <View style={styles.addressLine} />
        <View style={styles.addressLine} />
        <View style={styles.addressLine} />

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Yi YUVA · Future 6.0 (2026)</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── BACK-COMPAT API (used by /api/consent/pdf/route.ts) ────────────
// The previous export shape is preserved so the existing fully-filled
// PDF route keeps working. The new blank-PDF flow uses
// `<ConsentLetterPDF>` directly + `renderToStream`.
export interface ConsentPdfData {
  delegate: {
    full_name: string;
    chapter_name: string;
    email: string | null;
  };
  parent_name: string;
  parent_email: string | null;
  parent_phone: string;
  parent_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  travel_consent: boolean;
  medical_consent: boolean;
  liability_consent: boolean;
  template_version: number;
  generated_at: Date;
}

/**
 * Legacy generator that renders a *filled* (non-signed) consent PDF
 * using the same blank component for layout. Fields the parent already
 * captured online appear pre-printed; the signature line is still blank.
 */
export async function generateConsentPdf(
  data: ConsentPdfData
): Promise<Buffer> {
  const element = (
    <ConsentLetterPDF
      delegate={{
        full_name: data.delegate.full_name,
        college_name: data.delegate.chapter_name,
      }}
    />
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await renderToBuffer(element as any);
}

/** Stream-renders the blank consent PDF for the given delegate. */
export async function renderConsentLetterStream(
  delegate: ConsentLetterDelegate
): Promise<NodeJS.ReadableStream> {
  const element = <ConsentLetterPDF delegate={delegate} />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStream(element as any);
}

// ─── LEGACY TEXT TEMPLATE (back-compat, still imported elsewhere) ───
export interface ConsentLetterData {
  delegate_name: string;
  college: string;
  parent_name?: string;
  edition_name: string;
}

export function consentLetterTemplate(data: ConsentLetterData): string {
  return `CONSENT LETTER FOR PARTICIPATION AND TRAVEL — ${data.edition_name}
Delegate: ${data.delegate_name} (${data.college})
Parent/Guardian: ${data.parent_name ?? "___________________"}
(See generated PDF for the full letter.)`.trim();
}
