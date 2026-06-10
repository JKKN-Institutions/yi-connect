import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/yuva/supabase/server";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";

/**
 * Yi Youth Academy — national console layout (Phase 4).
 * Gate: Supabase OAuth user + requireYuvaNational(). Denies render the
 * explicit Forbidden403 with the gate's reason — NEVER a silent redirect
 * (project rule; the bounce-loop trap). Middleware already bounces
 * unauthenticated visitors to /youth-academy/login; this layout is the
 * authorization boundary, and every sub-page re-gates (one stale gate
 * 403s every child — repo lesson).
 */

const NAV_LINKS = [
  { href: "/youth-academy/national", label: "Dashboard" },
  { href: "/youth-academy/national/programs", label: "Programs" },
  { href: "/youth-academy/national/academies", label: "Academies" },
];

export default async function NationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Forbidden403 reason="Sign in with your Yi account to access the national console." />
    );
  }

  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/youth-academy/national"
            className="flex items-center gap-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <GraduationCap className="size-4 text-amber-400" />
            </span>
            <span className="text-sm font-semibold text-slate-900">
              Yi Youth Academy
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                National
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
