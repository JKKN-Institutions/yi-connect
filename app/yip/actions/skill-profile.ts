"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

// ─── Phase 19 / F — Skill profiling on /me ───────────────────────────
//
// Derives a 4-axis skill profile (research / speaking / policy / process)
// from a participant's existing sub-criterion scores. Pure aggregation —
// no new columns, no new tables. Reads `scores.criteria_scores` JSONB.
//
// Mapping (handbook rubric → axis):
//
//   research → content.research, content.relevance, content.originality
//                (Speaker / Deputy: "knowledge" parent — closest fallback)
//   speaking → communication.clarity, communication.confidence,
//              communication.fluency  (S/DS: "communication")
//   policy   → argumentation.strength, argumentation.emotional
//                (S/DS: "leadership" parent — decision-making proxy)
//   process  → conduct.rules, conduct.engagement, conduct.respect,
//              teamwork.coordination, teamwork.listening
//                (S/DS: "impartiality", "time_management", "support",
//                "adaptability" — parliamentary-conduct family)
//
// Normalisation: each criterion's raw score is divided by its declared
// max from the rubric (handbook p.20) to give a 0..1 ratio. The axis
// value is the mean of available ratios across all of this participant's
// submitted scores, then multiplied by 100. Missing keys are simply
// skipped — they do NOT count as zero, because a juror who didn't
// score a sub-criterion is not the same as scoring it zero.

export type SkillAxis = "research" | "speaking" | "policy" | "process";

export interface SkillProfile {
  research: number;
  speaking: number;
  policy: number;
  process: number;
  sample_size: number; // total submitted score rows aggregated
}

// Sub-criterion key → max_score (from lib/yip/constants.ts DEFAULT_RUBRICS).
// Duplicated here to keep this action self-contained and avoid pulling
// rubric structure code into the aggregator. Numbers verified against
// handbook page 20.
const KEY_MAX: Record<string, number> = {
  // MP rubric (nested)
  "content.relevance": 10,
  "content.originality": 10,
  "content.research": 10,
  "communication.clarity": 10,
  "communication.confidence": 10,
  "communication.fluency": 5,
  "conduct.rules": 10,
  "conduct.engagement": 10,
  "conduct.respect": 10,
  "argumentation.strength": 10,
  "argumentation.emotional": 5,
  "teamwork.coordination": 5,
  "teamwork.listening": 5,
  // Speaker rubric (flat) — used as fallback when no sub-criteria exist
  impartiality: 30,
  leadership: 25,
  knowledge: 20,
  communication: 15,
  time_management: 10,
  // Deputy Speaker extras
  support: 30,
  adaptability: 10,
};

// Axis → list of criterion keys. Order doesn't matter; only presence does.
const AXIS_KEYS: Record<SkillAxis, string[]> = {
  research: [
    "content.research",
    "content.relevance",
    "content.originality",
    "knowledge", // Speaker / Deputy Speaker fallback
  ],
  speaking: [
    "communication.clarity",
    "communication.confidence",
    "communication.fluency",
    "communication", // Speaker / Deputy Speaker fallback
  ],
  policy: [
    "argumentation.strength",
    "argumentation.emotional",
    "leadership", // Speaker / Deputy Speaker fallback (decision-making proxy)
  ],
  process: [
    "conduct.rules",
    "conduct.engagement",
    "conduct.respect",
    "teamwork.coordination",
    "teamwork.listening",
    "impartiality", // Speaker / Deputy Speaker fallback
    "time_management",
    "support",
    "adaptability",
  ],
};

interface AxisAccumulator {
  sum: number; // sum of (raw / max) ratios
  count: number; // number of (key, score-row) pairs contributing
}

function emptyAcc(): AxisAccumulator {
  return { sum: 0, count: 0 };
}

function readNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * getSkillProfile — aggregate this participant's submitted scores across
 * all events they appear in (joined by person_id if available, else the
 * single participantId). Returns a 4-axis profile each in 0..100.
 *
 * sample_size is the total count of submitted score rows aggregated. A
 * single juror scoring a participant once contributes one to sample_size.
 * Callers can use sample_size < 3 to label the profile as an early
 * indicator (low confidence).
 */
export async function getSkillProfile(
  participantId: string
): Promise<SkillProfile> {
  const supabase = await createServiceClient();

  // Resolve all participant ids that belong to this person (cross-event
  // journey). If person_id is null (Phase 12 Option B not yet wired for
  // this row), we fall back to just the single participant id.
  const { data: meRow } = await supabase
    .from("participants")
    .select("person_id")
    .eq("id", participantId)
    .maybeSingle();

  let participantIds: string[] = [participantId];

  if (meRow?.person_id) {
    const { data: siblings } = await supabase
      .from("participants")
      .select("id")
      .eq("person_id", meRow.person_id);
    if (siblings && siblings.length > 0) {
      participantIds = siblings.map((s) => s.id);
    }
  }

  // Pull submitted scores for all of this person's participant rows.
  const { data: scores } = await supabase
    .from("scores")
    .select("criteria_scores, status")
    .in("participant_id", participantIds)
    .eq("status", "submitted");

  const acc: Record<SkillAxis, AxisAccumulator> = {
    research: emptyAcc(),
    speaking: emptyAcc(),
    policy: emptyAcc(),
    process: emptyAcc(),
  };

  const rows = scores ?? [];

  for (const row of rows) {
    const cs = row.criteria_scores as Record<string, unknown> | null;
    if (!cs || typeof cs !== "object") continue;

    for (const axis of Object.keys(AXIS_KEYS) as SkillAxis[]) {
      for (const key of AXIS_KEYS[axis]) {
        const raw = readNumber(cs[key]);
        const max = KEY_MAX[key];
        if (raw === null || !max) continue;
        const ratio = Math.max(0, Math.min(1, raw / max));
        acc[axis].sum += ratio;
        acc[axis].count += 1;
      }
    }
  }

  function pct(axis: SkillAxis): number {
    const a = acc[axis];
    if (a.count === 0) return 0;
    return Math.round((a.sum / a.count) * 100);
  }

  return {
    research: pct("research"),
    speaking: pct("speaking"),
    policy: pct("policy"),
    process: pct("process"),
    sample_size: rows.length,
  };
}
