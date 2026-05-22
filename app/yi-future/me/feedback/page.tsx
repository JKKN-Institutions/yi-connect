import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { PHASES, PHASE_LABELS, type Phase } from "@/lib/yi-future/constants";

type FeedbackRow = {
  id: string;
  phase: Phase;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  next_actions: string | null;
  created_at: string;
  mentors: { full_name: string } | null;
};

async function getTeamId(delegateId: string): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .limit(1)
    .maybeSingle();
  return (data as unknown as { team_id: string } | null)?.team_id ?? null;
}

async function getFeedback(teamId: string): Promise<FeedbackRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("mentor_feedback")
    .select(
      "id, phase, rating, strengths, improvements, next_actions, created_at, mentors(full_name)"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  return (data as unknown as FeedbackRow[]) ?? [];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.substring(0, 10);
  }
}

function Stars({ rating }: { rating: number | null }): React.JSX.Element | null {
  if (rating === null || rating === undefined) return null;
  const filled = Math.max(0, Math.min(5, rating));
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= filled ? "text-yi-gold" : "text-navy/20"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default async function DelegateFeedbackPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const teamId = await getTeamId(session.id);

  if (!teamId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Mentor Feedback</h1>
          <p className="mt-1 text-sm text-navy/60">
            Notes from your mentor after each phase.
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">💬</div>
          <h2 className="text-lg font-bold text-navy">No team yet</h2>
          <p className="mt-2 text-sm text-navy/60">
            Once you&apos;re added to a team and your mentor shares feedback,
            it will appear here.
          </p>
        </div>
      </div>
    );
  }

  const feedback = await getFeedback(teamId);
  const grouped: Record<Phase, FeedbackRow[]> = {
    phase_a: [],
    phase_b: [],
    phase_c: [],
  };
  for (const f of feedback) {
    if (grouped[f.phase]) grouped[f.phase].push(f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Mentor Feedback</h1>
        <p className="mt-1 text-sm text-navy/60">
          {feedback.length} note{feedback.length === 1 ? "" : "s"} across the
          90-day journey.
        </p>
      </div>

      {feedback.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">📝</div>
          <h2 className="text-lg font-bold text-navy">No feedback yet</h2>
          <p className="mt-2 text-sm text-navy/60">
            Your mentor will post notes here after each phase checkpoint.
          </p>
        </div>
      ) : (
        PHASES.map((phase) => {
          const items = grouped[phase];
          if (items.length === 0) return null;
          return (
            <section key={phase} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-navy/70">
                  {PHASE_LABELS[phase]}
                </h2>
                <span className="text-xs text-navy/40">
                  ({items.length})
                </span>
              </div>
              <div className="space-y-3">
                {items.map((f) => (
                  <article
                    key={f.id}
                    className="bg-white border border-navy/10 rounded-lg p-5"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-bold text-navy">
                          {f.mentors?.full_name ?? "Mentor"}
                        </div>
                        <div className="text-xs text-navy/50 mt-0.5">
                          {formatDate(f.created_at)}
                        </div>
                      </div>
                      <Stars rating={f.rating} />
                    </div>

                    {f.strengths && (
                      <div className="mt-4">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-1">
                          Strengths
                        </div>
                        <p className="text-sm text-navy whitespace-pre-wrap">
                          {f.strengths}
                        </p>
                      </div>
                    )}

                    {f.improvements && (
                      <div className="mt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-1">
                          Areas to improve
                        </div>
                        <p className="text-sm text-navy whitespace-pre-wrap">
                          {f.improvements}
                        </p>
                      </div>
                    )}

                    {f.next_actions && (
                      <div className="mt-3 pt-3 border-t border-navy/10">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold mb-1">
                          Next actions
                        </div>
                        <p className="text-sm text-navy whitespace-pre-wrap">
                          {f.next_actions}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
