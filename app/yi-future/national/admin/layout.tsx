import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";

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
  { label: "WhatsApp Outreach", href: "/yi-future/national/admin/whatsapp-outreach" },
  { label: "Admins", href: "/yi-future/national/admin/admins" },
  { label: "My Bug Reports", href: "/yi-future/my-bug-reports" },
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

  // SECURITY: only platform-admin / super-admin / national_admin (per yi_directory
  // via BB refactor) may view national admin surfaces. CFT 2026-05-28 found
  // demo-organizer could see 22 delegates + 65 chapters without this gate.
  const { isPlatform } = await isCurrentUserPlatformAdmin();
  if (!isPlatform) redirect("/yi-future/chapter");

  return (
    <AdminShell title="Yi National Admin" roleLabel="National" items={NAV}>
      {children}
    </AdminShell>
  );
}
