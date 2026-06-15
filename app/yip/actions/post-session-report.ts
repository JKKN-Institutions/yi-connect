"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

// Handbook p.46: "Reporting completed as per national format (Mandatory)."
// This action pulls a complete snapshot of the event into a single row-per-metric CSV
// that the National team ingests. It's a server action that returns the CSV string;
// the client triggers a download.

export type PostSessionReport = {
  csv: string;
  filename: string;
  summary: {
    event_name: string;
    chapter_name: string | null;
    zone: string | null;
    day1_date: string;
    day2_date: string;
    participants_total: number;
    participants_scored: number;
    jury_count: number;
    motions_raised: number;
    bills_passed: number;
    fees_paid: number;
    fees_collected_inr: number;
    volunteers_total: number;
    volunteers_yuva: number;
    awards_assigned: number;
    top10_promoted: number;
  };
};

export async function generatePostSessionReport(
  eventId: string
): Promise<{ success: true; data: PostSessionReport } | { success: false; error: string }> {
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, chapter_name, city, state, zone, level, status, day1_date, day2_date, central_agenda, mycii_event_registered, fee_per_participant_inr, results_published_at, allocation_locked, scores_locked, social_links, social_reach_count"
    )
    .eq("id", eventId)
    .single();

  if (!event) return { success: false, error: "Event not found" };

  const [
    participantsRes,
    resultsRes,
    juryRes,
    motionsRes,
    billsRes,
    feesRes,
    volunteersRes,
    checklistRes,
    questionsRes,
    promotionsOutRes,
    chiefGuestsRes,
  ] = await Promise.all([
    supabase.from("participants").select("id, full_name, school_name, parliament_role, party_side").eq("event_id", eventId),
    supabase.from("results").select("participant_id, avg_score, jury_count, rank, award_category").eq("event_id", eventId).order("rank"),
    supabase.from("jury_assignments").select("id, jury_name, is_active").eq("event_id", eventId),
    supabase.from("motions").select("motion_type, status, outcome").eq("event_id", eventId),
    supabase.from("bills").select("title, party_side, status, votes_for, votes_against").eq("event_id", eventId),
    supabase.from("fees").select("amount_inr, is_paid").eq("event_id", eventId),
    supabase.from("volunteers").select("station, is_yuva, arrived").eq("event_id", eventId),
    supabase.from("checklist").select("category, is_completed").eq("event_id", eventId),
    supabase.from("questions").select("id, status").eq("event_id", eventId),
    supabase.from("promotions").select("id, target_event_id").eq("source_event_id", eventId),
    supabase.from("event_chief_guests").select("name, designation, organization, display_order").eq("event_id", eventId).order("display_order"),
  ]);

  const participants = participantsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const juries = (juryRes.data ?? []).filter((j) => j.is_active);
  const motions = motionsRes.data ?? [];
  const bills = billsRes.data ?? [];
  const fees = feesRes.data ?? [];
  const volunteers = volunteersRes.data ?? [];
  const checklist = checklistRes.data ?? [];
  const questions = questionsRes.data ?? [];
  const promotions = promotionsOutRes.data ?? [];
  const chiefGuests = chiefGuestsRes.data ?? [];
  const socialLinks = event.social_links ?? [];

  // Awards rollup from award_category strings (comma-separated)
  const awardCounts = new Map<string, string[]>();
  for (const r of results) {
    if (!r.award_category) continue;
    const names = r.award_category.split(",").map((a) => a.trim()).filter(Boolean);
    const participant = participants.find((p) => p.id === r.participant_id);
    if (!participant) continue;
    for (const award of names) {
      const arr = awardCounts.get(award) ?? [];
      arr.push(participant.full_name);
      awardCounts.set(award, arr);
    }
  }

  const feesPaid = fees.filter((f) => f.is_paid).length;
  const feesCollected = fees.filter((f) => f.is_paid).reduce((s, f) => s + (f.amount_inr ?? 0), 0);

  const summary: PostSessionReport["summary"] = {
    event_name: event.name,
    chapter_name: event.chapter_name,
    zone: event.zone,
    day1_date: event.day1_date,
    day2_date: event.day2_date,
    participants_total: participants.length,
    participants_scored: new Set(results.map((r) => r.participant_id)).size,
    jury_count: juries.length,
    motions_raised: motions.length,
    bills_passed: bills.filter((b) => b.status === "passed").length,
    fees_paid: feesPaid,
    fees_collected_inr: feesCollected,
    volunteers_total: volunteers.length,
    volunteers_yuva: volunteers.filter((v) => v.is_yuva).length,
    awards_assigned: awardCounts.size,
    top10_promoted: promotions.length,
  };

  // Build CSV — "Section,Key,Value" flat so National can pivot
  const rows: Array<[string, string, string | number]> = [];
  const push = (section: string, key: string, value: string | number | null | undefined) => {
    rows.push([section, key, value ?? ""]);
  };

  push("EVENT", "Name", event.name);
  push("EVENT", "Level", event.level);
  push("EVENT", "Chapter", event.chapter_name);
  push("EVENT", "City", event.city);
  push("EVENT", "State", event.state);
  push("EVENT", "Zone", event.zone);
  push("EVENT", "Status", event.status);
  push("EVENT", "Day 1 Date", event.day1_date);
  push("EVENT", "Day 2 Date", event.day2_date);
  push("EVENT", "Central Agenda", event.central_agenda);
  push("EVENT", "Results Published", event.results_published_at ?? "NO");
  push("EVENT", "Allocation Locked", event.allocation_locked ? "YES" : "NO");
  push("EVENT", "Scores Locked", event.scores_locked ? "YES" : "NO");

  // Chief guests (#11) + social coverage (#12)
  push("CHIEF GUESTS", "Count", chiefGuests.length);
  chiefGuests.forEach((g, i) => {
    push(
      "CHIEF GUESTS",
      `Guest ${i + 1}`,
      [g.name, g.designation, g.organization].filter(Boolean).join(" | ")
    );
  });

  push("SOCIAL", "Total Reach", event.social_reach_count ?? "");
  push("SOCIAL", "Post Links (count)", socialLinks.length);
  socialLinks.forEach((link, i) => push("SOCIAL", `Post ${i + 1}`, link));

  push("PARTICIPATION", "Total Participants", participants.length);
  push("PARTICIPATION", "Participants Scored", summary.participants_scored);
  push("PARTICIPATION", "Jury Members (active)", juries.length);
  push("PARTICIPATION", "Schools Represented", new Set(participants.map((p) => p.school_name)).size);

  push("FINANCE", "Fee per Participant (INR)", event.fee_per_participant_inr ?? 399);
  push("FINANCE", "Registered on MyCII", event.mycii_event_registered ? "YES" : "NO");
  push("FINANCE", "Fees Paid (count)", feesPaid);
  push("FINANCE", "Fees Outstanding (count)", participants.length - feesPaid);
  push("FINANCE", "Total Collected (INR)", feesCollected);
  push("FINANCE", "Expected (INR)", participants.length * (event.fee_per_participant_inr ?? 399));

  push("VOLUNTEERS", "Total Volunteers", volunteers.length);
  push("VOLUNTEERS", "YUVA Volunteers", summary.volunteers_yuva);
  push("VOLUNTEERS", "Arrived on Event Day", volunteers.filter((v) => v.arrived).length);
  for (const station of new Set(volunteers.map((v) => v.station))) {
    const count = volunteers.filter((v) => v.station === station).length;
    push("VOLUNTEERS", `Station: ${station}`, count);
  }

  push("PROCEEDINGS", "Motions Raised", motions.length);
  for (const mtype of new Set(motions.map((m) => m.motion_type))) {
    push("PROCEEDINGS", `Motion: ${mtype}`, motions.filter((m) => m.motion_type === mtype).length);
  }
  push("PROCEEDINGS", "Motions Passed", motions.filter((m) => m.outcome === "passed").length);
  push("PROCEEDINGS", "Motions Rejected", motions.filter((m) => m.outcome === "rejected").length);
  push("PROCEEDINGS", "Questions Submitted", questions.length);
  push("PROCEEDINGS", "Questions Answered", questions.filter((q) => q.status === "answered").length);
  push("PROCEEDINGS", "Bills Drafted", bills.length);
  push("PROCEEDINGS", "Bills Passed", bills.filter((b) => b.status === "passed").length);

  push("CHECKLIST", "Total Items", checklist.length);
  push("CHECKLIST", "Items Completed", checklist.filter((c) => c.is_completed).length);
  for (const cat of new Set(checklist.map((c) => c.category).filter(Boolean))) {
    const itemsInCat = checklist.filter((c) => c.category === cat);
    push(
      "CHECKLIST",
      `${cat} (completed/total)`,
      `${itemsInCat.filter((i) => i.is_completed).length}/${itemsInCat.length}`
    );
  }

  push("PROGRESSION", "Participants Promoted Out", promotions.length);

  push("AWARDS", "Total Award Categories Assigned", awardCounts.size);
  for (const [award, recipients] of awardCounts.entries()) {
    push("AWARDS", award, recipients.join(" | "));
  }

  // Top-10 leaderboard
  const top10 = results.slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const p = participants.find((x) => x.id === top10[i].participant_id);
    push(
      "TOP 10",
      `Rank ${top10[i].rank ?? i + 1}`,
      `${p?.full_name ?? "?"} | ${p?.school_name ?? ""} | score ${top10[i].avg_score ?? "-"} | ${p?.parliament_role ?? ""} ${p?.party_side ?? ""}`
    );
  }

  const headers = "Section,Key,Value\n";
  const body = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const csv = headers + body;
  const safeName = (event.chapter_name ?? event.name).replace(/[^a-z0-9]/gi, "_");
  const filename = `YIP2026_${safeName}_NationalReport_${event.day1_date}.csv`;

  return { success: true, data: { csv, filename, summary } };
}
