/**
 * GET /api/finalists/[eventId]/csv
 *
 * Returns a CSV export of all shortlisted/advanced teams for a National Track
 * Final event. Requires Supabase Auth (host or national admin).
 *
 * Columns: rank, team_name, chapter, problem, score, members_count,
 *          consent_status
 *
 * Handbook refs: [HPB §9 National Deliverables, PRD §9]
 */

import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { toCSV, csvResponse } from "@/lib/yi-future/csv";

export const runtime = "nodejs";

type ConsentRow = {
  delegate_id: string;
  status: string | null;
};

type MemberRow = {
  delegate_id: string;
  consent_letters: ConsentRow[] | null;
};

type AdvancementRow = {
  team_id: string;
  rank: number | null;
  total_score: number | null;
  teams: {
    team_name: string;
    chapters: { name: string; city: string } | null;
    problem_statements: { title: string } | null;
    team_members: MemberRow[];
  } | null;
};

type EventRow = {
  id: string;
  name: string;
  tracks: { name: string } | null;
};

interface FinalistCSVRow extends Record<string, unknown> {
  rank: string;
  team_name: string;
  chapter: string;
  problem: string;
  score: string;
  members_count: string;
  consent_status: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Require Supabase Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const svc = await createServiceClient();

  // 1. Fetch event name for the filename
  const { data: eventRaw, error: eventErr } = await svc
    .schema("future")
    .from("events")
    .select("id, name, tracks(name)")
    .eq("id", eventId)
    .single();

  if (eventErr || !eventRaw) {
    return new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = eventRaw as unknown as EventRow;

  // 2. Fetch advancements → teams → members → consent
  const { data: advsRaw, error: advsErr } = await svc
    .schema("future")
    .from("advancements")
    .select(
      `team_id, rank, total_score,
       teams(
         team_name,
         chapters(name, city),
         problem_statements(title),
         team_members(
           delegate_id,
           consent_letters(delegate_id, status)
         )
       )`
    )
    .eq("to_event_id", eventId)
    .order("rank", { ascending: true });

  if (advsErr) {
    return new Response(JSON.stringify({ error: "Failed to load finalists" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let advs = (advsRaw ?? []) as unknown as AdvancementRow[];

  // Fallback: teams with status='shortlisted'
  if (advs.length === 0) {
    const { data: teamsRaw } = await svc
      .schema("future")
      .from("teams")
      .select(
        `id, team_name,
         chapters(name, city),
         problem_statements(title),
         team_members(
           delegate_id,
           consent_letters(delegate_id, status)
         )`
      )
      .eq("status", "shortlisted");

    const fallback = (teamsRaw ?? []) as unknown as {
      id: string;
      team_name: string;
      chapters: { name: string; city: string } | null;
      problem_statements: { title: string } | null;
      team_members: MemberRow[];
    }[];

    advs = fallback.map((t) => ({
      team_id: t.id,
      rank: null,
      total_score: null,
      teams: {
        team_name: t.team_name,
        chapters: t.chapters,
        problem_statements: t.problem_statements,
        team_members: t.team_members,
      },
    }));
  }

  // 3. Build CSV rows
  const rows: FinalistCSVRow[] = advs.map((adv) => {
    const team = adv.teams;
    const members = team?.team_members ?? [];

    const consentStatuses = members.map((m) => {
      const letters = Array.isArray(m.consent_letters)
        ? m.consent_letters
        : m.consent_letters
        ? [m.consent_letters]
        : [];
      return letters.find((cl) => cl.status === "approved")
        ? "approved"
        : "pending";
    });

    let consentStatus = "pending";
    if (
      consentStatuses.length > 0 &&
      consentStatuses.every((s) => s === "approved")
    ) {
      consentStatus = "all_approved";
    } else if (consentStatuses.some((s) => s === "approved")) {
      consentStatus = "partial";
    }

    return {
      rank: adv.rank != null ? String(adv.rank) : "",
      team_name: team?.team_name ?? "",
      chapter: team?.chapters?.name ?? "",
      problem: team?.problem_statements?.title ?? "",
      score:
        adv.total_score != null ? adv.total_score.toFixed(1) : "",
      members_count: String(members.length),
      consent_status: consentStatus,
    };
  });

  const columns: { key: string; label: string }[] = [
    { key: "rank", label: "Rank" },
    { key: "team_name", label: "Team Name" },
    { key: "chapter", label: "Chapter" },
    { key: "problem", label: "Problem Statement" },
    { key: "score", label: "Total Score" },
    { key: "members_count", label: "Members" },
    { key: "consent_status", label: "Consent Status" },
  ];

  const csv = toCSV(rows, columns);
  const safeEventName = event.name
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);

  return csvResponse(`finalists-${safeEventName}.csv`, csv);
}
