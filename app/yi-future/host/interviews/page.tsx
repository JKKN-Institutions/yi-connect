import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  setInterviewOutcome,
  deleteInterview,
} from "@/app/yi-future/actions/interviews";
import type { Database } from "@/types/yi-future/database";

type InterviewOutcome = Database["future"]["Enums"]["interview_outcome"];

type Interview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  room: string | null;
  outcome: InterviewOutcome | null;
  partner_notes: string | null;
  delegates: { full_name: string; email: string | null } | null;
  corporate_partners: { organization: string } | null;
  internship_slots: { title: string } | null;
};

async function getInterviews(eventId: string): Promise<Interview[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("interview_slots")
    .select(
      "id, scheduled_at, duration_minutes, room, outcome, partner_notes, delegates(full_name, email), corporate_partners(organization), internship_slots(title)"
    )
    .eq("event_id", eventId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as Interview[]) ?? [];
}

async function updateOutcome(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("outcome") ?? "");
  const outcome = (raw || null) as InterviewOutcome | null;
  const notes = String(formData.get("partner_notes") ?? "").trim() || null;
  await setInterviewOutcome(id, outcome, notes);
}

async function remove(formData: FormData) {
  "use server";
  await deleteInterview(String(formData.get("id") ?? ""));
}

const OUTCOME_STYLE: Record<string, string> = {
  offered: "bg-yi-green/10 text-yi-green",
  shortlisted: "bg-yi-gold/10 text-yi-gold",
  followup: "bg-yi-saffron/10 text-yi-saffron",
  no_fit: "bg-red-100 text-red-700",
};

export default async function InterviewsPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const interviews = await getInterviews(ctx.nationalEvent.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Interviews</h2>
          <p className="mt-1 text-sm text-navy/60">
            {interviews.length} scheduled · opportunity interview slots on
            Day 2
          </p>
        </div>
        <Link
          href="/yi-future/host/interviews/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Schedule
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No interviews scheduled yet.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="text-left px-4 py-3 font-semibold">Delegate</th>
                <th className="text-left px-4 py-3 font-semibold">Partner</th>
                <th className="text-left px-4 py-3 font-semibold">Slot</th>
                <th className="text-left px-4 py-3 font-semibold">Room</th>
                <th className="text-left px-4 py-3 font-semibold">Outcome</th>
                <th className="text-right px-4 py-3 font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((iv) => (
                <tr key={iv.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {new Date(iv.scheduled_at).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {iv.duration_minutes && (
                      <div className="text-[10px] text-navy/40">
                        {iv.duration_minutes} min
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">
                      {iv.delegates?.full_name ?? "—"}
                    </div>
                    {iv.delegates?.email && (
                      <div className="text-navy/50">{iv.delegates.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {iv.corporate_partners?.organization ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/60">
                    {iv.internship_slots?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/60">
                    {iv.room ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateOutcome} className="flex gap-1">
                      <input type="hidden" name="id" value={iv.id} />
                      <select
                        name="outcome"
                        defaultValue={iv.outcome ?? ""}
                        className={`px-2 py-1 text-xs border border-navy/20 rounded bg-white ${
                          iv.outcome ? OUTCOME_STYLE[iv.outcome] : ""
                        }`}
                      >
                        <option value="">—</option>
                        <option value="offered">Offered</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="followup">Follow-up</option>
                        <option value="no_fit">No fit</option>
                      </select>
                      <input
                        type="hidden"
                        name="partner_notes"
                        value={iv.partner_notes ?? ""}
                      />
                      <button
                        type="submit"
                        className="text-[10px] font-semibold text-navy/60 hover:text-navy"
                      >
                        save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={remove}>
                      <input type="hidden" name="id" value={iv.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600/70 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
