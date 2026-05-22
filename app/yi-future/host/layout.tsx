import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Overview", href: "/host" },
  { label: "Track", href: "/host/track" },
  { label: "Finalists", href: "/host/finalists" },
  { label: "Agenda · Day 1", href: "/host/agenda/day1" },
  { label: "Agenda · Day 2", href: "/host/agenda/day2" },
  { label: "Speakers", href: "/host/speakers" },
  { label: "Partners", href: "/host/partners" },
  { label: "Resumes", href: "/host/resumes" },
  { label: "Interviews", href: "/host/interviews" },
  { label: "Government", href: "/host/government" },
  { label: "Jury", href: "/host/jury" },
  { label: "Internships", href: "/host/internships" },
  { label: "Whitepaper", href: "/host/whitepaper" },
  { label: "Media", href: "/host/media" },
  { label: "Awards", href: "/host/awards" },
  { label: "Deliverables", href: "/host/deliverables" },
  { label: "Metrics", href: "/host/metrics" },
  { label: "My Bug Reports", href: "/my-bug-reports" },
];

export default async function HostLayout({
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
    <AdminShell title="Host Chapter" roleLabel="Host" items={NAV}>
      {children}
    </AdminShell>
  );
}
