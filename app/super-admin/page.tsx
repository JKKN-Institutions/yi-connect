import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { signOut } from "@/app/actions/auth";

export const metadata = {
  title: "Super Admin · Yi Connect",
};

type ModuleCard = {
  title: string;
  desc: string;
  href: string;
  icon: string;
  accent: string; // tailwind border/hover accent
};

const MODULES: ModuleCard[] = [
  {
    title: "Chapter Dashboard",
    desc: "Members, events, finance, and day-to-day chapter operations.",
    href: "/dashboard",
    icon: "🏛️",
    accent: "hover:border-[#000066]/40",
  },
  {
    title: "YiFi Event Admin",
    desc: "Registrants, routing matches, census, and vows for the Madurai 2026 summit.",
    href: "/yifi/admin",
    icon: "🎯",
    accent: "hover:border-[#FD7215]/50",
  },
  {
    title: "YiFuture Admin",
    desc: "Editions, regional finales, national finals, and delegates.",
    href: "/yi-future/national/admin",
    icon: "🚀",
    accent: "hover:border-[#229434]/50",
  },
  {
    title: "YIP Admin",
    desc: "Parliament events, participants, and jury scoring.",
    href: "/yip/dashboard",
    icon: "⚖️",
    accent: "hover:border-[#FD7215]/50",
  },
  {
    title: "Youth Academy",
    desc: "Academies, runs, students, and chapter delivery across Yi YUVA.",
    href: "/youth-academy/national",
    icon: "🎓",
    accent: "hover:border-[#229434]/50",
  },
  {
    title: "Directory",
    desc: "People, roles, and cross-app identity across every Yi module.",
    href: "/admin/directory",
    icon: "📇",
    accent: "hover:border-[#000066]/40",
  },
];

export default async function SuperAdminPage() {
  const me = await getCurrentPersonRoles();
  // Accept the platform tier (new `platform_super_admin` + legacy `super_admin`)
  // — must match isPlatformSuperAdmin(), which /hub uses to route here, or a
  // platform_super_admin-only user bounces /hub ↔ /super-admin forever.
  const isSuperAdmin = !!me?.assignments.some(
    (a) =>
      a.is_active &&
      (a.role === "super_admin" || a.role === "platform_super_admin")
  );
  if (!isSuperAdmin) redirect("/hub");

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[#000066]">Yi Connect</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-white bg-[#FD7215] px-2 py-0.5 rounded-full">
              Super Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            {me?.email && (
              <span className="text-sm text-gray-500">{me.email}</span>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm font-medium text-gray-500 hover:text-[#000066]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm mt-1">
            Every module you administer, in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`group bg-white border border-gray-200 rounded-xl p-5 transition-colors ${m.accent}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{m.icon}</span>
                <h2 className="font-semibold text-gray-900">{m.title}</h2>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{m.desc}</p>
              <span className="inline-block mt-3 text-sm font-medium text-[#FD7215] group-hover:underline">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
