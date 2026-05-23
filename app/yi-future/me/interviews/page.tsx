import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import type { Database } from "@/types/yi-future/database";

type InterviewOutcome = Database["future"]["Enums"]["interview_outcome"];

type Interview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  room: string | null;
  outcome: InterviewOutcome | null;
  partner_notes: string | null;
  corporate_partners: {
    organization: string;
    website_url: string | null;
  } | null;
  internship_slots: {
    title: string;
    domain: string | null;
    stipend: string | null;
    location: string | null;
  } | null;
};

async function getInterviews(delegateId: string): Promise<Interview[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("interview_slots")
    .select(
      "id, scheduled_at, duration_minutes, room, outcome, partner_notes, corporate_partners(organization, website_url), internship_slots(title, domain, stipend, location)"
    )
    .eq("delegate_id", delegateId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as Interview[]) ?? [];
}

const OUTCOME_LABEL: Record<string, string> = {
  offered: "🎉 Offered",
  shortlisted: "⭐ Shortlisted",
  followup: "📩 Follow-up",
  no_fit: "No fit",
};

const OUTCOME_COLOR: Record<string, string> = {
  offered: "bg-yi-green/10 text-yi-green",
  shortlisted: "bg-yi-gold/10 text-yi-gold",
  followup: "bg-yi-saffron/10 text-yi-saffron",
  no_fit: "bg-navy/5 text-navy/60",
};

export default async function MyInterviewsPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const interviews = await getInterviews(session.id);
  const now = new Date();
  const upcoming = interviews.filter((iv) => new Date(iv.scheduled_at) >= now);
  const past = interviews.filter((iv) => new Date(iv.scheduled_at) < now);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">Your interviews</h2>
        <p className="mt-1 text-sm text-navy/60">
          {interviews.length} total · {upcoming.length} upcoming
        </p>
      </div>

      {interviews.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          No interviews scheduled yet. Add a resume at{" "}
          <Link
            href="/yi-future/me/resume"
            className="text-yi-gold font-semibold hover:underline"
          >
            /yi-future/me/resume
          </Link>{" "}
          so partners can find you.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
                Upcoming
              </h3>
              <ul className="space-y-3">
                {upcoming.map((iv) => (
                  <InterviewCard key={iv.id} iv={iv} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
                Past ({past.length})
              </h3>
              <ul className="space-y-3">
                {past.map((iv) => (
                  <InterviewCard key={iv.id} iv={iv} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InterviewCard({ iv }: { iv: Interview }): React.JSX.Element {
  return (
    <li className="bg-white border border-navy/10 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-navy">
            {iv.corporate_partners?.organization ?? "—"}
          </div>
          {iv.internship_slots?.title && (
            <div className="text-xs text-navy/60 mt-0.5">
              {iv.internship_slots.title}
              {iv.internship_slots.domain && ` · ${iv.internship_slots.domain}`}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-navy/60">
            <span>
              📅{" "}
              {new Date(iv.scheduled_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            {iv.duration_minutes && <span>⏱ {iv.duration_minutes} min</span>}
            {iv.room && <span>📍 {iv.room}</span>}
            {iv.internship_slots?.stipend && (
              <span>💰 {iv.internship_slots.stipend}</span>
            )}
          </div>
        </div>
        {iv.outcome && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0 ${
              OUTCOME_COLOR[iv.outcome] ?? "bg-navy/5 text-navy/60"
            }`}
          >
            {OUTCOME_LABEL[iv.outcome] ?? iv.outcome}
          </span>
        )}
      </div>
      {iv.partner_notes && (
        <div className="mt-3 p-2 rounded bg-navy/5 text-xs text-navy/70">
          <span className="font-semibold">Partner note: </span>
          {iv.partner_notes}
        </div>
      )}
    </li>
  );
}
