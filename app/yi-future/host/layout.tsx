import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Overview", href: "/yi-future/host" },
  { label: "Chapter Prelim", href: "#", isHeader: true },
  { label: "Prelim Teams", href: "/yi-future/host/prelim/teams" },
  { label: "Prelim Scoring", href: "/yi-future/host/prelim/scoring" },
  { label: "Regional Finale", href: "#", isHeader: true },
  { label: "Create Finale", href: "/yi-future/host/finale/new" },
  { label: "Finale Live", href: "/yi-future/host/finale/live" },
  { label: "Finale Schedule", href: "/yi-future/host/finale/schedule" },
  { label: "Track", href: "/yi-future/host/track" },
  { label: "Finalists", href: "/yi-future/host/finalists" },
  { label: "Agenda · Day 1", href: "/yi-future/host/agenda/day1" },
  { label: "Agenda · Day 2", href: "/yi-future/host/agenda/day2" },
  { label: "Speakers", href: "/yi-future/host/speakers" },
  { label: "Partners", href: "/yi-future/host/partners" },
  { label: "Resumes", href: "/yi-future/host/resumes" },
  { label: "Interviews", href: "/yi-future/host/interviews" },
  { label: "Government", href: "/yi-future/host/government" },
  { label: "Jury", href: "/yi-future/host/jury" },
  { label: "Internships", href: "/yi-future/host/internships" },
  { label: "Whitepaper", href: "/yi-future/host/whitepaper" },
  { label: "Media", href: "/yi-future/host/media" },
  { label: "Awards", href: "/yi-future/host/awards" },
  { label: "Deliverables", href: "/yi-future/host/deliverables" },
  { label: "Metrics", href: "/yi-future/host/metrics" },
];

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: block non-admins from loading the host admin shell.
  await requireFutureAdmin();

  return (
    <AdminShell title="Host Chapter" roleLabel="Host" items={NAV}>
      {children}
    </AdminShell>
  );
}
