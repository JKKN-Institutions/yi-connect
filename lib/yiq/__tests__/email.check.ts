/**
 * YIQ access-code email checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/email.check.ts
 *
 * It exits non-zero on any failure. Only the PURE parts are covered — the
 * templates, the email predicate and the dedupe keys. The queue writer and
 * the cron drain need a database and a mail provider, so they are verified
 * by inspection and by the operator notes in the route header.
 *
 * The load-bearing check is the last section: a student's email must never
 * carry another student's access code. A code is a credential for a minor,
 * and every member's individual score feeds the team total.
 */
import {
  escapeHtml,
  formatRoundDate,
  isValidYiqEmail,
  renderStudentCodeEmail,
  renderTeacherCodesEmail,
  YIQ_LOGIN_URL,
} from "../email/templates";
import { studentDedupeKey, teacherDedupeKey } from "../email/queue";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const MEMBERS = [
  { fullName: "Aarav Kumar", classLevel: 11, email: "aarav@example.com", accessCode: "Q7MK2W" },
  { fullName: "Diya Raman", classLevel: 12, email: null, accessCode: "TZ4HRD" },
  { fullName: "Karthik S", classLevel: 11, email: "karthik@example.com", accessCode: "MN6PYQ" },
];

const TEACHER_FULL = {
  teacherName: "Mrs. Lakshmi Narayanan",
  teamName: "Quiz Kings",
  teamCode: "YIQ-K7M2-QR",
  schoolName: "St. Mary's Boys & Girls Hr. Sec. School",
  chapterName: "Erode",
  category: "senior" as const,
  roundOpensAt: "2026-09-12T04:30:00.000Z",
  members: MEMBERS,
};

const STUDENT_FULL = {
  studentName: "Aarav Kumar",
  accessCode: "Q7MK2W",
  classLevel: 11,
  teamName: "Quiz Kings",
  teamCode: "YIQ-K7M2-QR",
  schoolName: "St. Mary's Boys & Girls Hr. Sec. School",
  chapterName: "Erode",
  category: "senior" as const,
  roundOpensAt: "2026-09-12T04:30:00.000Z",
};

console.log("\n── isValidYiqEmail ──");
check("plain address accepted", isValidYiqEmail("aarav@example.com"));
check("surrounding spaces tolerated", isValidYiqEmail("  aarav@example.com  "));
check("null is not an address", !isValidYiqEmail(null));
check("undefined is not an address", !isValidYiqEmail(undefined));
check("empty string is not an address", !isValidYiqEmail(""));
check("blank string is not an address", !isValidYiqEmail("   "));
check("missing @ rejected", !isValidYiqEmail("aaravexample.com"));
check("missing TLD rejected", !isValidYiqEmail("aarav@example"));
check("one-char TLD rejected", !isValidYiqEmail("aarav@example.c"));
check("internal space rejected", !isValidYiqEmail("aa rav@example.com"));
check(
  "absurdly long address rejected",
  !isValidYiqEmail(`${"a".repeat(250)}@example.com`)
);

console.log("\n── escapeHtml ──");
eq("ampersand escaped", escapeHtml("Boys & Girls"), "Boys &amp; Girls");
eq("angle brackets escaped", escapeHtml("<script>"), "&lt;script&gt;");
eq("double quote escaped", escapeHtml('say "hi"'), "say &quot;hi&quot;");
eq("apostrophe escaped", escapeHtml("St. Mary's"), "St. Mary&#39;s");
eq("plain text untouched", escapeHtml("Erode"), "Erode");

console.log("\n── formatRoundDate ──");
eq("ISO renders as an IST date", formatRoundDate("2026-09-12T04:30:00.000Z"), "12 September 2026");
check(
  "late-UTC timestamp rolls to the next IST day",
  formatRoundDate("2026-09-12T20:00:00.000Z") === "13 September 2026",
  `got ${formatRoundDate("2026-09-12T20:00:00.000Z")}`
);
eq("null -> null", formatRoundDate(null), null);
eq("undefined -> null", formatRoundDate(undefined), null);
eq("garbage -> null, never 'Invalid Date'", formatRoundDate("not a date"), null);

console.log("\n── teacher template: full input ──");
const teacher = renderTeacherCodesEmail(TEACHER_FULL);
check("subject names the team", teacher.subject.includes("Quiz Kings"));
check("subject names the school", teacher.subject.includes("St. Mary's Boys & Girls"));
check("text body is non-empty", teacher.text.trim().length > 200);
check("html body is non-empty", teacher.html.trim().length > 400);
check("html is a full document", teacher.html.startsWith("<!DOCTYPE html>"));
check("team code present in text", teacher.text.includes("YIQ-K7M2-QR"));
check("team code present in html", teacher.html.includes("YIQ-K7M2-QR"));
check("chapter name present in text", teacher.text.includes("Erode"));
check("chapter name present in html", teacher.html.includes("Erode"));
check("round date stated in text", teacher.text.includes("12 September 2026"));
check("round date stated in html", teacher.html.includes("12 September 2026"));
check("login URL present in text", teacher.text.includes(YIQ_LOGIN_URL));
check("login URL present in html", teacher.html.includes(YIQ_LOGIN_URL));
check(
  "every member's code is listed in text",
  MEMBERS.every((m) => teacher.text.includes(m.accessCode))
);
check(
  "every member's code is listed in html",
  MEMBERS.every((m) => teacher.html.includes(m.accessCode))
);
check(
  "every member is named in text",
  MEMBERS.every((m) => teacher.text.includes(m.fullName))
);
check("class levels shown", teacher.text.includes("Class 11") && teacher.text.includes("Class 12"));
check(
  "teacher told to hand each student only their own code",
  teacher.text.toLowerCase().includes("only their own code")
);
check(
  "teacher told the codes are not shown again",
  teacher.text.toLowerCase().includes("not shown on screen again")
);
check("member with an email flagged as already emailed", teacher.text.includes("[emailed to them]"));
check(
  "member without an email is NOT flagged",
  teacher.text.split("\n").some((l) => l.includes("Diya Raman") && !l.includes("[emailed to them]"))
);

console.log("\n── teacher template: optional fields absent ──");
const teacherBare = renderTeacherCodesEmail({
  ...TEACHER_FULL,
  roundOpensAt: null,
  members: [{ fullName: "Solo Student", classLevel: 9, accessCode: "AA22BB" }],
});
check("no date -> no 'Invalid Date' anywhere", !teacherBare.text.includes("Invalid"));
check("no date -> html clean too", !teacherBare.html.includes("Invalid"));
check(
  "no date -> falls back to a plain sentence",
  teacherBare.text.includes("will confirm the date")
);
check("member with no email field does not crash", teacherBare.text.includes("AA22BB"));
check("member with no email is not flagged as emailed", !teacherBare.text.includes("[emailed to them]"));
check("bare text body still non-empty", teacherBare.text.trim().length > 150);
check("bare html body still non-empty", teacherBare.html.trim().length > 400);

const teacherEmpty = renderTeacherCodesEmail({ ...TEACHER_FULL, members: [] });
check("zero members does not crash", teacherEmpty.text.length > 100);
check(
  "zero members says so rather than printing a blank list",
  teacherEmpty.text.includes("no members recorded") &&
    teacherEmpty.html.includes("No members recorded")
);

console.log("\n── student template: full input ──");
const student = renderStudentCodeEmail(STUDENT_FULL);
check("subject names the team", student.subject.includes("Quiz Kings"));
check("text body is non-empty", student.text.trim().length > 150);
check("html body is non-empty", student.html.trim().length > 400);
check("html is a full document", student.html.startsWith("<!DOCTYPE html>"));
check("own code present in text", student.text.includes("Q7MK2W"));
check("own code present in html", student.html.includes("Q7MK2W"));
check("student is greeted by name", student.text.includes("Aarav Kumar"));
check("team code included", student.text.includes("YIQ-K7M2-QR"));
check("chapter name included", student.text.includes("Erode"));
check("round date stated", student.text.includes("12 September 2026"));
check("login URL present in text", student.text.includes(YIQ_LOGIN_URL));
check("login URL present in html", student.html.includes(YIQ_LOGIN_URL));
check(
  "text says plainly not to share the code",
  student.text.toLowerCase().includes("do not share your code")
);
check(
  "html says plainly not to share the code",
  student.html.toLowerCase().includes("do not share your code")
);
check(
  "explains the code is personal",
  student.text.toLowerCase().includes("yours alone")
);

console.log("\n── student template: optional fields absent ──");
const studentBare = renderStudentCodeEmail({ ...STUDENT_FULL, roundOpensAt: null });
check("no date -> no 'Invalid Date'", !studentBare.text.includes("Invalid"));
check("no date -> html clean too", !studentBare.html.includes("Invalid"));
check("no date -> plain fallback sentence", studentBare.text.includes("will confirm the date"));
check("bare text body still non-empty", studentBare.text.trim().length > 150);
check("bare html body still non-empty", studentBare.html.trim().length > 400);
check("code still present without a date", studentBare.text.includes("Q7MK2W"));

const studentJunior = renderStudentCodeEmail({
  ...STUDENT_FULL,
  classLevel: 9,
  category: "junior",
});
check("junior category worded for a 14-year-old", studentJunior.text.includes("Classes 9 and 10"));
check("senior category worded", student.text.includes("Classes 11 and 12"));

console.log("\n── HTML escaping of real-world names ──");
const nasty = renderStudentCodeEmail({
  ...STUDENT_FULL,
  studentName: 'A "quoted" <b>name</b> & co',
  schoolName: "St. Mary's Boys & Girls <Hr. Sec.> School",
  teamName: 'Team "Alpha" & <Beta>',
  chapterName: "Erode & District",
});
check("no raw < survives into the html", !nasty.html.includes("<b>name</b>"));
check("literal <script> cannot be injected", !nasty.html.includes("<script>"));
check("ampersand escaped in html", nasty.html.includes("&amp;"));
check("apostrophe escaped in html", nasty.html.includes("&#39;"));
check("double quote escaped in html", nasty.html.includes("&quot;"));
check("plain text keeps the name readable", nasty.text.includes('A "quoted" <b>name</b> & co'));
check("code still renders alongside nasty names", nasty.html.includes("Q7MK2W"));

const nastyTeacher = renderTeacherCodesEmail({
  ...TEACHER_FULL,
  schoolName: "R&D <Model> School",
  members: [{ fullName: 'Bobby <img src=x> "Tables" & Sons', classLevel: 10, accessCode: "ZZ11YY" }],
});
check("teacher html escapes a member name", !nastyTeacher.html.includes("<img src=x>"));
check("teacher html escapes the school", !nastyTeacher.html.includes("<Model>"));
check("teacher html keeps the code", nastyTeacher.html.includes("ZZ11YY"));
check("teacher text stays readable", nastyTeacher.text.includes("R&D <Model> School"));

console.log("\n── a student email NEVER carries another student's code ──");
// Aarav's own email, rendered from the same team as Diya and Karthik.
const others = MEMBERS.filter((m) => m.fullName !== "Aarav Kumar");
for (const other of others) {
  check(
    `text omits ${other.fullName}'s code (${other.accessCode})`,
    !student.text.includes(other.accessCode)
  );
  check(
    `html omits ${other.fullName}'s code (${other.accessCode})`,
    !student.html.includes(other.accessCode)
  );
  check(
    `${other.fullName} is not even named in Aarav's email`,
    !student.text.includes(other.fullName) && !student.html.includes(other.fullName)
  );
}
check(
  "the student input type carries exactly one code",
  Object.keys(STUDENT_FULL).filter((k) => k.toLowerCase().includes("code")).length === 2,
  "expected accessCode + teamCode only"
);
// Rendering each member's own email must produce that member's code and no other.
for (const m of MEMBERS) {
  const mine = renderStudentCodeEmail({ ...STUDENT_FULL, studentName: m.fullName, accessCode: m.accessCode, classLevel: m.classLevel });
  const leaked = MEMBERS.filter((o) => o.accessCode !== m.accessCode).filter(
    (o) => mine.text.includes(o.accessCode) || mine.html.includes(o.accessCode)
  );
  eq(`${m.fullName}: no teammate code leaked`, leaked.map((o) => o.accessCode), []);
}

console.log("\n── dedupe keys (idempotency) ──");
eq(
  "teacher key is stable for the same team",
  teacherDedupeKey("team-1"),
  teacherDedupeKey("team-1")
);
check(
  "teacher keys differ across teams",
  teacherDedupeKey("team-1") !== teacherDedupeKey("team-2")
);
eq(
  "student key is stable for the same student",
  studentDedupeKey("stu-1"),
  studentDedupeKey("stu-1")
);
check(
  "student keys differ across students",
  studentDedupeKey("stu-1") !== studentDedupeKey("stu-2")
);
check(
  "a teacher key can never collide with a student key",
  teacherDedupeKey("same-id") !== studentDedupeKey("same-id")
);
check(
  "a resend tag produces a NEW key, so a deliberate resend is allowed",
  studentDedupeKey("stu-1", "reissue-2026-09-01") !== studentDedupeKey("stu-1")
);
check(
  "the same resend tag is still idempotent",
  studentDedupeKey("stu-1", "reissue-2026-09-01") ===
    studentDedupeKey("stu-1", "reissue-2026-09-01")
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
