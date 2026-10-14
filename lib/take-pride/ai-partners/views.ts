import "server-only";

import { loadPartnerForAi, partnerAiEligibility } from "./load";
import { latestBySubject, remainingToday, type PartnerAiJob } from "./queue";
import type { BriefState, DraftState, LeadFollowupOutput, PartnerBriefOutput } from "./schemas";

/*
 * What the Catalyst page shows for partner-side AI. Briefs and drafts are
 * shown only for people who STILL qualify right now (listed in the
 * directory or an accepted meeting for a brief; a lead or an accepted
 * meeting for a follow-up): someone who hid their listing or declined drops
 * out, even if a brief was written earlier. Only partner_brief and
 * lead_followup rows are read here, never a sales chaser.
 */

export type PartnerAiView = {
  /** False when the queue cannot be read (e.g. its migration is not applied): hide every AI control. */
  available: boolean;
  briefs: Map<string, BriefState>;
  drafts: Map<string, DraftState>;
  briefEligible: Set<string>;
  followupEligible: Set<string>;
  /** Newest created_at of a job still being written, for the auto-refresh. */
  waitingSince: string | null;
  briefLeft: number;
  followupLeft: number;
  /** Leads + accepted meetings with no draft (or a failed one). */
  missingDrafts: number;
};

const EMPTY = (): PartnerAiView => ({
  available: false,
  briefs: new Map(),
  drafts: new Map(),
  briefEligible: new Set(),
  followupEligible: new Set(),
  waitingSince: null,
  briefLeft: 0,
  followupLeft: 0,
  missingDrafts: 0,
});

const waiting = (j: PartnerAiJob) => j.status === "pending" || j.status === "generating";

export async function getPartnerAiView(
  partnerId: string,
  people: { matches: string[]; accepted: Set<string>; leads: Set<string> }
): Promise<PartnerAiView> {
  try {
    const p = await loadPartnerForAi(partnerId);
    if (!p || p.status !== "confirmed" || p.cancelled_at) return EMPTY();
    const [briefJobs, draftJobs, briefLeft, followupLeft] = await Promise.all([
      latestBySubject(partnerId, "partner_brief"),
      latestBySubject(partnerId, "lead_followup"),
      remainingToday(partnerId, "partner_brief"),
      remainingToday(partnerId, "lead_followup"),
    ]);
    if (!briefJobs || !draftJobs) return EMPTY();

    const ids = [...new Set([...people.matches, ...people.accepted, ...people.leads])];
    const ok = await partnerAiEligibility(p, ids, { accepted: people.accepted, leads: people.leads });

    let newest: string | null = null;
    const note = (j: PartnerAiJob) => {
      if (waiting(j) && (!newest || j.created_at > newest)) newest = j.created_at;
    };

    const briefs = new Map<string, BriefState>();
    for (const id of ok.brief) {
      const j = briefJobs.get(id);
      if (!j) briefs.set(id, { status: "none" });
      else if (waiting(j)) {
        note(j);
        briefs.set(id, { status: "waiting" });
      } else if (j.status === "ready" && j.output) briefs.set(id, { status: "ready", ...(j.output as PartnerBriefOutput) });
      else briefs.set(id, { status: "failed" });
    }

    const drafts = new Map<string, DraftState>();
    let missing = 0;
    for (const id of ok.followup) {
      const j = draftJobs.get(id);
      if (!j) {
        drafts.set(id, { status: "none" });
        missing++;
      } else if (waiting(j)) {
        note(j);
        drafts.set(id, { status: "waiting" });
      } else if (j.status === "ready" && j.output) drafts.set(id, { status: "ready", message: (j.output as LeadFollowupOutput).message });
      else {
        drafts.set(id, { status: "failed" });
        missing++;
      }
    }

    return {
      available: true,
      briefs,
      drafts,
      briefEligible: ok.brief,
      followupEligible: ok.followup,
      waitingSince: newest,
      briefLeft,
      followupLeft,
      missingDrafts: missing,
    };
  } catch {
    return EMPTY();
  }
}
