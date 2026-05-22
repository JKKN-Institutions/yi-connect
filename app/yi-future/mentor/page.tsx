import { readSession } from "@/app/yi-future/actions/auth";

export default async function MentorHome() {
  const session = await readSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">Mentor Dashboard</h1>
        <p className="mt-1 text-sm text-navy/60">
          {session?.name ?? "Mentor"} · Future 6.0 (2026)
        </p>
      </div>

      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">🧭</div>
        <h2 className="text-lg font-bold text-navy">
          Your teams and feedback tasks will appear here.
        </h2>
        <p className="mt-2 text-sm text-navy/60">
          Phase 7 will wire mentor-to-team matching, feedback loops, and
          phase event scheduling.
        </p>
      </div>
    </div>
  );
}
