/**
 * YIQ email-correction checks.
 *
 *     npx tsx lib/yiq/__tests__/recipients.check.ts
 *
 * A wrong address here means a team never receives its access codes and
 * cannot sit the round at all. The validator has to be strict enough to catch
 * the damage a spreadsheet paste does, and loose enough not to reject the real
 * addresses schools actually use.
 */
import {
  validateEmailChange,
  resendTagFor,
  EMAIL_CHANGE_REFUSAL_TEXT,
  MAX_EMAIL_LENGTH,
  type EmailChangeRefusal,
} from "../email/recipients";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
}
const OLD = "typo@shcool.edu.in";
function refusal(name: string, input: unknown, want: EmailChangeRefusal, current = OLD) {
  const d = validateEmailChange(input, current);
  check(name, d.ok === false && d.reason === want,
    d.ok ? "was ACCEPTED" : `reason ${d.reason} want ${want}`);
}

console.log("\n── accepted: the corrections a real organiser types ──");
eq("a plain corrected address",
  validateEmailChange("head@school.edu.in", OLD), { ok: true, email: "head@school.edu.in", changed: true });
eq("uppercase is normalised down",
  validateEmailChange("HEAD@School.EDU.in", OLD), { ok: true, email: "head@school.edu.in", changed: true });
eq("surrounding whitespace is trimmed, not rejected",
  validateEmailChange("  head@school.edu.in  ", OLD), { ok: true, email: "head@school.edu.in", changed: true });
check("a plus-addressed school inbox is allowed",
  validateEmailChange("yiq+2026@school.edu.in", OLD).ok === true);
check("a dotted local part is allowed",
  validateEmailChange("k.r.priya@school.edu.in", OLD).ok === true);
check("a long multi-level domain is allowed",
  validateEmailChange("office@sec.school.tn.gov.in", OLD).ok === true);
check("a hyphenated domain is allowed",
  validateEmailChange("head@st-marys.edu.in", OLD).ok === true);
check("there was no current address at all",
  validateEmailChange("head@school.edu.in", null).ok === true);

console.log("\n── refused: not an address ──");
refusal("empty", "", "empty");
refusal("whitespace only", "   ", "empty");
refusal("null", null, "empty");
refusal("undefined", undefined, "empty");
refusal("a number", 42, "empty");
refusal("no @ at all", "head.school.edu.in", "no_at");
refusal("two @", "head@@school.edu.in", "malformed");
refusal("two @ far apart", "head@school@edu.in", "malformed");
refusal("nothing before the @", "@school.edu.in", "malformed");
refusal("nothing after the @", "head@", "malformed");
refusal("a domain with no dot", "head@school", "malformed");
refusal("a domain starting with a dot", "head@.school", "malformed");
refusal("a domain ending with a dot", "head@school.", "malformed");

console.log("\n── refused: spreadsheet and copy-paste damage ──");
refusal("a display name pasted in", "Head Teacher <head@school.edu.in>", "malformed");
refusal("a trailing comma from a list", "head@school.edu.in,", "malformed");
refusal("a semicolon-separated pair", "a@b.in;c@d.in", "malformed");
refusal("an internal space", "head @school.edu.in", "malformed");
refusal("a smuggled newline", "head@school.edu.in\nbcc: evil@x.in", "malformed");
refusal("an internal tab", "head@school\t.edu.in", "malformed");
// A TRAILING tab is the ordinary result of copying a spreadsheet cell. It is
// trimmed like any other surrounding whitespace, not rejected — refusing it
// would make the organiser hunt for an invisible character.
check("a trailing tab from a spreadsheet cell is trimmed, not refused",
  validateEmailChange("head@school.edu.in\t", OLD).ok === true);
refusal("a quoted string", '"head"@school.edu.in', "malformed");
refusal("a very long paste", "a".repeat(MAX_EMAIL_LENGTH + 1) + "@school.edu.in", "too_long");
eq("the length cap is the RFC path limit", MAX_EMAIL_LENGTH, 254);

console.log("\n── refused: nothing actually changed ──");
refusal("the same address again", OLD, "unchanged");
refusal("the same address in different case", "TYPO@SHCOOL.EDU.IN", "unchanged");
refusal("the same address with padding", "  typo@shcool.edu.in ", "unchanged");
check("but a genuine correction of one letter IS a change",
  validateEmailChange("typo@school.edu.in", OLD).ok === true);

console.log("\n── the resend tag ──");
// dedupe_key is UNIQUE and enqueue ignores duplicates, so WITHOUT a fresh tag
// a resend silently queues nothing and the organiser is told "sent".
const t1 = resendTagFor(1756280000000);
const t2 = resendTagFor(1756280001000);
check("a tag is produced", typeof t1 === "string" && t1.length > 0);
check("two different seconds give two different tags", t1 !== t2);
eq("the same instant gives the same tag (a double-click sends once)",
  resendTagFor(1756280000000), t1);
check("the tag is recognisable in a dedupe key", t1.startsWith("resend-"));

console.log("\n── every refusal has readable text ──");
const REASONS: EmailChangeRefusal[] = ["empty", "too_long", "no_at", "malformed", "unchanged"];
for (const r of REASONS) {
  check(`  ${r} has a sentence`,
    typeof EMAIL_CHANGE_REFUSAL_TEXT[r] === "string" && EMAIL_CHANGE_REFUSAL_TEXT[r].length > 10);
}
check("the 'unchanged' message tells them what to do instead",
  EMAIL_CHANGE_REFUSAL_TEXT.unchanged.toLowerCase().includes("resend"));

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
