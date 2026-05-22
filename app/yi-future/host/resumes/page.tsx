import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";

type DelegateLite = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  course: string | null;
  year_of_study: number | null;
  home_state: string | null;
  resume_url: string | null;
  colleges: { name: string } | null;
  chapters: { name: string } | null;
};

/**
 * Resumes pool = finalist delegates (all delegates on advanced teams for
 * this host chapter's national final).
 */
async function getFinalistDelegates(
  hostEventId: string
): Promise<DelegateLite[]> {
  const svc = await createServiceClient();

  // Step 1: advancement rows → team_ids
  const { data: advs } = await svc
    .schema("future")
    .from("advancements")
    .select("team_id")
    .eq("to_event_id", hostEventId);
  const teamIds = ((advs as unknown as { team_id: string }[]) ?? []).map(
    (a) => a.team_id
  );
  if (teamIds.length === 0) return [];

  // Step 2: team_members → delegate_ids
  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .in("team_id", teamIds);
  const delegateIds = ((members as unknown as { delegate_id: string }[]) ?? [])
    .map((m) => m.delegate_id);
  if (delegateIds.length === 0) return [];

  // Step 3: fetch delegate rows
  const { data: delegates } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, email, phone, course, year_of_study, home_state, resume_url, colleges(name), chapters(name)"
    )
    .in("id", delegateIds)
    .order("full_name", { ascending: true });
  return (delegates as unknown as DelegateLite[]) ?? [];
}

export default async function ResumesPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const delegates = await getFinalistDelegates(ctx.nationalEvent.id);
  const withResume = delegates.filter((d) => d.resume_url).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Resume pool</h2>
        <p className="mt-1 text-sm text-navy/60">
          {delegates.length} finalist delegate(s) · {withResume} with resume
          uploaded
        </p>
      </div>

      {delegates.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No finalists yet.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Chapter</th>
                <th className="text-left px-4 py-3 font-semibold">College</th>
                <th className="text-left px-4 py-3 font-semibold">Course</th>
                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-right px-4 py-3 font-semibold">Resume</th>
              </tr>
            </thead>
            <tbody>
              {delegates.map((d) => (
                <tr key={d.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-semibold">{d.full_name}</td>
                  <td className="px-4 py-3 text-xs">
                    {d.chapters?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.colleges?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.course}
                    {d.course && d.year_of_study && " · "}
                    {d.year_of_study && `Y${d.year_of_study}`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{d.email ?? "—"}</div>
                    {d.phone && (
                      <div className="text-navy/50">{d.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.resume_url ? (
                      <a
                        href={d.resume_url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-yi-gold hover:underline"
                      >
                        Open →
                      </a>
                    ) : (
                      <span className="text-xs text-navy/40">none</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-navy/40">
        <Link
          href="/yi-future/host/interviews/new"
          className="underline hover:text-navy"
        >
          Schedule an interview →
        </Link>
      </p>
    </div>
  );
}
