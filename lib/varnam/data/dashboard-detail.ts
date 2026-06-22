/**
 * Committee dashboard DETAIL data — per-management-page reads for the current
 * edition + its chapter. Mirrors lib/varnam/data/dashboard.ts: gated reads via
 * the admin client (the dashboard is role-gated, so it sees non-public rows
 * too). Scoped to the current edition's events / chapter / budget.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEdition } from "./editions";

/** Resolve the current edition's id + chapter_id + budget_id (or nulls). */
async function getEditionContext(): Promise<{
  editionId: string | null;
  chapterId: string | null;
  budgetId: string | null;
}> {
  const sb = createAdminSupabaseClient();
  const edition = await getCurrentEdition();
  if (!edition) return { editionId: null, chapterId: null, budgetId: null };

  const { data: edFull } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id, chapter_id, budget_id")
    .eq("id", edition.id)
    .maybeSingle();
  const row = (edFull ?? null) as {
    chapter_id?: string | null;
    budget_id?: string | null;
  } | null;
  return {
    editionId: edition.id,
    chapterId: row?.chapter_id ?? null,
    budgetId: row?.budget_id ?? null,
  };
}

// ── Events management ──────────────────────────────────────────────────────
export type EventRow = {
  id: string;
  title: string;
  start_date: string | null;
  status: string | null;
  category: string | null;
  venue_address: string | null;
  registrations: number;
};

/** Events of the current edition, each with its guest_rsvps count. */
export async function getEventsManagement(): Promise<EventRow[]> {
  const sb = createAdminSupabaseClient();
  const { editionId } = await getEditionContext();
  if (!editionId) return [];

  const { data: eventsRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title, start_date, status, category, venue_address")
    .eq("festival_edition_id", editionId)
    .order("start_date", { ascending: true });
  const events = (eventsRaw ?? []) as {
    id: string;
    title: string;
    start_date: string | null;
    status: string | null;
    category: string | null;
    venue_address: string | null;
  }[];
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const { data: regsRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("event_id")
    .in("event_id", eventIds);
  const counts = new Map<string, number>();
  for (const r of (regsRaw ?? []) as { event_id: string }[]) {
    counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  }

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start_date: e.start_date,
    status: e.status,
    category: e.category,
    venue_address: e.venue_address,
    registrations: counts.get(e.id) ?? 0,
  }));
}

// ── Registrations ──────────────────────────────────────────────────────────
export type RegistrationRow = {
  name: string;
  email: string | null;
  phone: string | null;
  eventTitle: string;
  created_at: string | null;
};

/** All registrations across the edition's events, newest first. */
export async function getAllRegistrations(): Promise<RegistrationRow[]> {
  const sb = createAdminSupabaseClient();
  const { editionId } = await getEditionContext();
  if (!editionId) return [];

  const { data: eventsRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title")
    .eq("festival_edition_id", editionId);
  const events = (eventsRaw ?? []) as { id: string; title: string }[];
  if (events.length === 0) return [];
  const titleById = new Map(events.map((e) => [e.id, e.title]));
  const eventIds = events.map((e) => e.id);

  const { data: regsRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("full_name, email, phone, event_id, created_at")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false });

  return ((regsRaw ?? []) as {
    full_name: string;
    email: string | null;
    phone: string | null;
    event_id: string;
    created_at: string | null;
  }[]).map((r) => ({
    name: r.full_name,
    email: r.email,
    phone: r.phone,
    eventTitle: titleById.get(r.event_id) ?? "Event",
    created_at: r.created_at,
  }));
}

// ── Sponsors ───────────────────────────────────────────────────────────────
export type SponsorRow = {
  name: string;
  industry: string | null;
  status: string | null;
  priority: string | null;
  currentYearAmount: number | null;
  committed: number;
};

/** Active sponsors for the edition's chapter, with committed totals (FY 2026). */
export async function getSponsorsDetail(): Promise<SponsorRow[]> {
  const sb = createAdminSupabaseClient();
  const { chapterId } = await getEditionContext();
  if (!chapterId) return [];

  const { data: spRaw } = await sb
    .schema("yi_connect")
    .from("sponsors")
    .select(
      "id, organization_name, industry, relationship_status, priority, current_year_amount"
    )
    .eq("chapter_id", chapterId)
    .eq("is_active", true)
    .order("current_year_amount", { ascending: false });
  const sponsors = (spRaw ?? []) as {
    id: string;
    organization_name: string;
    industry: string | null;
    relationship_status: string | null;
    priority: string | null;
    current_year_amount: number | null;
  }[];
  if (sponsors.length === 0) return [];

  // Committed-by-sponsor from sponsorship_deals (fiscal_year 2026).
  const { data: dealsRaw } = await sb
    .schema("yi_connect")
    .from("sponsorship_deals")
    .select("sponsor_id, committed_amount")
    .eq("chapter_id", chapterId)
    .eq("fiscal_year", 2026);
  const committedBySponsor = new Map<string, number>();
  for (const d of (dealsRaw ?? []) as {
    sponsor_id: string | null;
    committed_amount: number | null;
  }[]) {
    if (!d.sponsor_id) continue;
    committedBySponsor.set(
      d.sponsor_id,
      (committedBySponsor.get(d.sponsor_id) ?? 0) +
        (Number(d.committed_amount) || 0)
    );
  }

  return sponsors.map((s) => ({
    name: s.organization_name,
    industry: s.industry,
    status: s.relationship_status,
    priority: s.priority,
    currentYearAmount: s.current_year_amount,
    committed: committedBySponsor.get(s.id) ?? 0,
  }));
}

// ── Budget ─────────────────────────────────────────────────────────────────
export type BudgetAllocationRow = {
  vertical: string;
  allocated: number;
  spent: number;
  remaining: number;
};

export type BudgetDetail = {
  total: number;
  allocated: number;
  spent: number;
  allocations: BudgetAllocationRow[];
};

/** Budget totals + allocations for the edition's budget (or null). */
export async function getBudgetDetail(): Promise<BudgetDetail | null> {
  const sb = createAdminSupabaseClient();
  const { budgetId } = await getEditionContext();
  if (!budgetId) return null;

  const { data: bRaw } = await sb
    .schema("yi_connect")
    .from("budgets")
    .select("total_amount, allocated_amount, spent_amount")
    .eq("id", budgetId)
    .maybeSingle();
  if (!bRaw) return null;
  const b = bRaw as {
    total_amount: number | null;
    allocated_amount: number | null;
    spent_amount: number | null;
  };

  const { data: allocsRaw } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .select("vertical_name, allocated_amount, spent_amount")
    .eq("budget_id", budgetId);

  const allocations = ((allocsRaw ?? []) as {
    vertical_name: string;
    allocated_amount: number | null;
    spent_amount: number | null;
  }[])
    .map((a) => {
      const allocated = Number(a.allocated_amount) || 0;
      const spent = Number(a.spent_amount) || 0;
      return {
        vertical: a.vertical_name,
        allocated,
        spent,
        remaining: allocated - spent,
      };
    })
    .sort((x, y) => y.allocated - x.allocated);

  return {
    total: Number(b.total_amount) || 0,
    allocated: Number(b.allocated_amount) || 0,
    spent: Number(b.spent_amount) || 0,
    allocations,
  };
}
