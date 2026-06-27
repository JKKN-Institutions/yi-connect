// Blank, fillable bill-drafting template — generated client-side as a Word
// document (HTML that Word opens natively, saved as .doc). Zero dependencies.
// Lets large committees pre-draft their bill offline, then type it into the
// Yi Connect app. Mirrors the in-app bill fields exactly so nothing is lost in
// transcription: Title, Objective, Problem Statement, 3 Key Provisions,
// Expected Impact, Implementation Mechanism.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A labelled section with a ruled, fill-in area. */
function field(label: string, hint: string, lines: number): string {
  const blanks = Array.from({ length: lines })
    .map(
      () =>
        `<p class="line">&nbsp;</p>`
    )
    .join("");
  return `
    <h2>${esc(label)}</h2>
    <p class="hint">${esc(hint)}</p>
    ${blanks}`;
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
<title>Bill Drafting Template</title>
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
  <h1>Youth Parliament &#8212; Bill Drafting Template</h1>
  <p class="sub">Committee: ${committee}</p>
  ${topicRow}
  ${schemeRow}
  <p class="meta">Draft your bill below, then type it into the Yi Connect app to submit.</p>

  ${field("Bill Title", "e.g., The Youth Digital Literacy Bill, 2026", 1)}
  ${field("Objective", "What does this bill aim to achieve?", 2)}
  ${field("Problem Statement", "What problem does this bill address? (1-2 lines)", 2)}

  <h2>3 Key Provisions</h2>
  <p class="hint">The core clauses of the bill.</p>
  <p class="meta"><strong>Provision 1</strong></p>
  <p class="line">&nbsp;</p>
  <p class="meta"><strong>Provision 2</strong></p>
  <p class="line">&nbsp;</p>
  <p class="meta"><strong>Provision 3</strong></p>
  <p class="line">&nbsp;</p>

  ${field("Expected Impact", "What positive impact will this bill have?", 2)}
  ${field("Implementation Mechanism", "How will this bill be implemented?", 2)}

  <p class="note">Yi Connect &#183; Youth Parliament &#8212; fill this in offline, then enter it in the app.</p>
</body>
</html>`;
}
