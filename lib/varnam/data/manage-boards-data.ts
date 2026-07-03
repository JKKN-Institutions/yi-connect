/**
 * Board data for the writable Sponsors + Budget dashboard pages. Mirrors
 * lib/varnam/data/dashboard-detail.ts but returns row ids + editable fields so
 * the boards can render per-row edit affordances. Gated reads via the admin
 * client (the dashboard is role-gated upstream).
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEdition } from "./editions";

/** Resolve the current edition's chapter_id + budget_id (or nulls). */
async function getEditionContext(): Promise<{
  editionId: string | null;
  chapterId: string | null;
  budgetId: string | null;
}> {
  const sb = createAdminSupabaseClient();
  const edition = await getCurrentEdition();
  if (!edition) return { editionId: null, chapterId: null, budgetId: null };

  const { data } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id, chapter_id, budget_id")
    .eq("id", edition.id)
    .maybeSingle();
  const row = (data ?? null) as {
    chapter_id?: string | null;
    budget_id?: string | null;
  } | null;
  return {
    editionId: edition.id,
    chapterId: row?.chapter_id ?? null,
    budgetId: row?.budget_id ?? null,
  };
}

// ── Sponsors board ─────────────────────────────────────────────────────────
export type SponsorBoardRow = {
  id: string;
  organizationName: string;
  industry: string | null;
  relationshipStatus: string | null;
  priority: string | null;
  currentYearAmount: number | null;
  contactPersonName: string | null;
  contactPhone: string | null;
  notes: string | null;
  committed: number;
};

/** Active sponsors for the edition's chapter with ids + editable fields. */
export async function getSponsorsBoard(): Promise<SponsorBoardRow[]> {
  const sb = createAdminSupabaseClient();
  const { chapterId } = await getEditionContext();
  if (!chapterId) return [];

  const { data: spRaw } = await sb
    .schema("yi_connect")
    .from("sponsors")
    .select(
      "id, organization_name, industry, relationship_status, priority, current_year_amount, contact_person_name, contact_phone, notes"
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
    contact_person_name: string | null;
    contact_phone: string | null;
    notes: string | null;
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
    id: s.id,
    organizationName: s.organization_name,
    industry: s.industry,
    relationshipStatus: s.relationship_status,
    priority: s.priority,
    currentYearAmount:
      s.current_year_amount == null ? null : Number(s.current_year_amount),
    contactPersonName: s.contact_person_name,
    contactPhone: s.contact_phone,
    notes: s.notes,
    committed: committedBySponsor.get(s.id) ?? 0,
  }));
}

// ── Budget board ───────────────────────────────────────────────────────────
export type BudgetBoardAllocation = {
  id: string;
  vertical: string;
  allocated: number;
  spent: number;
  remaining: number;
};

export type BudgetBoard = {
  id: string;
  name: string;
  total: number;
  allocated: number;
  spent: number;
  allocations: BudgetBoardAllocation[];
};

/** The edition's budget with allocation ids (or null when none is linked). */
export async function getBudgetBoard(): Promise<BudgetBoard | null> {
  const sb = createAdminSupabaseClient();
  const { budgetId } = await getEditionContext();
  if (!budgetId) return null;

  const { data: bRaw } = await sb
    .schema("yi_connect")
    .from("budgets")
    .select("id, name, total_amount, allocated_amount, spent_amount")
    .eq("id", budgetId)
    .maybeSingle();
  if (!bRaw) return null;
  const b = bRaw as {
    id: string;
    name: string;
    total_amount: number | null;
    allocated_amount: number | null;
    spent_amount: number | null;
  };

  const { data: allocsRaw } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .select("id, vertical_name, allocated_amount, spent_amount")
    .eq("budget_id", budgetId);

  const allocations = ((allocsRaw ?? []) as {
    id: string;
    vertical_name: string;
    allocated_amount: number | null;
    spent_amount: number | null;
  }[])
    .map((a) => {
      const allocated = Number(a.allocated_amount) || 0;
      const spent = Number(a.spent_amount) || 0;
      return {
        id: a.id,
        vertical: a.vertical_name,
        allocated,
        spent,
        remaining: allocated - spent,
      };
    })
    .sort((x, y) => y.allocated - x.allocated);

  return {
    id: b.id,
    name: b.name,
    total: Number(b.total_amount) || 0,
    allocated: Number(b.allocated_amount) || 0,
    spent: Number(b.spent_amount) || 0,
    allocations,
  };
}
