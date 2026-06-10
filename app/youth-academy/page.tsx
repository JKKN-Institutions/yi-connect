/**
 * Yi Youth Academy — public landing page.
 * Phase 0 placeholder: replaced by the published-runs grid + "Our Network"
 * academy showcase + Mentor YUVA Network link in Phase 8 (see docs/yi-youth-academy-spec.md).
 */
export default function YouthAcademyLandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-4">
        <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">
          Yi YUVA · Young Indians · CII
        </p>
        <h1 className="text-4xl font-bold text-slate-900">Yi Youth Academy</h1>
        <p className="text-slate-600">
          A thought, leadership and action space — cohort-based certificate
          programs in Entrepreneurship, Innovation &amp; Learning for students
          in the Yi YUVA network.
        </p>
        <p className="text-sm text-slate-400">Programs coming soon.</p>
      </div>
    </main>
  );
}
