import "server-only";

/**
 * YIP Chapter Round Report — data helper for Section 5/6 (Awards & Zero Hour).
 *
 * Mirrors lib/yip/report/sections/overview.ts EXACTLY:
 *   1. `import "server-only"` — a data module (NOT "use server"); may export
 *      types + an async getter.
 *   2. gate with getYipEventAccess(eventId); if !canView return null so the
 *      section renders nothing.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip").
 *
 * Section 5/6 assembles:
 *   - Awards & Recognitions: the awardees rollup from yip.results. award_category
 *     is a COMMA-separated string of award labels per participant; rows whose
 *     award_category is null OR startsWith("Not ranked") are skipped (Director
 *     ruling 2026-06-25 — "Not ranked" lives in award_category but is a STATUS,
 *     not an award). Names come from participant_id → participants.full_name.
 *     We read the STORED results rows (NOT computeResults — no heavy recompute
 *     for a report; avg_score is the stored jury floor, which is correct here).
 *   - Zero Hour: the saved events.zero_hour_summary (a NEW additive column this
 *     section owns). When empty + canManage, the section offers an auto-draft
 *     assembled from questions (question_text / answer_summary) + motions
 *     (subject / outcome) to pre-fill the capture textarea.
 *
 * NOTE on typing: events.zero_hour_summary is added by this section's migration
 * but the generated types/yip/database.ts is NOT regenerated in this change, so
 * that one column is read through a loose-cast client (same `as never` / loose
 * shape used by app/yip/actions/admin-team.ts) to avoid a typed-column error.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

/** One award row: the award label + every winner's name under it. */
export type AwardRollup = {
  award: string;
  winners: string[];
};

/** A Zero Hour source line used to build the auto-draft (questions + motions). */
export type ZeroHourSource =
  | {
      kind: "question";
      text: string;
      detail: string | null;
    }
  | {
      kind: "motion";
      text: string;
      detail: string | null;
    };

export type AwardsZeroHourData = {
  awards: AwardRollup[];
  /** Number of distinct ranked participants who earned at least one award. */
  awardeeCount: number;
  /** The saved Zero Hour summary text, or null when not yet recorded. */
  zeroHourSummary: string | null;
  /**
   * Pre-assembled auto-draft for the Zero Hour summary (questions + motions),
   * shown in the capture textarea when zeroHourSummary is empty. Never written
   * automatically — the organiser edits + saves it explicitly.
   */
  zeroHourDraft: string;
  /** Whether any question/motion source rows exist (drives the draft hint). */
  hasZeroHourSources: boolean;
};

/** Title-case a slug, e.g. "no_confidence" → "No Confidence". */
function pretty(s: string | null | undefined): string {
  return (s ?? "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Fetch everything Section 5/6 renders. Returns `null` when the caller lacks
 * view access (the section component then renders nothing).
 */
export async function getAwardsZeroHourData(
  eventId: string
): Promise<AwardsZeroHourData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // ── Awards rollup (yip.results) ─────────────────────────────────────
  const [resultsRes, participantsRes, questionsRes, motionsRes] =
    await Promise.all([
      svc
        .from("results")
        .select("participant_id, avg_score, rank, award_category")
        .eq("event_id", eventId)
        .order("rank"),
      svc
        .from("participants")
        .select("id, full_name")
        .eq("event_id", eventId),
      svc
        .from("questions")
        .select("question_text, answer_summary, directed_to_ministry, status, queue_order")
        .eq("event_id", eventId)
        .order("queue_order", { nullsFirst: false }),
      svc
        .from("motions")
        .select("subject, details, outcome, status, motion_type, raised_by_name")
        .eq("event_id", eventId),
    ]);

  const results = resultsRes.data ?? [];
  const participants = participantsRes.data ?? [];
  const nameById = new Map<string, string>();
  for (const p of participants) {
    if (p.id) nameById.set(String(p.id), String(p.full_name ?? ""));
  }

  // Group winners per award label. Preserve first-seen award order (results are
  // ordered by rank, so higher-ranked awards/winners surface first).
  const awardOrder: string[] = [];
  const winnersByAward = new Map<string, string[]>();
  const awardeeIds = new Set<string>();

  for (const r of results) {
    const cat = r.award_category;
    if (!cat || cat.startsWith("Not ranked")) continue;
    const pid = r.participant_id ? String(r.participant_id) : null;
    const name = pid ? nameById.get(pid) : null;
    if (!pid || !name) continue;

    const labels = cat
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (labels.length === 0) continue;

    awardeeIds.add(pid);
    for (const label of labels) {
      if (!winnersByAward.has(label)) {
        winnersByAward.set(label, []);
        awardOrder.push(label);
      }
      const arr = winnersByAward.get(label)!;
      if (!arr.includes(name)) arr.push(name);
    }
  }

  const awards: AwardRollup[] = awardOrder.map((award) => ({
    award,
    winners: winnersByAward.get(award) ?? [],
  }));

  // ── Zero Hour: saved summary (loose-cast for the not-yet-typed column) ──
  let zeroHourSummary: string | null = null;
  {
    const svcLoose = svc as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: unknown
          ) => {
            maybeSingle: () => Promise<{
              data: Record<string, unknown> | null;
            }>;
          };
        };
      };
    };
    const { data } = await svcLoose
      .from("events")
      .select("zero_hour_summary")
      .eq("id", eventId)
      .maybeSingle();
    const raw = data?.zero_hour_summary;
    zeroHourSummary =
      typeof raw === "string" && raw.trim().length > 0 ? raw : null;
  }

  // ── Zero Hour auto-draft (questions + motions) ──────────────────────
  const questions = questionsRes.data ?? [];
  const motions = motionsRes.data ?? [];

  const draftLines: string[] = [];

  if (questions.length > 0) {
    draftLines.push("Questions raised during Zero Hour:");
    for (const q of questions) {
      const qText = String(q.question_text ?? "").trim();
      if (!qText) continue;
      const ministry = q.directed_to_ministry
        ? ` (to the ${pretty(String(q.directed_to_ministry))} Ministry)`
        : "";
      const ans = String(q.answer_summary ?? "").trim();
      const answer = ans ? ` — Response: ${ans}` : "";
      draftLines.push(`• ${qText}${ministry}${answer}`);
    }
  }

  if (motions.length > 0) {
    if (draftLines.length > 0) draftLines.push("");
    draftLines.push("Motions moved:");
    for (const m of motions) {
      const subj = String(m.subject ?? "").trim();
      if (!subj) continue;
      const by = m.raised_by_name
        ? ` (moved by ${String(m.raised_by_name)})`
        : "";
      const outcome = m.outcome
        ? ` — ${pretty(String(m.outcome))}`
        : m.status
          ? ` — ${pretty(String(m.status))}`
          : "";
      draftLines.push(`• ${subj}${by}${outcome}`);
    }
  }

  const hasZeroHourSources = questions.length > 0 || motions.length > 0;
  const zeroHourDraft = draftLines.join("\n").trim();

  return {
    awards,
    awardeeCount: awardeeIds.size,
    zeroHourSummary,
    zeroHourDraft,
    hasZeroHourSources,
  };
}
