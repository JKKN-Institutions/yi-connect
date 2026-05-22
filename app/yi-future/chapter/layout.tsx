import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Overview", href: "/chapter" },
  { label: "Setup", href: "/chapter/setup" },
  { label: "Outreach", href: "/chapter/outreach" },
  { label: "Colleges", href: "/chapter/colleges" },
  { label: "Delegates", href: "/chapter/delegates" },
  { label: "Teams", href: "/chapter/teams" },
  { label: "Journey", href: "/chapter/journey" },
  { label: "Mentors", href: "/chapter/mentors" },
  { label: "Experts", href: "/chapter/experts" },
  { label: "Jury", href: "/chapter/jury" },
  { label: "Scoring", href: "/chapter/scoring" },
  { label: "Final Event", href: "/chapter/final" },
  { label: "Submissions", href: "/chapter/submissions" },
  { label: "Results", href: "/chapter/results" },
  { label: "Consent", href: "/chapter/consent" },
  { label: "My Bug Reports", href: "/my-bug-reports" },
];

export default async function ChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  return (
    <AdminShell title="Chapter Admin" roleLabel="Chapter" items={NAV}>
      {children}
    </AdminShell>
  );
}
