import Link from "next/link";
import { redirect } from "next/navigation";
import { getYiqSession } from "@/lib/yiq/auth/yiq-session";
import { safeYiqRedirect, YIQ_DEFAULT_LANDING } from "@/lib/yiq/safe-redirect";
import { signOut } from "../actions/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/**
 * The student access-code sign-in.
 *
 * WHY `redirectTo` IS HONOURED HERE. This page used to redirect ANY existing
 * student session straight to /yiq/me, ignoring where the person was actually
 * trying to go. An organiser who holds a student session — which is normal,
 * they register test teams — would click an admin link, land on a student
 * page with no explanation, click again, and land there again. An
 * undiagnosable bounce loop, and exactly the silent-redirect pattern the
 * repo's rules forbid.
 *
 * The target is validated by safeYiqRedirect() BEFORE it is used: it must be
 * a same-site path inside /yiq. An unvalidated `redirectTo` would turn this
 * page into a phishing hop wearing our own branding. See lib/yiq/safe-redirect.ts.
 *
 * Where the target is a page this student cannot open, they are still sent
 * there — that page's own gate renders an explicit refusal, which tells them
 * something. Bouncing them somewhere else tells them nothing.
 */
export default async function YiqLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const target = safeYiqRedirect(params?.redirectTo);
  const askedForSomewhere = target !== YIQ_DEFAULT_LANDING;

  const session = await getYiqSession();
  if (session?.type === "student") redirect(target);

  return (
    <main
      id="yiq-main"
      className="flex min-h-screen flex-col"
      style={{ background: "#0a1633", color: "#f7f4ed" }}
    >
      <header className="mx-auto w-full max-w-md px-5 py-5">
        <Link href="/yiq" className="yiq-display text-[1.375rem]">
          YIQ
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <h1 className="yiq-display text-[2.5rem]">Sign in</h1>
        <p className="mt-3 text-[0.9375rem]" style={{ color: "#9fb0d4" }}>
          Enter the access code from your registration slip. Each student has
          their own code — don&apos;t use a teammate&apos;s.
        </p>

        {askedForSomewhere ? (
          <p className="mt-3 text-[0.875rem]" style={{ color: "#9fb0d4" }}>
            You&apos;ll be taken back to the page you were trying to open.
          </p>
        ) : null}

        <LoginForm redirectTo={target} />

        <p className="mt-8 text-[0.875rem]" style={{ color: "#9fb0d4" }}>
          No code yet?{" "}
          <Link href="/yiq/register" className="underline" style={{ color: "#e8a33d" }}>
            Register your school team
          </Link>
        </p>

        {/*
          The way out of a wrong session. Teachers and organisers sign in to
          the admin side with a Yi account, not an access code — if they are
          holding a student session from a test team, nothing on this page
          works for them until they drop it.
        */}
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="text-[0.8125rem] underline"
            style={{ color: "#9fb0d4" }}
          >
            Signed in as someone else? Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
