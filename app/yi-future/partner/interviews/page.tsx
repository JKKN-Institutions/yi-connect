import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { setInterviewOutcome } from "@/app/yi-future/actions/interviews";
import type { Database } from "@/types/yi-future/database";

type InterviewOutcome = Database["future"]["Enums"]["interview_outcome"];

type Interview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  room: string | null;
  outcome: InterviewOutcome | null;
  partner_notes: string | null;
  delegates: {
    full_name: string;
    email: string | null;
    course: string | null;
    year_of_study: number | null;
    resume_url: string | null;
    colleges: { name: string } | null;
  } | null;
  internship_slots: { title: string } | null;
};

async function getInterviews(partnerId: string): Promise<Interview[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("interview_slots")
    .select(
      "id, scheduled_at, duration_minutes, room, outcome, partner_notes, delegates(full_name, email, course, year_of_study, resume_url, colleges(name)), internship_slots(title)"
    )
    .eq("partner_id", partnerId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as Interview[]) ?? [];
}

async function updateOutcome(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const outcome = (String(formData.get("outcome") ?? "") ||
    null) as InterviewOutcome | null;
  const notes = String(formData.get("partner_notes") ?? "").trim() || null;
  await setInterviewOutcome(id, outcome, notes);
}

export default async function PartnerInterviewsPage() {
  const session = await readSession();
  if (!session || session.type !== "partner") redirect("/yi-future/join");

  const interviews = await getInterviews(session.id);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/partner"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">Your interviews</h2>
        <p className="mt-1 text-sm text-navy/60">
          {interviews.length} scheduled
        </p>
      </div>

      {interviews.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          No interviews scheduled yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {interviews.map((iv) => (
            <li
              key={iv.id}
              className="bg-white border border-navy/10 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">
                    {iv.delegates?.full_name ?? "—"}
                  </div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {iv.delegates?.colleges?.name}
                    {iv.delegates?.course && ` · ${iv.delegates.course}`}
                    {iv.delegates?.year_of_study &&
                      ` · Y${iv.delegates.year_of_study}`}
                  </div>
                  {iv.delegates?.email && (
                    <div className="text-xs text-navy/50 mt-0.5">
                      {iv.delegates.email}
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
                    {iv.duration_minutes && (
                      <span>⏱ {iv.duration_minutes} min</span>
                    )}
                    {iv.room && <span>📍 {iv.room}</span>}
                  </div>
                  {iv.internship_slots?.title && (
                    <div className="mt-2 text-xs">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-navy/5 font-semibold">
                        {iv.internship_slots.title}
                      </span>
                    </div>
                  )}
                </div>
                {iv.delegates?.resume_url && (
                  <a
                    href={iv.delegates.resume_url}
                    target="_blank"
                    rel="noopener"
                    className="flex-shrink-0 px-3 py-1.5 rounded bg-yi-gold/10 text-yi-gold text-xs font-semibold hover:bg-yi-gold/20"
                  >
                    Resume →
                  </a>
                )}
              </div>

              <form action={updateOutcome} className="space-y-2 pt-3 border-t border-navy/10">
                <input type="hidden" name="id" value={iv.id} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select
                    name="outcome"
                    defaultValue={iv.outcome ?? ""}
                    className="px-3 py-2 text-sm border border-navy/20 rounded bg-white"
                  >
                    <option value="">— no outcome yet —</option>
                    <option value="offered">🎉 Offered</option>
                    <option value="shortlisted">⭐ Shortlisted</option>
                    <option value="followup">📩 Follow-up</option>
                    <option value="no_fit">No fit</option>
                  </select>
                  <input
                    name="partner_notes"
                    defaultValue={iv.partner_notes ?? ""}
                    placeholder="Private notes"
                    className="px-3 py-2 text-sm border border-navy/20 rounded"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-navy text-ivory rounded hover:bg-navy-dark"
                  >
                    Save outcome
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
