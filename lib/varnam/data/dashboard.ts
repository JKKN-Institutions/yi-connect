/**
 * Committee dashboard data — aggregates the current edition's events,
 * registrations, sponsor pipeline and budget. Reads via the admin client
 * (the dashboard is role-gated, so it sees non-public rows too). Scoped to the
 * current edition + its chapter.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEdition, type Edition } from "./editions";

export type DashboardData = {
  edition: Edition | null;
  eventsCount: number;
  registrationsTotal: number;
  registrationsByEvent: { title: string; count: number }[];
  recentRegistrations: { name: string; event: string; at: string | null }[];
  sponsors: {
    name: string;
    status: string | null;
    amount: number | null;
    priority: string | null;
  }[];
  committedTotal: number;
  budget: {
    total: number;
    spent: number;
    allocations: { vertical: string; allocated: number; spent: number }[];
  } | null;
};

const EMPTY: DashboardData = {
  edition: null,
  eventsCount: 0,
  registrationsTotal: 0,
  registrationsByEvent: [],
  recentRegistrations: [],
  sponsors: [],
  committedTotal: 0,
  budget: null,
};

export async function getDashboardData(): Promise<DashboardData> {
  const sb = createAdminSupabaseClient();
  const edition = await getCurrentEdition();
  if (!edition) return EMPTY;

  const { data: edFull } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id, chapter_id, budget_id")
    .eq("id", edition.id)
    .maybeSingle();
  const chapterId = (edFull as { chapter_id?: string } | null)?.chapter_id;
  const budgetId = (edFull as { budget_id?: string } | null)?.budget_id;

  // Events for the edition.
  const { data: eventsRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title")
    .eq("festival_edition_id", edition.id);
  const events = (eventsRaw ?? []) as { id: string; title: string }[];
  const titleById = new Map(events.map((e) => [e.id, e.title]));
  const eventIds = events.map((e) => e.id);

  // Registrations across those events.
  let regs: { full_name: string; event_id: string; created_at: string | null }[] =
    [];
  if (eventIds.length) {
    const { data } = await sb
      .schema("yi_connect")
      .from("guest_rsvps")
      .select("full_name, event_id, created_at")
      .in("event_id", eventIds)
      .order("created_at", { ascending: false });
    regs = (data ?? []) as typeof regs;
  }
  const counts = new Map<string, number>();
  for (const r of regs) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  const registrationsByEvent = [...counts.entries()]
    .map(([id, count]) => ({ title: titleById.get(id) ?? "Event", count }))
    .sort((a, b) => b.count - a.count);
  const recentRegistrations = regs.slice(0, 6).map((r) => ({
    name: r.full_name,
    event: titleById.get(r.event_id) ?? "Event",
    at: r.created_at,
  }));

  // Sponsors + committed total.
  let sponsors: DashboardData["sponsors"] = [];
  let committedTotal = 0;
  if (chapterId) {
    const { data: sp } = await sb
      .schema("yi_connect")
      .from("sponsors")
      .select("organization_name, relationship_status, current_year_amount, priority")
      .eq("chapter_id", chapterId)
      .eq("is_active", true);
    sponsors = ((sp ?? []) as {
      organization_name: string;
      relationship_status: string | null;
      current_year_amount: number | null;
      priority: string | null;
    }[]).map((s) => ({
      name: s.organization_name,
      status: s.relationship_status,
      amount: s.current_year_amount,
      priority: s.priority,
    }));
    const { data: deals } = await sb
      .schema("yi_connect")
      .from("sponsorship_deals")
      .select("committed_amount")
      .eq("chapter_id", chapterId)
      .eq("fiscal_year", 2026);
    committedTotal = ((deals ?? []) as { committed_amount: number | null }[]).reduce(
      (sum, d) => sum + (Number(d.committed_amount) || 0),
      0
    );
  }

  // Budget + allocations.
  let budget: DashboardData["budget"] = null;
  if (budgetId) {
    const { data: b } = await sb
      .schema("yi_connect")
      .from("budgets")
      .select("total_amount, spent_amount")
      .eq("id", budgetId)
      .maybeSingle();
    const { data: allocs } = await sb
      .schema("yi_connect")
      .from("budget_allocations")
      .select("vertical_name, allocated_amount, spent_amount")
      .eq("budget_id", budgetId);
    if (b) {
      const row = b as { total_amount: number | null; spent_amount: number | null };
      budget = {
        total: Number(row.total_amount) || 0,
        spent: Number(row.spent_amount) || 0,
        allocations: ((allocs ?? []) as {
          vertical_name: string;
          allocated_amount: number | null;
          spent_amount: number | null;
        }[])
          .map((a) => ({
            vertical: a.vertical_name,
            allocated: Number(a.allocated_amount) || 0,
            spent: Number(a.spent_amount) || 0,
          }))
          .sort((x, y) => y.allocated - x.allocated),
      };
    }
  }

  return {
    edition,
    eventsCount: events.length,
    registrationsTotal: regs.length,
    registrationsByEvent,
    recentRegistrations,
    sponsors,
    committedTotal,
    budget,
  };
}
