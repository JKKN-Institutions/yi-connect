import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

export const dynamic = "force-dynamic";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type Me = {
  id: string;
  chapter_id: string | null;
  chapters: { name: string } | null;
  team_members: {
    teams: {
      id: string;
      team_name: string;
      problem_statement_id: string | null;
      problem_statements: { title: string; short_description: string | null } | null;
    } | null;
  }[];
};

type PeerTeam = {
  id: string;
  team_name: string;
  status: string | null;
  team_members: { delegate_id: string }[];
};

function statusLabel(s: string | null): string {
  return (s ?? "registered").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function MyProblemPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const svc = await createServiceClient();
  const { data: meRaw } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, chapter_id, chapters(name), team_members(teams(id, team_name, problem_statement_id, problem_statements(title, short_description)))"
    )
    .eq("id", session.id)
    .maybeSingle();
  const me = meRaw as unknown as Me | null;

  const team = me?.team_members?.[0]?.teams ?? null;
  const problem = team?.problem_statements ?? null;
  const chapterName = me?.chapters?.name ?? "your chapter";

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
          My problem
        </h1>
        <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
          The teams in {chapterName} working on the same problem as you.
        </p>
      </div>
      {children}
    </div>
  );

  if (!team) {
    return (
      <Shell>
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          You&apos;re not on a team yet.{" "}
          <Link href="/yi-future/me/team" className="font-semibold" style={{ color: GOLD }}>
            Start or join a team →
          </Link>
        </div>
      </Shell>
    );
  }

  if (!team.problem_statement_id || !problem) {
    return (
      <Shell>
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          Your team hasn&apos;t picked a problem statement yet.{" "}
          <Link href="/yi-future/me/team" className="font-semibold" style={{ color: GOLD }}>
            Pick one →
          </Link>
        </div>
      </Shell>
    );
  }

  const { data: peersRaw } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name, status, team_members(delegate_id)")
    .eq("chapter_id", me!.chapter_id as string)
    .eq("problem_statement_id", team.problem_statement_id)
    .neq("id", team.id)
    .order("team_name", { ascending: true });
  const peers = (peersRaw as unknown as PeerTeam[]) ?? [];

  return (
    <Shell>
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: `${GOLD}33`, background: `${GOLD}0a` }}
      >
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Your problem
        </div>
        <h2 className="mt-0.5 font-bold" style={{ color: NAVY }}>
          {problem.title}
        </h2>
        {problem.short_description && (
          <p className="mt-1 text-sm" style={{ color: `${NAVY}b3` }}>
            {problem.short_description}
          </p>
        )}
        <p className="mt-2 text-xs" style={{ color: `${NAVY}80` }}>
          Your team <strong>{team.team_name}</strong> and {peers.length} other
          team{peers.length === 1 ? "" : "s"} in {chapterName}{" "}
          {peers.length === 1 ? "is" : "are"} tackling this.
        </p>
      </div>

      {peers.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-6 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          Yours is the only team in {chapterName} on this problem so far.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {peers.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border bg-white p-4"
              style={{ borderColor: `${NAVY}1a` }}
            >
              <div className="font-bold" style={{ color: NAVY }}>
                {p.team_name}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: `${NAVY}99` }}>
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ background: `${NAVY}0d` }}
                >
                  {statusLabel(p.status)}
                </span>
                <span>
                  {p.team_members?.length ?? 0} member
                  {(p.team_members?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
