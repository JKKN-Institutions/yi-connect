import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";

type Partner = {
  id: string;
  event_id: string;
};

type DelegateLite = {
  id: string;
  full_name: string;
  email: string | null;
  course: string | null;
  year_of_study: number | null;
  home_state: string | null;
  resume_url: string | null;
  colleges: { name: string } | null;
  chapters: { name: string } | null;
};

async function getPartner(id: string): Promise<Partner | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Partner) ?? null;
}

async function getFinalistDelegates(
  hostEventId: string
): Promise<DelegateLite[]> {
  const svc = await createServiceClient();
  const { data: advs } = await svc
    .schema("future")
    .from("advancements")
    .select("team_id")
    .eq("to_event_id", hostEventId);
  const teamIds = ((advs as unknown as { team_id: string }[]) ?? []).map(
    (a) => a.team_id
  );
  if (teamIds.length === 0) return [];

  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .in("team_id", teamIds);
  const delegateIds = ((members as unknown as { delegate_id: string }[]) ?? [])
    .map((m) => m.delegate_id);
  if (delegateIds.length === 0) return [];

  const { data: delegates } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, email, course, year_of_study, home_state, resume_url, colleges(name), chapters(name)"
    )
    .in("id", delegateIds)
    .order("full_name", { ascending: true });
  return (delegates as unknown as DelegateLite[]) ?? [];
}

export default async function PartnerResumesPage() {
  const session = await readSession();
  if (!session || session.type !== "partner") redirect("/yi-future/join");

  const p = await getPartner(session.id);
  if (!p) redirect("/yi-future/join");

  const delegates = await getFinalistDelegates(p.event_id);
  const withResume = delegates.filter((d) => d.resume_url).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/partner"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Finalist resumes
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {delegates.length} delegates · {withResume} with resume uploaded
        </p>
      </div>

      {delegates.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          No finalists yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {delegates.map((d) => (
            <li
              key={d.id}
              className="bg-white border border-navy/10 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">{d.full_name}</div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {d.chapters?.name}
                    {d.chapters?.name && d.colleges?.name && " · "}
                    {d.colleges?.name}
                  </div>
                  <div className="text-xs text-navy/50 mt-1">
                    {d.course}
                    {d.course && d.year_of_study && " · "}
                    {d.year_of_study && `Year ${d.year_of_study}`}
                    {d.home_state && ` · ${d.home_state}`}
                  </div>
                  {d.email && (
                    <div className="text-xs text-navy/50 mt-0.5">
                      {d.email}
                    </div>
                  )}
                </div>
                {d.resume_url ? (
                  <a
                    href={d.resume_url}
                    target="_blank"
                    rel="noopener"
                    className="flex-shrink-0 px-3 py-1.5 rounded bg-yi-gold/10 text-yi-gold text-xs font-semibold hover:bg-yi-gold/20"
                  >
                    Open resume →
                  </a>
                ) : (
                  <span className="flex-shrink-0 text-xs text-navy/30">
                    no resume
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
