/*
 * vCard 3.0 for ONE scanned business-card contact. Pure: no server or
 * relative imports, so a node script can check it.
 */

export type VcardContact = {
  full_name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  note: string | null;
};

/** vCard text value: backslash, comma, semicolon and newlines escaped. */
export function vcEscape(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Folds a content line at 75 octets (RFC 2425), never splitting a UTF-8 character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildCardVcard(c: VcardContact, eventName: string): string {
  const name = (c.full_name ?? "").trim() || (c.company ?? "").trim() || "Business card";
  const parts = (c.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const family = parts.length > 1 ? parts[parts.length - 1] : "";
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vcEscape(family)};${vcEscape(given)};;;`, `FN:${vcEscape(name)}`];
  if (c.company) lines.push(`ORG:${vcEscape(c.company)}`);
  if (c.title) lines.push(`TITLE:${vcEscape(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${vcEscape(c.phone)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${vcEscape(c.email)}`);
  if (c.website) lines.push(`URL:${vcEscape(/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`)}`);
  if (c.city) lines.push(`ADR;TYPE=WORK:;;;${vcEscape(c.city)};;;`);
  const note = [`Card scanned at ${eventName}`];
  if (c.note) note.push(c.note);
  lines.push(`NOTE:${vcEscape(note.join(". "))}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A safe download file name for one contact, e.g. "priya-raman.vcf". */
export function vcardFileName(c: Pick<VcardContact, "full_name" | "company">): string {
  const base = ((c.full_name || c.company || "contact") as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "contact"}.vcf`;
}
