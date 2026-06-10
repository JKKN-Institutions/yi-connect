/**
 * Student portal layout (Phase 10) — the /youth-academy/me/* gate.
 *
 * Middleware only checks cookie PRESENCE + shape; THIS layout re-verifies
 * the HMAC signature server-side via getStudentSession() and denies to the
 * login page WITH a message (spec Phase 10 task 4 — the sanctioned deny
 * shape for an unauthenticated session; in-portal authz failures render
 * Forbidden403 instead). Every server action gates itself again — the
 * layout is UX, the actions are the security boundary.
 *
 * Nav note: My Work (Phase 13) and Messages (Phase 12) are "coming soon"
 * stubs — labels only, no routes yet.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, ClipboardList, GraduationCap, Home, MessagesSquare } from "lucide-react";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { SignOutButton } from "@/components/yuva/student/sign-out-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "My portal" };

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStudentSession();
  if (!session) {
    // Forged / expired / missing-signature cookie → login with a message.
    redirect("/youth-academy/login?reason=session");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0f2557] text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            href="/youth-academy/me"
            className="inline-flex items-center gap-2 font-semibold"
          >
            <GraduationCap className="size-5" />
            Yi Youth Academy
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-200">
              Student
            </span>
          </Link>
          <SignOutButton />
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-6 pb-3 text-sm">
          <Link
            href="/youth-academy/me"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Home className="size-3.5" />
            My programs
          </Link>
          <Link
            href="/youth-academy/me/certificate"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Award className="size-3.5" />
            Certificate
          </Link>
          {/* Phase 13 — nav stub only */}
          <span
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-slate-400"
            title="Coming soon"
          >
            <ClipboardList className="size-3.5" />
            My work
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
              soon
            </span>
          </span>
          {/* Phase 12 — nav stub only */}
          <span
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-slate-400"
            title="Coming soon"
          >
            <MessagesSquare className="size-3.5" />
            Messages
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
              soon
            </span>
          </span>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
