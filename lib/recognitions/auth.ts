import "server-only";

import { cache } from "react";
import { getCurrentPersonRoles, type PersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { rxService } from "./supabase";
import { RX_APP, RX_ROLES } from "./constants";
import type { AwardRow, ChapterRow, EvaluatorRow } from "./types";
import { getCurrentCycle } from "./data";

/**
 * Yi Recognitions authorization — the ONE place that answers "what may this
 * person do here". Reads only yi_directory (the mother source) plus the
 * per-cycle evaluator duty rows.
 *
 * The five logins of the spec, and what grants each:
 *   Chapter               app='yi' chapter_chair / chapter_co_chair for the
 *                         chapter (the directory IS who chairs a chapter), or
 *                         app='recognitions' chapter_rep for that chapter.
 *   Regional Mentor       duty row (layer rm, region R) AND directory role
 *                         app='recognitions' rm with yi_zone = R.
 *   NMT                   duty row (layer nmt) AND directory role nmt or
 *                         nmt_leader. The leader duty needs nmt_leader.
 *   National Leadership   app='recognitions' national_leadership.
 *   Super admin           app='recognitions' recognitions_super_admin, or any
 *                         platform_super_admin.
 *
 * FAIL CLOSED everywhere: a blank zone, chapter or region on either side
 * denies; it never matches another blank.
 */

const CHAIR_ROLES = new Set(["chapter_chair", "chapter_co_chair"]);
const PLATFORM_SUPER = new Set(["platform_super_admin", "super_admin"]);

export const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const same = (a: string | null | undefined, b: string | null | undefined) =>
  norm(a) !== "" && norm(a) === norm(b);

export type RxDuty = EvaluatorRow & { award: AwardRow };

export type RxViewer = {
  userId: string;
  personId: string;
  email: string | null;
  isSuperAdmin: boolean;
  isNationalLeadership: boolean;
  /** Chapters this person may file nominations and predictions for. */
  chapters: ChapterRow[];
  /** Active evaluator duties in the current cycle that the directory backs. */
  duties: RxDuty[];
};

function activeRx(me: PersonRoles, role: string) {
  return me.assignments.filter((a) => a.is_active && a.app === RX_APP && a.role === role);
}

export const getRxViewer = cache(async (): Promise<RxViewer | null> => {
  const me = await getCurrentPersonRoles();
  if (!me) return null;

  const isSuperAdmin =
    me.assignments.some((a) => a.is_active && PLATFORM_SUPER.has(a.role)) ||
    activeRx(me, RX_ROLES.superAdmin).length > 0;
  const isNationalLeadership = activeRx(me, RX_ROLES.nationalLeadership).length > 0;

  // ---- Chapter login ---------------------------------------------------
  const chapterNames = new Set(
    me.assignments
      .filter(
        (a) =>
          a.is_active &&
          ((a.app === "yi" && CHAIR_ROLES.has(a.role)) ||
            (a.app === RX_APP && a.role === RX_ROLES.chapterRep))
      )
      .map((a) => norm(a.yi_chapter))
      .filter((n) => n !== "")
  );

  const svc = rxService();
  let chapters: ChapterRow[] = [];
  if (chapterNames.size > 0) {
    const { data } = await svc
      .schema("yi")
      .from("chapters")
      .select("id, name, city, region")
      .eq("is_active", true);
    chapters = ((data ?? []) as ChapterRow[]).filter((c) => chapterNames.has(norm(c.name)));
  }

  // ---- Evaluator duties -------------------------------------------------
  const cycle = await getCurrentCycle();
  let duties: RxDuty[] = [];
  if (cycle) {
    const { data } = await svc
      .from("recognition_evaluators")
      .select("*, award:recognition_awards!inner(*)")
      .eq("person_id", me.person_id)
      .eq("is_active", true)
      .eq("award.cycle_id", cycle.id)
      .eq("award.is_active", true);

    const rmZones = activeRx(me, RX_ROLES.rm).map((a) => a.yi_zone);
    const holdsNmt = activeRx(me, RX_ROLES.nmt).length > 0;
    const holdsLeader = activeRx(me, RX_ROLES.nmtLeader).length > 0;

    duties = ((data ?? []) as RxDuty[]).filter((d) => {
      if (d.layer === "rm") return rmZones.some((z) => same(z, d.region));
      if (d.is_nmt_leader) return holdsLeader;
      return holdsNmt || holdsLeader;
    });
  }

  return {
    userId: me.user_id,
    personId: me.person_id,
    email: me.email,
    isSuperAdmin,
    isNationalLeadership,
    chapters,
    duties,
  };
});

// ---------------------------------------------------------------------------
// Gates. Each returns a structured verdict; pages render <NoAccess/> and
// actions return { success:false, error } on a deny. Never redirect.
// ---------------------------------------------------------------------------

export type Gate<T> = { ok: true; viewer: RxViewer; value: T } | { ok: false; error: string };

const NOT_SIGNED_IN = "You are not signed in, or your account is not in the Yi directory.";

function log(tag: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: `recognitions_${tag}`, ...payload }));
}

export async function requireRxSuperAdmin(): Promise<Gate<null>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  if (!v.isSuperAdmin) {
    log("gate", { gate: "super_admin", verdict: "deny", person: v.personId });
    return { ok: false, error: "Only the Recognitions super admin can do this." };
  }
  return { ok: true, viewer: v, value: null };
}

/** Governance decisions belong to National Leadership only (mail 1, Phase 4). */
export async function requireRxNationalLeadership(): Promise<Gate<null>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  if (!v.isNationalLeadership) {
    log("gate", { gate: "national_leadership", verdict: "deny", person: v.personId });
    return { ok: false, error: "Only National Leadership can approve or send an award back." };
  }
  return { ok: true, viewer: v, value: null };
}

/** Full read access to an award's results: super admin or National Leadership. */
export async function requireRxOversight(): Promise<Gate<null>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  if (!v.isSuperAdmin && !v.isNationalLeadership) {
    return { ok: false, error: "Only National Leadership and the Recognitions super admin can see this." };
  }
  return { ok: true, viewer: v, value: null };
}

export async function requireRxChapter(chapterId: string): Promise<Gate<ChapterRow>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  const chapter = v.chapters.find((c) => c.id === chapterId);
  if (!chapter) {
    log("gate", { gate: "chapter", verdict: "deny", person: v.personId, chapterId });
    return { ok: false, error: "You can only file for a chapter you chair or represent." };
  }
  return { ok: true, viewer: v, value: chapter };
}

/** The duty must belong to the signed-in person. */
export async function requireRxDuty(evaluatorId: string): Promise<Gate<RxDuty>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  const duty = v.duties.find((d) => d.id === evaluatorId);
  if (!duty) {
    log("gate", { gate: "duty", verdict: "deny", person: v.personId, evaluatorId });
    return { ok: false, error: "This scoring sheet is not assigned to you." };
  }
  return { ok: true, viewer: v, value: duty };
}

/** Any NMT duty on the award (leader or not). Used for the Stage 2 views. */
export async function requireRxNmtOnAward(awardId: string): Promise<Gate<RxDuty>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  const duty = v.duties.find((d) => d.award_id === awardId && d.layer === "nmt");
  if (!duty) return { ok: false, error: "Only this award's NMT can open its Stage 2 room." };
  return { ok: true, viewer: v, value: duty };
}

export async function requireRxNmtLeader(awardId: string): Promise<Gate<RxDuty>> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: NOT_SIGNED_IN };
  const duty = v.duties.find(
    (d) => d.award_id === awardId && d.layer === "nmt" && d.is_nmt_leader
  );
  if (!duty) {
    log("gate", { gate: "nmt_leader", verdict: "deny", person: v.personId, awardId });
    return { ok: false, error: "Only this award's NMT leader can moderate it." };
  }
  return { ok: true, viewer: v, value: duty };
}
