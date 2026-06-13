import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Overview", href: "/yi-future/chapter" },
  { label: "Setup", href: "/yi-future/chapter/setup" },
  { label: "Outreach", href: "/yi-future/chapter/outreach" },
  { label: "Colleges", href: "/yi-future/chapter/colleges" },
  { label: "Delegates", href: "/yi-future/chapter/delegates" },
  { label: "Consent", href: "/yi-future/chapter/consent" },
  { label: "Teams", href: "/yi-future/chapter/teams" },
  { label: "Problem Statements", href: "/yi-future/chapter/problems" },
  { label: "Journey", href: "/yi-future/chapter/journey" },
  { label: "Messages", href: "/yi-future/chapter/messages" },
  { label: "Mentors", href: "/yi-future/chapter/mentors" },
  { label: "Experts", href: "/yi-future/chapter/experts" },
  { label: "Jury", href: "/yi-future/chapter/jury" },
  { label: "Scoring", href: "/yi-future/chapter/scoring" },
  { label: "Final Event", href: "/yi-future/chapter/final" },
  { label: "Submissions", href: "/yi-future/chapter/submissions" },
  { label: "Results", href: "/yi-future/chapter/results" },
];

export default async function ChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: block non-admins (delegates) from loading the admin
  // shell. Server actions are independently gated, but this stops the UI too.
  await requireFutureAdmin();

  return (
    <AdminShell title="Chapter Admin" roleLabel="Chapter" items={NAV}>
      {children}
    </AdminShell>
  );
}
