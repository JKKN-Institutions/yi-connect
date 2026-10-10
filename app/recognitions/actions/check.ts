"use server";

import { revalidatePath } from "next/cache";
import { checkerSeats, getRxViewer } from "@/lib/recognitions/auth";
import {
  audit,
  conflictsForDuties,
  conflictsForPerson,
  getAward,
  getCurrentCycle,
} from "@/lib/recognitions/data";
import { rxService } from "@/lib/recognitions/supabase";
import { decideSeat, fixDeadlineFor, isNlAdded, SEAT_LABEL, type CheckSeat } from "@/lib/recognitions/check-rules";
import { isPast } from "@/lib/recognitions/phase";
import { countWords } from "@/lib/recognitions/words";
import { WORDS } from "@/lib/recognitions/constants";
import type { ActionResult, AwardRow, CycleRow, NominationRow } from "@/lib/recognitions/types";
import { formatWhen } from "../_ui/primitives";

/**
 * The nomination check (recognitions_02). Piyush's 2026 deck: "Regional
 * Chairs + Regional Mentors validate nominations for eligibility and
 * completeness." BOTH the Regional Chair of the chapter's region AND a
 * Regional Mentor on the award for that region must pass a nomination
 * before it is scored; either may send it back with a note.
 *
 * The SERVER decides which seat the caller fills (decideSeat). The browser
 * only sends the nomination id (and the note). Every denial is a
 * { success:false, error } in plain English, never a redirect.
 */

const MAX_NOTE_CHARS = 1000;

type Ctx = {
  personId: string;
  nomination: NominationRow;
  award: AwardRow;
  cycle: CycleRow;
  asRegionalChair: boolean;
  hasRmDuty: boolean;
  conflicted: boolean;
};

async function loadContext(nominationId: string): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const viewer = await getRxViewer();
  if (!viewer) return { ok: false, error: "You are not signed in, or your account is not in the Yi directory." };
  if (typeof nominationId !== "string" || nominationId === "") {
    return { ok: false, error: "No nomination was chosen. Reload the page and try again." };
  }

  const { data, error } = await rxService()
    .from("recognition_nominations")
    .select("*")
    .eq("id", nominationId)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ tag: "recognitions_check_read_failed", error: error.message }));
    return { ok: false, error: "Couldn't load that nomination just now. Try again." };
  }
  const nomination = data as NominationRow | null;
  if (!nomination) return { ok: false, error: "That nomination no longer exists. Reload the page." };

  const [award, cycle] = await Promise.all([getAward(nomination.award_id), getCurrentCycle()]);
  if (!award || !award.is_active || !cycle || award.cycle_id !== cycle.id) {
    return { ok: false, error: "That nomination is not part of this year's open awards." };
  }

  const seats = checkerSeats(viewer, nomination);
  // Same conflict rule evaluators have: any directory role in the chapter,
  // plus (for an RM) the chapters declared on their duty.
  const personConflicts = await conflictsForPerson(viewer.personId);
  const dutyConflicts = seats.rmDuty ? (await conflictsForDuties([seats.rmDuty])).get(seats.rmDuty.id) : undefined;
  const conflicted =
    personConflicts.has(nomination.chapter_id) || (seats.rmDuty !== null && (!dutyConflicts || dutyConflicts.has(nomination.chapter_id)));

  return {
    ok: true,
    ctx: {
      personId: viewer.personId,
      nomination,
      award,
      cycle,
      asRegionalChair: seats.asRegionalChair,
      hasRmDuty: seats.rmDuty !== null,
      conflicted,
    },
  };
}

function verdict(ctx: Ctx, action: "pass" | "return") {
  return decideSeat({
    action,
    personId: ctx.personId,
    asRegionalChair: ctx.asRegionalChair,
    hasRmDuty: ctx.hasRmDuty,
    conflicted: ctx.conflicted,
    nomination: ctx.nomination,
    cycle: ctx.cycle,
    when: formatWhen,
  });
}

function writeFailed(what: string, message: string): ActionResult {
  console.error(JSON.stringify({ tag: "recognitions_check_write_failed", what, error: message }));
  return { success: false, error: `Couldn't ${what} just now. Try again; if it keeps failing, tell the Recognitions super admin.` };
}

const SEAT_COLUMNS: Record<CheckSeat, { by: "rc_checked_by" | "rm_checked_by"; at: "rc_checked_at" | "rm_checked_at" }> = {
  rc: { by: "rc_checked_by", at: "rc_checked_at" },
  rm: { by: "rm_checked_by", at: "rm_checked_at" },
};

/** Pass a nomination in the caller's seat. When both seats are passed it enters the race. */
export async function passNomination(nominationId: string): Promise<ActionResult> {
  const loaded = await loadContext(nominationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const ctx = loaded.ctx;
  const v = verdict(ctx, "pass");
  if (!v.ok) return { success: false, error: v.error };

  const mine = SEAT_COLUMNS[v.seat];
  const other = SEAT_COLUMNS[v.seat === "rc" ? "rm" : "rc"];
  const now = new Date().toISOString();
  const svc = rxService();

  // Conditional write: still awaiting checks, my seat still empty, and the
  // other seat not held by me (one person can never pass both).
  const { data, error } = await svc
    .from("recognition_nominations")
    .update({ [mine.by]: ctx.personId, [mine.at]: now, updated_at: now })
    .eq("id", ctx.nomination.id)
    .eq("status", "submitted")
    .is(mine.by, null)
    .or(`${other.by}.is.null,${other.by}.neq.${ctx.personId}`)
    .select("rc_checked_by, rm_checked_by");
  if (error) return writeFailed("pass the nomination", error.message);
  const row = (data ?? [])[0] as Pick<NominationRow, "rc_checked_by" | "rm_checked_by"> | undefined;
  if (!row) {
    return { success: false, error: "Someone changed this nomination a moment ago. Reload the page to see where it stands." };
  }

  // Both seats passed -> it enters the race.
  let bothPassed = false;
  if (row.rc_checked_by && row.rm_checked_by) {
    const { data: done, error: doneErr } = await svc
      .from("recognition_nominations")
      .update({ status: "checked", updated_at: now })
      .eq("id", ctx.nomination.id)
      .eq("status", "submitted")
      .not("rc_checked_by", "is", null)
      .not("rm_checked_by", "is", null)
      .select("id");
    if (doneErr) return writeFailed("mark the nomination as passed", doneErr.message);
    bothPassed = (done ?? []).length > 0;
  }

  await audit({
    cycleId: ctx.cycle.id,
    awardId: ctx.award.id,
    actorPersonId: ctx.personId,
    action: "nomination_check_passed",
    entity: "recognition_nominations",
    entityId: ctx.nomination.id,
    detail: { chapter_id: ctx.nomination.chapter_id, region: ctx.nomination.region, as: v.seat, both_passed: bothPassed },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: bothPassed
      ? "Passed. Both checkers have now passed it, so it goes forward to scoring."
      : `Passed as ${SEAT_LABEL[v.seat]}. It now needs the ${v.seat === "rc" ? "Regional Mentor" : "Regional Chair"} to pass it too.`,
  };
}

/** Send a nomination back to the chapter with a note (required, 50 words max). */
export async function returnNomination(nominationId: string, note: string): Promise<ActionResult> {
  const text = typeof note === "string" ? note.trim() : "";
  if (text === "") return { success: false, error: "Write a note telling the chapter what to fix." };
  const words = countWords(text);
  if (words > WORDS.returnNote) {
    return { success: false, error: `The note is ${words} words; the limit is ${WORDS.returnNote}. Shorten it and try again.` };
  }
  if (text.length > MAX_NOTE_CHARS) {
    return { success: false, error: `The note is over ${MAX_NOTE_CHARS} characters. Shorten it and try again.` };
  }

  const loaded = await loadContext(nominationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const ctx = loaded.ctx;
  const v = verdict(ctx, "return");
  if (!v.ok) return { success: false, error: v.error };

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({ status: "returned", returned_by: ctx.personId, returned_at: now, return_note: text, updated_at: now })
    .eq("id", ctx.nomination.id)
    .eq("status", "submitted")
    .select("id");
  if (error) return writeFailed("send the nomination back", error.message);
  if ((data ?? []).length === 0) {
    return { success: false, error: "Someone changed this nomination a moment ago. Reload the page to see where it stands." };
  }

  // An NL-added nomination goes back to National Leadership, which can fix it
  // until the re-evaluation deadline (recognitions_03).
  const nl = isNlAdded(ctx.nomination);
  const fixer = nl ? "National Leadership" : "the chapter";
  const fixBy = fixDeadlineFor(ctx.nomination, ctx.cycle);
  const fixClosed = isPast(fixBy);
  await audit({
    cycleId: ctx.cycle.id,
    awardId: ctx.award.id,
    actorPersonId: ctx.personId,
    action: "nomination_returned",
    entity: "recognition_nominations",
    entityId: ctx.nomination.id,
    detail: {
      chapter_id: ctx.nomination.chapter_id,
      region: ctx.nomination.region,
      as: v.seat,
      note: text,
      after_fix_deadline: fixClosed,
      ...(nl ? { origin: "nl_added", returned_to: "national_leadership" } : {}),
    },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: fixClosed
      ? `Sent back. The deadline to fix it has passed, so ${fixer} can't resubmit: this nomination is now out of the race.`
      : fixBy
        ? `Sent back. ${nl ? "National Leadership" : "The chapter"} can fix and resubmit it until ${formatWhen(fixBy)}.`
        : `Sent back. ${nl ? "National Leadership" : "The chapter"} can fix and resubmit it.`,
  };
}
