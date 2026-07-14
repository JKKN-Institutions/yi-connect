"use server";

/**
 * Budget board actions — create the edition budget, add vertical allocations
 * and record spend. Every action RE-CHECKS authorization server-side; writes
 * go through the admin client (RLS bypass), so the access check here IS the
 * permission layer.
 *
 * DB constraints honoured up-front (friendly errors instead of DB rejections):
 * - budgets.total_amount > 0
 * - budgets.allocated_amount ≤ total_amount AND spent_amount ≤ total_amount
 * - budget_allocations.allocated_amount > 0
 * After any allocation change the parent budget is recomputed:
 * allocated_amount = SUM(allocations.allocated_amount), same for spent.
 */
import { revalidatePath } from "next/cache";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import type { BoardActionState } from "./manage-sponsors";

const ERODE_CHAPTER_ID = "fe71c429-2647-4262-b35b-e356c960903d";
const FESTIVAL_KEY = "varnam-vizha";

type ManagerCheck =
  | { allowed: true; userId: string }
  | { allowed: false; message: string };

/** Server-side gate: varnam canManage + a live auth session. */
async function requireManager(): Promise<ManagerCheck> {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      allowed: false,
      message: "You don't have permission to manage the budget.",
    };
  }
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return {
      allowed: false,
      message: "Your session has expired — please sign in again.",
    };
  }
  return { allowed: true, userId: user.id };
}

function revalidateBudgetRoutes() {
  revalidatePath("/varnam-vizha/dashboard/budget");
  revalidatePath("/varnam-vizha/dashboard");
}

type AllocationSums = { allocated: number; spent: number };

/** Sum all allocations of a budget (source of truth for the parent totals). */
async function sumAllocations(
  sb: ReturnType<typeof createAdminSupabaseClient>,
  budgetId: string
): Promise<AllocationSums> {
  const { data } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .select("allocated_amount, spent_amount")
    .eq("budget_id", budgetId);
  let allocated = 0;
  let spent = 0;
  for (const a of (data ?? []) as {
    allocated_amount: number | null;
    spent_amount: number | null;
  }[]) {
    allocated += Number(a.allocated_amount) || 0;
    spent += Number(a.spent_amount) || 0;
  }
  return { allocated, spent };
}

/** Recompute + persist the parent budget's allocated/spent totals. */
async function recomputeBudget(
  sb: ReturnType<typeof createAdminSupabaseClient>,
  budgetId: string
): Promise<BoardActionState> {
  const sums = await sumAllocations(sb, budgetId);
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("budgets")
    .update({
      allocated_amount: sums.allocated,
      spent_amount: sums.spent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", budgetId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message:
        "Saved the line, but couldn't refresh the budget totals — reload and check the numbers.",
    };
  }
  return { ok: true, message: "" };
}

export async function createBudget(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const name =
    String(formData.get("name") ?? "").trim() || "Varnam Vizha 2026 Budget";
  const totalRaw = String(formData.get("total_amount") ?? "").trim();
  const totalAmount = Number(totalRaw);
  if (!totalRaw || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return {
      ok: false,
      message: "Please enter a total budget amount greater than 0.",
    };
  }
  if (name.length > 255) {
    return { ok: false, message: "Budget name is too long (max 255 characters)." };
  }

  const sb = createAdminSupabaseClient();

  // The budget hangs off the live edition — refuse to create a duplicate.
  const { data: editionRaw } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id, budget_id")
    .eq("festival_key", FESTIVAL_KEY)
    .eq("status", "live")
    .maybeSingle();
  const edition = (editionRaw ?? null) as {
    id: string;
    budget_id: string | null;
  } | null;
  if (!edition) {
    return {
      ok: false,
      message: "No live festival edition found — cannot attach a budget.",
    };
  }
  if (edition.budget_id) {
    return {
      ok: false,
      message: "This edition already has a budget — reload the page to see it.",
    };
  }

  const { data: inserted, error: insertError } = await sb
    .schema("yi_connect")
    .from("budgets")
    .insert({
      chapter_id: ERODE_CHAPTER_ID,
      name,
      fiscal_year: 2026,
      period: "custom",
      total_amount: totalAmount,
      allocated_amount: 0,
      spent_amount: 0,
      status: "active",
      start_date: "2026-06-01",
      end_date: "2026-09-30",
      created_by: gate.userId,
    })
    .select("id");
  const budgetId = inserted?.[0]?.id as string | undefined;
  if (insertError || !budgetId) {
    return {
      ok: false,
      message: "Couldn't create the budget — please try again.",
    };
  }

  // Link it to the live edition; surface failure instead of half-succeeding.
  const { data: linked, error: linkError } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .update({ budget_id: budgetId })
    .eq("id", edition.id)
    .select("id");
  if (linkError || !linked || linked.length === 0) {
    return {
      ok: false,
      message:
        "The budget was created but couldn't be linked to this edition — contact the festival chair.",
    };
  }

  revalidateBudgetRoutes();
  return { ok: true, message: `${name} created.` };
}

export async function addAllocation(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const budgetId = String(formData.get("budget_id") ?? "").trim();
  const verticalName = String(formData.get("vertical_name") ?? "").trim();
  const amountRaw = String(formData.get("allocated_amount") ?? "").trim();
  const allocatedAmount = Number(amountRaw);

  if (!budgetId) {
    return { ok: false, message: "Something went wrong — missing budget." };
  }
  if (verticalName.length < 2 || verticalName.length > 100) {
    return {
      ok: false,
      message: "Vertical name must be between 2 and 100 characters.",
    };
  }
  if (!amountRaw || !Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
    return {
      ok: false,
      message: "Please enter an allocated amount greater than 0.",
    };
  }

  const sb = createAdminSupabaseClient();

  const { data: budgetRaw } = await sb
    .schema("yi_connect")
    .from("budgets")
    .select("id, total_amount")
    .eq("id", budgetId)
    .maybeSingle();
  const budget = (budgetRaw ?? null) as {
    id: string;
    total_amount: number | null;
  } | null;
  if (!budget) {
    return { ok: false, message: "Budget not found — reload the page." };
  }

  // No duplicate vertical rows (unique on budget + vertical + category).
  const { data: existing } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .select("id")
    .eq("budget_id", budgetId)
    .ilike("vertical_name", verticalName)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      message: `"${verticalName}" already has an allocation — edit that row instead.`,
    };
  }

  // Keep within the budget envelope (DB CHECK: allocated ≤ total).
  const sums = await sumAllocations(sb, budgetId);
  const total = Number(budget.total_amount) || 0;
  if (sums.allocated + allocatedAmount > total) {
    const headroom = Math.max(0, total - sums.allocated);
    return {
      ok: false,
      message: `That would over-allocate the budget — only ₹${headroom.toLocaleString("en-IN")} is unallocated.`,
    };
  }

  const { data: inserted, error } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .insert({
      budget_id: budgetId,
      vertical_name: verticalName,
      allocated_amount: allocatedAmount,
      spent_amount: 0,
    })
    .select("id");
  if (error || !inserted || inserted.length === 0) {
    return {
      ok: false,
      message: "Couldn't add the allocation — please try again.",
    };
  }

  const recompute = await recomputeBudget(sb, budgetId);
  if (!recompute.ok) return recompute;

  revalidateBudgetRoutes();
  return { ok: true, message: `Allocation added for ${verticalName}.` };
}

/** Record the spend-to-date for one allocation (absolute value, not increment). */
export async function recordSpend(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const allocationId = String(formData.get("allocation_id") ?? "").trim();
  const amountRaw = String(formData.get("spent_amount") ?? "").trim();
  const spentAmount = Number(amountRaw);

  if (!allocationId) {
    return { ok: false, message: "Something went wrong — missing allocation." };
  }
  if (!amountRaw || !Number.isFinite(spentAmount) || spentAmount < 0) {
    return {
      ok: false,
      message: "Please enter a spent amount of 0 or more.",
    };
  }

  const sb = createAdminSupabaseClient();

  const { data: allocRaw } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .select("id, budget_id, spent_amount")
    .eq("id", allocationId)
    .maybeSingle();
  const alloc = (allocRaw ?? null) as {
    id: string;
    budget_id: string;
    spent_amount: number | null;
  } | null;
  if (!alloc) {
    return { ok: false, message: "Allocation not found — reload the page." };
  }

  // Keep total spend within the budget envelope (DB CHECK: spent ≤ total).
  const { data: budgetRaw } = await sb
    .schema("yi_connect")
    .from("budgets")
    .select("total_amount")
    .eq("id", alloc.budget_id)
    .maybeSingle();
  const total = Number(
    (budgetRaw as { total_amount: number | null } | null)?.total_amount
  ) || 0;
  const sums = await sumAllocations(sb, alloc.budget_id);
  const prospectiveSpent =
    sums.spent - (Number(alloc.spent_amount) || 0) + spentAmount;
  if (prospectiveSpent > total) {
    return {
      ok: false,
      message:
        "That would push total spend beyond the overall budget — check the amount.",
    };
  }

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("budget_allocations")
    .update({
      spent_amount: spentAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", allocationId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message: "Couldn't record the spend — please try again.",
    };
  }

  const recompute = await recomputeBudget(sb, alloc.budget_id);
  if (!recompute.ok) return recompute;

  revalidateBudgetRoutes();
  return { ok: true, message: "Spend recorded." };
}
