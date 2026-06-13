import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Explicit 403 for Yi Future admin areas. The authorization gates in
 * lib/yi-future/auth/require-access.ts redirect here when a logged-in user
 * lacks the required role — surfacing the real reason instead of a silent
 * bounce to a landing page (which creates undiagnosable redirect loops).
 */
export default function YiFutureForbiddenPage() {
  return (
    <main className="min-h-screen bg-ivory flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-navy/10 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          403 · Access denied
        </p>
        <h1 className="mt-3 text-xl font-semibold text-navy">
          You don&apos;t have access to this area
        </h1>
        <p className="mt-3 text-sm text-navy/60">
          This is a Yi Future admin area. Only chapter chairs and national
          admins can open it. If you believe you should have access, contact
          your chapter chair or the Yi Future national team.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/yi-future"
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90"
          >
            Back to Yi Future
          </Link>
          <Link
            href="/yi-future/access"
            className="text-xs font-medium text-navy/60 hover:text-navy"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    </main>
  );
}
