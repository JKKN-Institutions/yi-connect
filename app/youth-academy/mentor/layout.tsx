/**
 * Mentor area layout + OAuth gate (Phase 6).
 * Spec: docs/yi-youth-academy-spec.md → "Mentor — dashboard / sessions / cohort".
 *
 * Gate: getYuvaAccess() must show isMentor OR national OR chapter admin
 * (staff may inspect the mentor area). Anyone else gets an explicit
 * Forbidden403 with the capability reason — NEVER a redirect (project rule:
 * silent redirects create undiagnosable bounce-loops).
 */

import Link from "next/link";
import { BookOpen, GraduationCap } from "lucide-react";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";

export const metadata = {
  title: "Mentor",
};

export default async function MentorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getYuvaAccess();

  const allowed = access.isMentor || access.isNational || !!access.chapterAdminOf;
  if (!allowed) {
    return (
      <Forbidden403
        reason={`The mentor area is for invited mentors of the Mentor YUVA Network. ${access.reason}.`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/youth-academy/mentor"
            className="flex items-center gap-2 font-semibold text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <GraduationCap className="size-4" />
            </span>
            Yi Youth Academy
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Mentor
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link
              href="/youth-academy/mentor"
              className="hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/youth-academy/mentor/profile"
              className="hover:text-slate-900"
            >
              My profile
            </Link>
            <Link
              href="/youth-academy/mentors"
              className="hover:text-slate-900"
            >
              Public network
            </Link>
            <Link
              href="/youth-academy/guide"
              className="inline-flex items-center gap-1.5 hover:text-slate-900"
            >
              <BookOpen className="size-3.5" />
              Guide
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
