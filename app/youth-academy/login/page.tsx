/**
 * Yi Youth Academy — login (Phase 10).
 *
 * Two paths:
 *   1. Students: access code OR email OTP (client form → PUBLIC
 *      student-auth actions → signed yuva_session cookie).
 *   2. Staff (national / chapter / institution / mentor): the shared
 *      Google OAuth flow (lib/auth/google-oauth-button.tsx) routed through
 *      /auth/callback back to /youth-academy — the persona layouts gate
 *      from there.
 *
 * A visitor who already holds a VALID student session goes straight to the
 * portal (signature verified server-side, not just cookie presence).
 */

import Image from "next/image";
import { redirect } from "next/navigation";
import { GoogleOAuthButton } from "@/lib/auth/google-oauth-button";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { StudentLoginForm } from "@/components/yuva/student/login-form";
import { StaffLoginForm } from "@/components/yuva/staff-login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default async function YouthAcademyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; redirectTo?: string; error?: string }>;
}) {
  const { reason, redirectTo, error } = await searchParams;

  // Already signed in as a student → portal (convenience, not a gate).
  const session = await getStudentSession();
  if (session) redirect("/youth-academy/me");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <Image
            src="/youth-academy/academy-logo.jpg"
            alt="Yi Youth Academy"
            width={1200}
            height={593}
            priority
            className="mx-auto h-16 w-auto"
          />
          <h1 className="sr-only">Yi Youth Academy</h1>
          <p className="mt-3 text-sm text-slate-500">Sign in to continue</p>
        </div>

        {reason === "session" && (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            Your session has expired or is invalid. Please sign in again to
            open your student portal.
          </p>
        )}

        {/* ── Students ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">Students</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Use the access code from your acceptance email, or get a one-time
            code by email.
          </p>
          <StudentLoginForm />
        </section>

        {/* ── Staff ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800">
            National · Chapter · Institution · Mentor
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Sign in with your email and password, or with your Yi Google
            account.
          </p>
          <StaffLoginForm redirectTo={redirectTo} error={error} />
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">
              or
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleOAuthButton
            redirectTo={redirectTo ?? "/youth-academy"}
            className="w-full"
            label="Continue with Google"
          />
        </section>

        <p className="text-center text-xs text-slate-400">
          Applied recently? Track your application from the link in your
          confirmation email — no sign-in needed.
        </p>
      </div>
    </main>
  );
}
