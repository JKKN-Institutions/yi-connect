// Blank, fillable bill-drafting template — generated client-side as a Word
// document (HTML that Word opens natively, saved as .doc). Zero dependencies.
// Lets large committees pre-draft their bill offline, then type it into the
// Yi Connect app.
//
// Follows the OFFICIAL national "Mock Parliament Bill Template" 9 sections:
// Title, Preamble, Definitions, Objectives (2-4), Key Provisions, Implementation
// Plan, Funding/Budget, Expected Impact, Conclusion/Call to Action — plus the
// optional add-ons (supporting data, co-signatures, Drafter/Rapporteur). Mirrors
// the in-app Committee Room fields exactly so nothing is lost in transcription.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A labelled section with a ruled, fill-in area. */
function field(label: string, hint: string, lines: number): string {
  const blanks = Array.from({ length: lines })
    .map(() => `<p class="line">&nbsp;</p>`)
    .join("");
  const hintRow = hint ? `<p class="hint">${esc(hint)}</p>` : "";
  return `
    <h2>${esc(label)}</h2>
    ${hintRow}
    ${blanks}`;
}

/** A numbered list of N ruled fill-in rows (objectives / provisions). */
function numbered(label: string, hint: string, prefix: string, count: number): string {
  const rows = Array.from({ length: count })
    .map(
      (_, i) =>
        `<p class="meta"><strong>${esc(prefix)} ${i + 1}</strong></p><p class="line">&nbsp;</p>`
    )
    .join("");
  return `
    <h2>${esc(label)}</h2>
    <p class="hint">${esc(hint)}</p>
    ${rows}`;
}

export function buildBillTemplateDoc(opts: {
  committeeName: string | null;
  topic?: string | null;
  scheme?: string | null;
}): string {
  const committee = opts.committeeName ? esc(opts.committeeName) : "____________________";
  const topicRow = opts.topic
    ? `<p class="meta"><strong>Topic:</strong> ${esc(opts.topic)}</p>`
    : "";
  const schemeRow = opts.scheme
    ? `<p class="meta"><strong>Linked scheme / policy:</strong> ${esc(opts.scheme)}</p>`
    : "";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>Mock Parliament Bill Template</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1a1a1a; font-size: 12pt; line-height: 1.5; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  .sub { color: #6b21a8; font-weight: bold; margin: 0 0 12pt; }
  .meta { margin: 2pt 0; }
  h2 { font-size: 12.5pt; margin: 16pt 0 2pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
  .hint { color: #777; font-size: 9.5pt; margin: 0 0 6pt; font-style: italic; }
  .line { border-bottom: 1px solid #cccccc; min-height: 16pt; margin: 0 0 8pt; }
  .note { margin-top: 22pt; color: #777; font-size: 9.5pt; }
</style>
</head>
<body>
  <h1>Mock Parliament &#8212; Bill Template</h1>
  <p class="sub">Committee: ${committee}</p>
  ${topicRow}
  ${schemeRow}
  <p class="meta">Draft your bill below, then type it into the Yi Connect app to submit.</p>

  ${field("1. Title of the Bill", "A concise, descriptive title reflecting the core intent of the bill.", 1)}
  ${field("2. Preamble", "A brief introduction outlining the rationale — the issue it addresses and its significance.", 3)}
  ${field("3. Definitions", "Define any complex or technical terms used in the bill, to avoid misinterpretation.", 3)}
  ${numbered("4. Objectives of the Bill", "2 to 4 key objectives — specific, measurable, and aligned with the purpose.", "Objective", 4)}
  ${numbered("5. Key Provisions (Sections)", "The primary actions or rules — each enforceable, realistic, and precise.", "Provision", 5)}
  ${field("6. Implementation Plan", "How the bill is executed — responsible bodies, key timelines, and processes.", 3)}
  ${field("7. Funding / Budget (if relevant)", "Estimated funding required and the sources (govt allocation, sponsorship, PPP, etc.).", 3)}
  ${field("8. Expected Impact", "Intended benefits, improvements, and any measurable changes anticipated.", 3)}
  ${field("9. Conclusion / Call to Action", "A compelling summary reinforcing the urgency and importance; encourage stakeholders to act.", 3)}

  <h2>Optional Add-ons</h2>
  <p class="hint">Supporting data / graphs &#183; Co-signatures from all 30 students or committee members.</p>
  ${field("Name of the Drafter", "", 1)}
  ${field("Name of the Rapporteur", "", 1)}

  <p class="note">Yi Connect &#183; Mock Parliament &#8212; fill this in offline, then enter it in the app.</p>
</body>
</html>`;
}
