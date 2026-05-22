import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { AWARD_CATEGORY_LABELS } from "@/lib/yi-future/constants";

type Team = {
  team_id: string;
};

type Advancement = {
  team_id: string;
  rank: number | null;
  total_score: number | null;
  from_event_id: string;
  to_event_id: string;
  events: {
    name: string;
    type: string | null;
  } | null;
};

type Award = {
  id: string;
  category: string;
  citation: string | null;
  custom_label: string | null;
  position: number | null;
  announced_at: string | null;
  events: { name: string } | null;
};

async function getMyTeam(delegateId: string): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  return (data as Team | null)?.team_id ?? null;
}

async function getAdvancements(teamId: string): Promise<Advancement[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, rank, total_score, from_event_id, to_event_id, events:events!advancements_to_event_id_fkey(name, type)"
    )
    .eq("team_id", teamId)
    .order("advanced_at", { ascending: false });
  return (data as unknown as Advancement[]) ?? [];
}

async function getAwards(teamId: string): Promise<Award[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("awards")
    .select(
      "id, category, citation, custom_label, position, announced_at, events(name)"
    )
    .eq("team_id", teamId)
    .order("announced_at", { ascending: false });
  return (data as unknown as Award[]) ?? [];
}

export default async function MyResultsPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const teamId = await getMyTeam(session.id);
  if (!teamId) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/60">
        Not on a team yet — results will show up here after your chapter
        final.
      </div>
    );
  }

  const [advancements, awards] = await Promise.all([
    getAdvancements(teamId),
    getAwards(teamId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Your team results
        </h2>
      </div>

      {/* Awards first, celebratory */}
      {awards.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-yi-gold mb-2">
            🏆 Awards
          </h3>
          <ul className="space-y-3">
            {awards.map((a) => (
              <li
                key={a.id}
                className="bg-gradient-to-br from-yi-gold/10 to-yi-saffron/10 border-2 border-yi-gold/30 rounded-lg p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
                  {a.custom_label ??
                    AWARD_CATEGORY_LABELS[
                      a.category as keyof typeof AWARD_CATEGORY_LABELS
                    ] ??
                    a.category}
                  {a.position && ` · #${a.position}`}
                </div>
                {a.events?.name && (
                  <div className="mt-0.5 text-xs text-navy/60">
                    {a.events.name}
                  </div>
                )}
                {a.citation && (
                  <p className="mt-2 text-sm text-navy italic">
                    &ldquo;{a.citation}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Advancements */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
          Advancements
        </h3>
        {advancements.length === 0 ? (
          <div className="bg-white border border-navy/10 rounded-lg p-4 text-center text-sm text-navy/50">
            No advancement yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {advancements.map((a) => (
              <li
                key={a.to_event_id}
                className="bg-white border border-yi-green/30 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-yi-green">
                      → Advanced to {a.events?.name ?? "next event"}
                    </div>
                    <div className="text-xs text-navy/50 mt-0.5">
                      {a.events?.type === "national_track_final"
                        ? "National Track Final"
                        : "Next event"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-navy">
                      {a.total_score ?? "—"}
                    </div>
                    {a.rank && (
                      <div className="text-[10px] text-navy/50">
                        rank #{a.rank}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {awards.length === 0 && advancements.length === 0 && (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/60">
          No results yet — check back after your chapter final.
        </div>
      )}
    </div>
  );
}
