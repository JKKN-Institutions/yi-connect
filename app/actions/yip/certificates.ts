"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

export type CertificateParticipant = {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  parliament_role: string | null;
  party_side: string | null;
  ministry: string | null;
  constituency_name: string | null;
  constituency_state: string | null;
  committee_name: string | null;
  avg_score: number | null;
  rank: number | null;
  award_category: string | null;
};

export type CertificateEventData = {
  id: string;
  name: string;
  level: string;
  chapter_name: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  state: string | null;
  day1_date: string;
  day2_date: string;
  results_published_at: string | null;
};

export type CertificateData = {
  event: CertificateEventData;
  participants: CertificateParticipant[];
};

export async function getCertificateData(
  eventId: string
): Promise<CertificateData | null> {
  const supabase = await createServiceClient();

  // 1. Fetch event details
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, name, level, chapter_name, venue_name, venue_address, city, state, day1_date, day2_date, results_published_at"
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event) return null;

  // 2. Fetch all participants with roles
  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, class, parliament_role, party_side, ministry, constituency_name, constituency_state, committee_name"
    )
    .eq("event_id", eventId)
    .not("parliament_role", "is", null)
    .order("full_name");

  if (pError || !participants) return null;

  // 3. Fetch results if published
  let resultsMap = new Map<
    string,
    { avg_score: number | null; rank: number | null; award_category: string | null }
  >();

  if (event.results_published_at) {
    const { data: results } = await supabase
      .from("results")
      .select("participant_id, avg_score, rank, award_category")
      .eq("event_id", eventId);

    if (results) {
      for (const r of results) {
        resultsMap.set(r.participant_id, {
          avg_score: r.avg_score,
          rank: r.rank,
          award_category: r.award_category,
        });
      }
    }
  }

  // 4. Merge participant data with results
  const merged: CertificateParticipant[] = participants.map((p) => {
    const result = resultsMap.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      school_name: p.school_name,
      class: p.class,
      parliament_role: p.parliament_role,
      party_side: p.party_side,
      ministry: p.ministry,
      constituency_name: p.constituency_name,
      constituency_state: p.constituency_state,
      committee_name: p.committee_name,
      avg_score: result?.avg_score ?? null,
      rank: result?.rank ?? null,
      award_category: result?.award_category ?? null,
    };
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      level: event.level,
      chapter_name: event.chapter_name,
      venue_name: event.venue_name,
      venue_address: event.venue_address,
      city: event.city,
      state: event.state,
      day1_date: event.day1_date,
      day2_date: event.day2_date,
      results_published_at: event.results_published_at,
    },
    participants: merged,
  };
}
