import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { getVapidPublicKey } from "@/lib/yi-future/vapid";
import PushSubscribeButton from "@/components/yi-future/push/PushSubscribeButton";

type DelegateView = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  chapter_id: string;
  chapters: { name: string; city: string } | null;
  team_members: {
    team_id: string;
    role_in_team: string | null;
    teams: {
      id: string;
      team_name: string;
      status: string | null;
      captain_id: string | null;
      problem_statement_id: string | null;
      problem_statements: { title: string } | null;
      team_members: {
        delegate_id: string;
        role_in_team: string | null;
        delegates: { full_name: string };
      }[];
    } | null;
  }[];
};

async function getDelegateView(id: string): Promise<DelegateView | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, email, phone, access_code, chapter_id, chapters(name, city), team_members(team_id, role_in_team, teams(id, team_name, status, captain_id, problem_statement_id, problem_statements(title), team_members(delegate_id, role_in_team, delegates(full_name))))"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as DelegateView) ?? null;
}

export default async function DelegateHome() {
  const session = await readSession();
  if (session?.type === "jury") redirect("/yi-future/jury");
  if (session?.type === "mentor") redirect("/yi-future/mentor");
  if (session?.type === "partner") redirect("/yi-future/partner");
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const me = await getDelegateView(session.id);

  // Check participation history (previous editions — match by email OR phone)
  let pastEditions: { year: string; chapter: string; team: string | null; award: string | null }[] = [];
  if (me?.email) {
    const svc2 = await createServiceClient();
    const { data: prev } = await svc2
      .schema("future")
      .from("delegates")
      .select("id, editions(slug), chapters(name), team_members(teams(team_name, awards(category)))")
      .or(`email.eq.${me.email}${me.phone ? `,phone.eq.${me.phone}` : ""}`)
      .neq("id", session.id)
      .eq("is_active", true);
    if (prev) {
      pastEditions = (prev as unknown as {
        editions: { slug: string } | null;
        chapters: { name: string } | null;
        team_members: { teams: { team_name: string; awards: { category: string }[] | null } | null }[];
      }[]).map((p) => ({
        year: p.editions?.slug ?? "—",
        chapter: p.chapters?.name ?? "—",
        team: p.team_members?.[0]?.teams?.team_name ?? null,
        award: p.team_members?.[0]?.teams?.awards?.[0]?.category ?? null,
      }));
    }
  }

  if (!me) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <p className="text-navy/60 text-sm">Delegate record not found.</p>
      </div>
    );
  }

  const tm = me.team_members[0];
  const team = tm?.teams ?? null;
  const isCaptain = team?.captain_id === me.id;
  const statusLabel = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Hi {me.full_name}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {me.chapters?.name ?? "—"}
          {me.chapters?.city && <span> · {me.chapters.city}</span>}
        </p>
        <div className="mt-3">
          <PushSubscribeButton vapidPublicKey={getVapidPublicKey()} />
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Journey", href: "/yi-future/me/journey" },
          { label: "Submissions", href: "/yi-future/me/submissions" },
          { label: "Feedback", href: "/yi-future/me/feedback" },
          { label: "Resume", href: "/yi-future/me/resume" },
          { label: "Interviews", href: "/yi-future/me/interviews" },
          { label: "Results", href: "/yi-future/me/results" },
        ].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="block bg-white border border-navy/10 rounded-md p-3 text-center text-sm font-semibold text-navy hover:border-yi-gold/50 transition-all"
          >
            {n.label}
          </Link>
        ))}
      </div>

      {/* Team card */}
      {team ? (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
                Your team
              </div>
              <h2 className="text-xl font-bold text-navy mt-1">
                {team.team_name}
              </h2>
              <div className="mt-1 text-xs text-navy/60">
                <code className="px-1.5 py-0.5 bg-navy/5 rounded font-mono">
                  {statusLabel(team.status ?? "registered")}
                </code>
                {isCaptain && (
                  <span className="ml-2 text-yi-gold font-semibold">
                    You are captain
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/yi-future/me/team"
              className="px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
            >
              {isCaptain ? "Manage team →" : "View team →"}
            </Link>
          </div>

          <div className="mt-4 pt-3 border-t border-navy/10">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-2">
              Members ({team.team_members.length}/{TEAM_SIZE_MAX})
            </div>
            <ul className="space-y-1 text-sm">
              {team.team_members.map((m) => (
                <li
                  key={m.delegate_id}
                  className="flex items-center justify-between"
                >
                  <span>
                    {m.delegates.full_name}
                    {m.delegate_id === me.id && (
                      <span className="ml-1 text-xs text-navy/40">(you)</span>
                    )}
                  </span>
                  {m.delegate_id === team.captain_id && (
                    <span className="text-[10px] font-semibold text-yi-gold">
                      CAPTAIN
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {team.team_members.length < TEAM_SIZE_MIN && (
              <p className="mt-2 text-xs text-yi-saffron">
                Need at least {TEAM_SIZE_MIN} members to submit deliverables.
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-navy/10">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-1">
              Problem statement
            </div>
            {team.problem_statements ? (
              <div className="font-semibold text-navy">
                {team.problem_statements.title}
              </div>
            ) : (
              <div className="text-sm text-yi-saffron">
                Not picked yet
                {isCaptain && " — tap Manage team to pick one"}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚀</div>
          <h2 className="text-lg font-bold text-navy">Start or join a team</h2>
          <p className="mt-2 text-sm text-navy/60">
            Create your own team and invite members, or check if someone invited you.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/yi-future/me/team"
              className="px-4 py-2 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90"
            >
              Create a team
            </Link>
            <Link
              href="/yi-future/me/team/invites"
              className="px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:bg-navy/5"
            >
              Check invitations
            </Link>
          </div>
          <div className="mt-4 text-xs text-navy/40">
            Access code: <span className="font-mono font-bold text-yi-gold">{me.access_code}</span>
          </div>
        </section>
      )}

      {/* Participation history */}
      {pastEditions.length > 0 && (
        <section className="bg-gradient-to-br from-navy to-navy-dark rounded-lg p-5 text-ivory">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-yi-gold mb-3">
            Future alumni
          </div>
          <h3 className="font-bold text-lg">
            You&apos;ve been here before
          </h3>
          <p className="mt-1 text-sm text-ivory/60">
            Your experience gives your team an edge.
          </p>
          <div className="mt-4 space-y-2">
            {pastEditions.map((pe, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <div>
                  <div className="font-semibold text-ivory">
                    Future {pe.year}
                  </div>
                  <div className="text-xs text-ivory/50">
                    {pe.chapter}
                    {pe.team && <> · {pe.team}</>}
                  </div>
                </div>
                {pe.award && (
                  <span className="px-2 py-0.5 rounded-full bg-yi-gold/20 text-yi-gold text-[10px] font-bold uppercase tracking-wider">
                    {pe.award.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
