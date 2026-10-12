import "server-only";

import { checkerSeats, type RxViewer } from "@/lib/recognitions/auth";
import {
  chapterMap,
  conflictsForDuties,
  conflictsForPerson,
  getPeople,
  listAwards,
  listNominationsForAward,
} from "@/lib/recognitions/data";
import {
  decideSeat,
  effectiveStatus,
  exclusionReason,
  fixDeadlineFor,
  isNlAdded,
  ACTOR_LABEL,
} from "@/lib/recognitions/check-rules";
import type { Category, Vertical } from "@/lib/recognitions/constants";
import type { CycleRow, NominationStatus } from "@/lib/recognitions/types";
import { rxService } from "@/lib/recognitions/supabase";
import { formatWhen } from "../../_ui/primitives";

/**
 * What one checker sees on the Check desk: every filed nomination in the
 * regions they check, with who has passed it and what they may do now.
 * The buttons' verdicts come from decideSeat — the same function the server
 * actions use — so the page never offers a button the server would refuse.
 * The Recognitions super admin sees every region's nominations.
 */

/** `override`: the super admin filled this seat (their pass stood in for the checker). */
export type CheckPass = { by: string; at: string | null; override: boolean } | null;

export type CheckItem = {
  nominationId: string;
  awardId: string;
  awardTitle: string;
  vertical: Vertical;
  chapterName: string;
  region: string;
  category: Category;
  status: NominationStatus;
  submittedAt: string | null;
  rcPass: CheckPass;
  rmPass: CheckPass;
  returned: { by: string; at: string | null; note: string } | null;
  excludedWhy: string | null;
  /** Pass verdict: the label of the seat the viewer would fill, or why they can't. `override`: a super-admin pass. */
  pass: { ok: true; label: string; override: boolean } | { ok: false; error: string };
  canReturn: boolean;
  returnBlocked: string | null;
  /**
   * National Leadership added this chapter, which did not nominate
   * (recognitions_03): its reason replaces the five-section form, a send-back
   * goes to National Leadership, and everything runs to re-evaluation's deadline.
   */
  nlAdded: { by: string; at: string | null; reason: string } | null;
  /** The deadline a sent-back nomination must be fixed by (the fix deadline, or re-evaluation's). */
  fixBy: string | null;
  dossier: {
    reasons: string[];
    flagship: string;
    hosted: string | null;
    announcement: string;
  };
};

export async function loadCheckItems(
  viewer: RxViewer,
  cycle: CycleRow,
  opts: { awardId?: string } = {}
): Promise<CheckItem[]> {
  const awards = (await listAwards(cycle.id)).filter((a) => !opts.awardId || a.id === opts.awardId);
  const [chapters, personConflicts] = await Promise.all([chapterMap(), conflictsForPerson(viewer.personId)]);
  const rmDuties = viewer.duties.filter((d) => d.layer === "rm");
  const dutyConflicts = await conflictsForDuties(rmDuties);

  const rows: Array<Omit<CheckItem, "rcPass" | "rmPass" | "returned" | "nlAdded"> & {
    rcBy: string | null;
    rcAt: string | null;
    rmBy: string | null;
    rmAt: string | null;
    retBy: string | null;
    retAt: string | null;
    retNote: string | null;
    addBy: string | null;
    addAt: string | null;
    addReason: string | null;
  }> = [];

  for (const award of awards) {
    for (const n of await listNominationsForAward(award.id)) {
      if (n.status === "draft") continue;
      const seats = checkerSeats(viewer, n);
      if (!seats.asRegionalChair && !seats.rmDuty && !viewer.isSuperAdmin) continue; // not this checker's region
      const conflicted =
        personConflicts.has(n.chapter_id) ||
        (seats.rmDuty !== null && (dutyConflicts.get(seats.rmDuty.id)?.has(n.chapter_id) ?? true));
      const base = {
        personId: viewer.personId,
        asRegionalChair: seats.asRegionalChair,
        hasRmDuty: seats.rmDuty !== null,
        asSuperAdmin: viewer.isSuperAdmin,
        conflicted,
        nomination: n,
        cycle,
        when: formatWhen,
      };
      const pass = decideSeat({ ...base, action: "pass" });
      const ret = decideSeat({ ...base, action: "return" });
      const status = effectiveStatus(n, cycle);
      rows.push({
        nominationId: n.id,
        awardId: award.id,
        awardTitle: award.title,
        vertical: award.vertical,
        chapterName: chapters.get(n.chapter_id)?.name ?? "Unknown chapter",
        region: n.region,
        category: n.category,
        status,
        submittedAt: n.submitted_at,
        excludedWhy: exclusionReason(n, cycle),
        pass: pass.ok
          ? { ok: true, label: ACTOR_LABEL[pass.seat], override: pass.seat === "sa" }
          : { ok: false, error: pass.error },
        canReturn: ret.ok,
        returnBlocked: ret.ok ? null : ret.error,
        dossier: {
          reasons: n.reasons ?? [],
          flagship: n.flagship_event ?? "",
          hosted: n.hosted_event
            ? `${n.hosted_event_name || "Name not given"}${n.hosted_event_type ? ` (${n.hosted_event_type === "national" ? "National" : "Regional"})` : ""}`
            : null,
          announcement: n.announcement_draft ?? "",
        },
        rcBy: n.rc_checked_by,
        rcAt: n.rc_checked_at,
        rmBy: n.rm_checked_by,
        rmAt: n.rm_checked_at,
        retBy: n.returned_by,
        retAt: n.returned_at,
        retNote: n.status === "returned" ? n.return_note : null,
        addBy: isNlAdded(n) ? n.added_by : null,
        addAt: isNlAdded(n) ? n.added_at : null,
        addReason: isNlAdded(n) ? n.added_reason ?? "" : null,
        fixBy: fixDeadlineFor(n, cycle),
      });
    }
  }

  const [people, overrides] = await Promise.all([
    getPeople(rows.flatMap((r) => [r.rcBy, r.rmBy, r.retBy, r.addBy]).filter((x): x is string => !!x)),
    superAdminPasses(rows.filter((r) => r.rcBy || r.rmBy).map((r) => r.nominationId)),
  ]);
  const who = (id: string) => (id === viewer.personId ? "you" : people.get(id)?.full_name ?? "a checker");
  // An override always ends at 'checked', which can never be resubmitted, so a
  // logged override still describes the seats it filled.
  const overridden = (nominationId: string, seat: "rc" | "rm") =>
    (overrides.get(nominationId) ?? []).some((o) => o.filled.includes(seat));

  return rows
    .map(({ rcBy, rcAt, rmBy, rmAt, retBy, retAt, retNote, addBy, addAt, addReason, ...r }) => ({
      ...r,
      nlAdded: addReason !== null ? { by: addBy ? who(addBy) : "National Leadership", at: addAt, reason: addReason } : null,
      rcPass: rcBy ? { by: who(rcBy), at: rcAt, override: overridden(r.nominationId, "rc") } : null,
      rmPass: rmBy ? { by: who(rmBy), at: rmAt, override: overridden(r.nominationId, "rm") } : null,
      returned: retNote !== null ? { by: retBy ? who(retBy) : "a checker", at: retAt, note: retNote } : null,
    }))
    .sort((a, b) => a.awardTitle.localeCompare(b.awardTitle) || a.chapterName.localeCompare(b.chapterName));
}

/** The super admin's passes (audited as "sa", see actions/check.ts), by nomination. */
async function superAdminPasses(nominationIds: string[]): Promise<Map<string, Array<{ filled: string[] }>>> {
  const out = new Map<string, Array<{ filled: string[] }>>();
  if (nominationIds.length === 0) return out;
  const { data, error } = await rxService()
    .from("recognition_audit_log")
    .select("entity_id, detail")
    .eq("action", "nomination_check_passed")
    .eq("detail->>as", "sa")
    .in("entity_id", nominationIds);
  if (error) {
    console.error(JSON.stringify({ tag: "recognitions_check_override_read_failed", error: error.message }));
    return out;
  }
  for (const row of (data ?? []) as Array<{ entity_id: string; detail: { filled?: unknown } }>) {
    const filled = Array.isArray(row.detail?.filled) ? (row.detail.filled as unknown[]).map(String) : [];
    out.set(row.entity_id, [...(out.get(row.entity_id) ?? []), { filled }]);
  }
  return out;
}
