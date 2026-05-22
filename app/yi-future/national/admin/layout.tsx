import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/national/admin" },
  { label: "Editions", href: "/national/admin/editions" },
  { label: "Tracks", href: "/national/admin/tracks" },
  { label: "Problems", href: "/national/admin/problems" },
  { label: "Host Assignments", href: "/national/admin/host-assignments" },
  { label: "Chapter Assignments", href: "/national/admin/chapter-assignments" },
  { label: "Rubrics", href: "/national/admin/rubrics" },
  { label: "Chapters", href: "/national/admin/chapters" },
  { label: "Chairs", href: "/national/admin/chairs" },
  { label: "Teams", href: "/national/admin/teams" },
  { label: "Metrics", href: "/national/admin/metrics" },
  { label: "Whitepapers", href: "/national/admin/whitepapers" },
  { label: "Government", href: "/national/admin/government" },
  { label: "Media", href: "/national/admin/media" },
  { label: "Compendium", href: "/national/admin/compendium" },
  { label: "Downloads", href: "/national/admin/downloads" },
  { label: "Broadcast", href: "/national/admin/broadcast" },
  { label: "Admins", href: "/national/admin/admins" },
  { label: "My Bug Reports", href: "/my-bug-reports" },
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
