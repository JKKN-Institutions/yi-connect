/**
 * YIQ redirect-safety checks.
 *
 *     npx tsx lib/yiq/__tests__/safe-redirect.check.ts
 *
 * This decides where our own sign-in page sends a person afterwards, using a
 * value an attacker can put in a link. A hole here turns the YIQ sign-in into
 * a phishing hop wearing our own branding, so every escape route is asserted
 * rather than assumed.
 */
import { safeYiqRedirect, YIQ_DEFAULT_LANDING } from "../safe-redirect";

let pass = 0, fail = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    pass++; console.log(`  ✓ ${name}`);
  } else {
    fail++; console.log(`  ✗ ${name} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
  }
}
const D = YIQ_DEFAULT_LANDING;

console.log("\n── accepted ──");
eq("a plain yiq path", safeYiqRedirect("/yiq/quiz/abc"), "/yiq/quiz/abc");
eq("the yiq root", safeYiqRedirect("/yiq"), "/yiq");
eq("a yiq path with a query", safeYiqRedirect("/yiq/me?tab=papers"), "/yiq/me?tab=papers");
eq("the yiq root with a query", safeYiqRedirect("/yiq?x=1"), "/yiq?x=1");
eq("an admin path inside yiq (its own gate decides)", safeYiqRedirect("/yiq/admin/questions"), "/yiq/admin/questions");
eq("surrounding whitespace is trimmed, not rejected", safeYiqRedirect("  /yiq/me  "), "/yiq/me");

console.log("\n── rejected: leaves the site ──");
eq("an absolute https url", safeYiqRedirect("https://evil.example/x"), D);
eq("an absolute http url", safeYiqRedirect("http://evil.example"), D);
eq("a protocol-relative url", safeYiqRedirect("//evil.example/x"), D);
eq("a backslash-prefixed url", safeYiqRedirect("/\\evil.example"), D);
eq("a javascript: url", safeYiqRedirect("javascript:alert(1)"), D);
eq("a data: url", safeYiqRedirect("data:text/html,<script>"), D);
eq("a scheme in mixed case", safeYiqRedirect("JaVaScRiPt:alert(1)"), D);
eq("a backslash anywhere in the path", safeYiqRedirect("/yiq/me\\@evil.example"), D);

console.log("\n── rejected: outside this vertical ──");
eq("another vertical", safeYiqRedirect("/yip/dashboard"), D);
eq("the site root", safeYiqRedirect("/"), D);
eq("a lookalike prefix", safeYiqRedirect("/yiqevil/steal"), D);
eq("a lookalike prefix with a dash", safeYiqRedirect("/yiq-evil"), D);
eq("a relative path", safeYiqRedirect("yiq/me"), D);
eq("a parent traversal", safeYiqRedirect("../yiq/me"), D);

console.log("\n── rejected: not usable at all ──");
eq("empty string", safeYiqRedirect(""), D);
eq("whitespace only", safeYiqRedirect("   "), D);
eq("null", safeYiqRedirect(null), D);
eq("undefined", safeYiqRedirect(undefined), D);
eq("a number", safeYiqRedirect(42), D);
eq("an array (Next hands one back for a repeated param)", safeYiqRedirect(["/yiq/me"]), D);
eq("an object with a helpful toString", safeYiqRedirect({ toString: () => "/yiq/me" }), D);

console.log("\n── rejected: smuggled control characters ──");
eq("a newline (header smuggling)", safeYiqRedirect("/yiq/me\nLocation: https://evil.example"), D);
eq("a carriage return", safeYiqRedirect("/yiq/me\rLocation: https://evil.example"), D);
eq("a tab inside the path", safeYiqRedirect("/yiq\t/me"), D);
eq("a NUL byte", safeYiqRedirect("/yiq/me\u0000.evil"), D);
eq("a DEL byte", safeYiqRedirect("/yiq/me\u007f"), D);

console.log("\n── the fallback is honoured ──");
eq("a custom fallback is used on rejection", safeYiqRedirect("https://evil.example", "/yiq/login"), "/yiq/login");
eq("the default fallback is the student's own page", D, "/yiq/me");

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
