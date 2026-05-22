/**
 * GET /api/finalists/[eventId]/pdf
 *
 * Returns a branded PDF roster of all shortlisted/advanced teams for a
 * National Track Final event. Requires Supabase Auth (host or national admin).
 *
 * Fetches:
 * - event row (name, start_date, venue, chapter → city)
 * - advancements rows where to_event_id = eventId (shortlisted teams)
 * - team → chapter, problem_statement, team_members count, consent_letters
 *
 * Handbook refs: [HPB §4 Day 2, HPB §9 National Deliverables, PRD §9]
 */

import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  FinalistRosterPDF,
  type FinalistTeam,
} from "@/lib/yi-future/finalist-pdf";
import React from "react";

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

type TrackRow = {
  name: string;
};

type EventRow = {
  id: string;
  name: string;
  start_date: string | null;
  venue: string | null;
  track_id: string | null;
  chapters: { name: string; city: string } | null;
  tracks: TrackRow | null;
};

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();

  // 1. Fetch the event
  const { data: eventRaw, error: eventErr } = await svc
    .schema("future")
    .from("events")
    .select("id, name, start_date, venue, track_id, chapters(name, city), tracks(name)")
    .eq("id", eventId)
    .single();

  if (eventErr || !eventRaw) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const event = eventRaw as unknown as EventRow;

  // 2. Fetch advancements pointing to this event → teams → members → consent
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
    return NextResponse.json(
      { error: "Failed to load finalists" },
      { status: 500 }
    );
  }

  const advs = (advsRaw ?? []) as unknown as AdvancementRow[];

  // Fallback: if no advancements, try teams with status = 'shortlisted'
  // linked to this event's edition + track
  let finalRows = advs;
  if (finalRows.length === 0) {
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

    finalRows = fallback.map((t) => ({
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

  // 3. Map to FinalistTeam[]
  const trackName =
    event.tracks?.name ?? "National Track";
  const hostCity = event.chapters?.city ?? "Host City";

  const finalists: FinalistTeam[] = finalRows.map((adv) => {
    const team = adv.teams;
    const members = team?.team_members ?? [];
    const membersCount = members.length;

    // Consent: check all members have an approved consent letter
    const consentStatuses = members.map((m) => {
      const letters = Array.isArray(m.consent_letters)
        ? m.consent_letters
        : m.consent_letters
        ? [m.consent_letters]
        : [];
      const approved = letters.find(
        (cl) => cl.status === "approved"
      );
      return approved ? "approved" : "pending";
    });

    let consentStatus = "pending";
    if (consentStatuses.length > 0 && consentStatuses.every((s) => s === "approved")) {
      consentStatus = "all_approved";
    } else if (consentStatuses.some((s) => s === "approved")) {
      consentStatus = "partial";
    }

    return {
      rank: adv.rank,
      team_name: team?.team_name ?? "Unknown Team",
      chapter_name: team?.chapters?.name ?? "Unknown Chapter",
      problem_title: team?.problem_statements?.title ?? "—",
      track_name: trackName,
      total_score: adv.total_score,
      members_count: membersCount,
      consent_status: consentStatus,
    };
  });

  // 4. Render PDF
  const pdfElement = (
    <FinalistRosterPDF
      event={{
        name: event.name,
        start_date: event.start_date,
        venue: event.venue,
        host_city: hostCity,
      }}
      finalists={finalists}
    />
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(pdfElement as any);

  // Collect stream into buffer
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    (stream as NodeJS.ReadableStream).on("data", (chunk: Buffer) =>
      chunks.push(chunk)
    );
    (stream as NodeJS.ReadableStream).on("end", resolve);
    (stream as NodeJS.ReadableStream).on("error", reject);
  });
  const body = Buffer.concat(chunks);

  const safeEventName = event.name
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finalists-${safeEventName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
