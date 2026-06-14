/**
 * CHAPTER surface gate (spec "Chapter — dashboard" / Phase 5 task 2).
 *
 * Allowed: a yuva chapter_admin with a real chapter scope, an
 * institution_coordinator bound to ≥1 active academy, or the national tier.
 * Everyone else gets an EXPLICIT Forbidden403 carrying the resolver's
 * verdict — NEVER a silent redirect (project rule: silent redirects create
 * undiagnosable bounce-loops).
 */

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { StaffSignOut } from "@/app/youth-academy/_components/StaffSignOut";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";

export const metadata = { title: "Chapter" };

export default async function ChapterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getYuvaAccess();
  const allowed =
    access.isNational ||
    access.chapterAdminOf !== null ||
    access.coordinatorAcademyIds.length > 0;

  if (!allowed) {
    return <Forbidden403 reason={`This area is for Yi chapter admins, institution coordinators and the national team. Your access: ${access.reason}`} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/youth-academy/chapter" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <GraduationCap className="size-4 text-amber-400" />
            </span>
            <span className="text-sm font-semibold text-slate-900">
              Yi Youth Academy
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                Chapter
              </span>
            </span>
          </Link>
          <StaffSignOut />
        </div>
      </header>
      {children}
    </div>
  );
}
