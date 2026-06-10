/**
 * Yi Youth Academy — login.
 * Phase 0 placeholder: two-path shell only (no logic). Student access-code /
 * email-OTP login lands in Phase 10; staff OAuth wiring lands with the
 * persona dashboards. See docs/yi-youth-academy-spec.md.
 */
export default function YouthAcademyLoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Yi Youth Academy — Sign in
        </h1>
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
          <h2 className="font-semibold text-slate-800">Students</h2>
          <p className="text-sm text-slate-500">
            Use the access code emailed to you when your cohort was formed, or
            request a one-time code by email. (Available soon.)
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
          <h2 className="font-semibold text-slate-800">
            National · Chapter · Institution · Mentor
          </h2>
          <p className="text-sm text-slate-500">
            Sign in with your Yi account (Google). (Available soon.)
          </p>
        </section>
      </div>
    </main>
  );
}
