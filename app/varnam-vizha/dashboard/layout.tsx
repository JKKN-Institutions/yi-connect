import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";

/**
 * Dashboard area layout — gates the whole committee dashboard and renders a
 * thin horizontal nav-tabs strip above the page content. The overview page
 * (dashboard/page.tsx) renders its own header, so this layout deliberately
 * adds no big header — just the tab bar.
 */
const TABS = [
  { href: "/varnam-vizha/dashboard", label: "Overview" },
  { href: "/varnam-vizha/dashboard/events", label: "Events" },
  { href: "/varnam-vizha/dashboard/tasks", label: "Tasks" },
  { href: "/varnam-vizha/dashboard/registrations", label: "Registrations" },
  { href: "/varnam-vizha/dashboard/paperwork", label: "Paperwork" },
  { href: "/varnam-vizha/dashboard/sponsors", label: "Sponsors" },
  { href: "/varnam-vizha/dashboard/budget", label: "Budget" },
  { href: "/varnam-vizha/dashboard/reports", label: "Reports" },
  { href: "/varnam-vizha/dashboard/assets", label: "Assets" },
  { href: "/varnam-vizha/dashboard/digest", label: "Digest" },
  { href: "/varnam-vizha/dashboard/team", label: "Team" },
  { href: "/varnam-vizha/playbook", label: "Playbook" },
];

export default async function VarnamDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  return (
    <>
      <nav
        aria-label="Committee dashboard"
        className="mx-auto max-w-5xl px-4 pt-6"
      >
        <ul className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="inline-flex items-center rounded-full border border-[#3B0A45]/12 bg-white px-4 py-1.5 text-sm font-medium text-[#2B0A33]/80 transition hover:border-[#D6336C]/40 hover:bg-[#D6336C]/5 hover:text-[#b02a59]"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
