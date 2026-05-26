import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/yi-future/national/admin" },
  { label: "Editions", href: "/yi-future/national/admin/editions" },
  { label: "Tracks", href: "/yi-future/national/admin/tracks" },
  { label: "Problems", href: "/yi-future/national/admin/problems" },
  { label: "Host Assignments", href: "/yi-future/national/admin/host-assignments" },
  { label: "Chapter Assignments", href: "/yi-future/national/admin/chapter-assignments" },
  { label: "Rubrics", href: "/yi-future/national/admin/rubrics" },
  { label: "Chapters", href: "/yi-future/national/admin/chapters" },
  { label: "Chairs", href: "/yi-future/national/admin/chairs" },
  { label: "Teams", href: "/yi-future/national/admin/teams" },
  { label: "Delegates", href: "/yi-future/national/admin/delegates" },
  { label: "Unteamed Delegates", href: "/yi-future/national/admin/delegates/unteamed" },
  { label: "Metrics", href: "/yi-future/national/admin/metrics" },
  { label: "Whitepapers", href: "/yi-future/national/admin/whitepapers" },
  { label: "Government", href: "/yi-future/national/admin/government" },
  { label: "Media", href: "/yi-future/national/admin/media" },
  { label: "Compendium", href: "/yi-future/national/admin/compendium" },
  { label: "Downloads", href: "/yi-future/national/admin/downloads" },
  { label: "Leaderboards", href: "/yi-future/national/admin/leaderboards" },
  { label: "Finals Live", href: "/yi-future/national/admin/finals/live" },
  { label: "Finals Schedule", href: "/yi-future/national/admin/finals/schedule" },
  { label: "Create Finals", href: "/yi-future/national/admin/finals/new" },
  { label: "Broadcast", href: "/yi-future/national/admin/broadcast" },
  { label: "Admins", href: "/yi-future/national/admin/admins" },
];

export default async function NationalAdminLayout({
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
    <AdminShell title="Yi National Admin" roleLabel="National" items={NAV}>
      {children}
    </AdminShell>
  );
}
