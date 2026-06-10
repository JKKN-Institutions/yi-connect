/**
 * One-off sample render for the Phase 14 visual-artifact gate (rule 25).
 * NOT committed — run with: npx tsx lib/yuva/__tests__/.render-cert-sample.tsx
 */
import { writeFileSync } from "node:fs";
import { renderCertificatePdfBuffer } from "../certificate-pdf";

async function main() {
  const base = {
    studentName: "Ananya Krishnamurthy",
    programName: "Young Entrepreneurs Bootcamp — Cohort 1",
    academyName: "Yi Erode Youth Academy",
    chapter: "Erode",
    startDate: "12 Jan 2026",
    endDate: "20 Mar 2026",
    certificateNo: "YYA-2026-0001",
    issuedOn: "11 Jun 2026",
  };

  // Try with a real remote logo first (layout check); fall back to no-logo.
  let buffer: Buffer;
  try {
    buffer = await renderCertificatePdfBuffer({
      ...base,
      // High-res Yi logo — representative of real uploaded academy logos.
      logoUrl: "https://yi-connect-app.vercel.app/yip/logos/yi-logo.png",
    });
    console.log("rendered WITH remote logo");
  } catch (e) {
    console.log(
      "remote logo failed (" +
        (e as Error).message +
        ") — rendering without logo"
    );
    buffer = await renderCertificatePdfBuffer({ ...base, logoUrl: null });
  }

  writeFileSync("/tmp/yuva-cert-sample.pdf", buffer);
  console.log("wrote /tmp/yuva-cert-sample.pdf —", buffer.length, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
