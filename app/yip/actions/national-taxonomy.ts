"use server";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — GoI taxonomy server ACTIONS.
//
// Create / update / delete + toggle needs_review / is_active on
// yip.gov_taxonomy (the canonical Government-of-India ministry/scheme tagging
// vocabulary). This is national PLATFORM master data → EVERY mutation gates
// with requireSuperAdmin() and returns { success:false, error } on deny
// (NEVER a silent redirect / NEVER getYipEventAccess — that is event-scoped).
//
// File rules:
//   • "use server" → may export ONLY async functions. The shared result/input
//     TYPES live in lib/yip/national/taxonomy-types.ts (a non-action module) so
//     this file exports no non-async members.
//   • Reads go through the typed getGovTaxonomy() in lib/yip/national/taxonomy.ts.
//     Writes use the per-call loose-cast escape hatch because yip.gov_taxonomy
//     is not in the generated Database types (additive migration) — the same
//     idiom sibling code uses for tables not yet in the types.
//   • The unique key is the case-insensitive expression index
//     (lower(ministry), lower(coalesce(scheme,''))). create() pre-checks for a
//     duplicate and surfaces a friendly message instead of a raw PG 23505.
//
// Deterministic only — no LLM here. A future AI layer would WRITE proposals into
// needs_review=true via this same gated path; it never bypasses requireSuperAdmin.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  getGovTaxonomy,
  normalizeMinistry,
  type GovTaxonomyRow,
} from "@/lib/yip/national/taxonomy";
import type {
  TaxonomyActionResult,
  TaxonomyInput,
} from "@/lib/yip/national/taxonomy-types";

const ADMIN_PATH = "/yip/dashboard/admin/taxonomy";
const NATIONAL_PATH = "/yip/dashboard/admin/national";

// ─── Loose-cast write surface (table not in generated types) ──────────────
// Mirrors the architect snippet exactly: declare only the method shapes we use.
type GovTaxonomyWriteTable = {
  insert: (v: unknown) => {
    select: (c: string) => {
      single: () => Promise<{
        data: Record<string, unknown> | null;
        error: { message?: string; code?: string } | null;
      }>;
    };
  };
  update: (v: unknown) => {
    eq: (
      k: string,
      v: unknown
    ) => {
      select: (c: string) => {
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
  delete: () => {
    eq: (k: string, v: unknown) => Promise<{ error: { message?: string } | null }>;
  };
};

const WRITE_COLS =
  "id, ministry, scheme, official_name, aliases, category, notes, needs_review, sort_order, is_active, created_at, updated_at";

function writeTable(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): GovTaxonomyWriteTable {
  return svc.from("gov_taxonomy" as never) as unknown as GovTaxonomyWriteTable;
}

// Map a raw written row back to the typed GovTaxonomyRow the client expects.
function mapWritten(r: Record<string, unknown>): GovTaxonomyRow {
  return {
    id: String(r.id),
    ministry: String(r.ministry ?? ""),
    scheme: (r.scheme as string | null) ?? null,
    official_name: (r.official_name as string | null) ?? null,
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    category: (r.category as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    needs_review: Boolean(r.needs_review),
    sort_order: (r.sort_order as number | null) ?? null,
    is_active: r.is_active === undefined ? true : Boolean(r.is_active),
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

// ─── Validation + normalization (local, not exported) ─────────────────────

function cleanAliases(raw: string[] | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of raw) {
    const t = (a ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

// Normalize a TaxonomyInput into the column payload. Empty strings → null so a
// blank scheme is a true ministry-parent row (the unique key coalesces null).
function toPayload(input: TaxonomyInput) {
  const ministry = (input.ministry ?? "").trim();
  const schemeTrim = (input.scheme ?? "").trim();
  return {
    ministry,
    scheme: schemeTrim || null,
    official_name: (input.official_name ?? "").trim() || null,
    aliases: cleanAliases(input.aliases),
    category: (input.category ?? "").trim() || null,
    notes: (input.notes ?? "").trim() || null,
    needs_review: Boolean(input.needs_review),
    sort_order:
      input.sort_order === undefined ||
      input.sort_order === null ||
      Number.isNaN(input.sort_order)
        ? null
        : Math.trunc(input.sort_order),
  };
}

function validate(input: TaxonomyInput): string | null {
  if (!input.ministry || input.ministry.trim().length < 3) {
    return "Ministry name must be at least 3 characters.";
  }
  return null;
}

function isDuplicate(
  rows: GovTaxonomyRow[],
  ministry: string,
  scheme: string | null,
  ignoreId?: string
): boolean {
  const mKey = normalizeMinistry(ministry);
  const sKey = (scheme ?? "").trim().toLowerCase();
  return rows.some(
    (r) =>
      r.id !== ignoreId &&
      normalizeMinistry(r.ministry) === mKey &&
      (r.scheme ?? "").trim().toLowerCase() === sKey
  );
}

// ─── Create ───────────────────────────────────────────────────────────────

export async function createTaxonomyEntry(
  input: TaxonomyInput
): Promise<TaxonomyActionResult<GovTaxonomyRow>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const err = validate(input);
  if (err) return { success: false, error: err };

  const payload = toPayload(input);

  // Pre-check against the case-insensitive unique key so we return a friendly
  // message instead of a raw Postgres 23505. includeInactive:true — a soft-
  // deleted row still occupies the unique slot.
  const existing = await getGovTaxonomy({ includeInactive: true });
  if (isDuplicate(existing, payload.ministry, payload.scheme)) {
    return {
      success: false,
      error: payload.scheme
        ? `"${payload.scheme}" already exists under ${payload.ministry}.`
        : `${payload.ministry} is already in the taxonomy.`,
    };
  }

  const svc = await createServiceClient();
  const { data, error } = await writeTable(svc)
    .insert({ ...payload, is_active: true })
    .select(WRITE_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create taxonomy entry.",
    };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(NATIONAL_PATH);
  return { success: true, data: mapWritten(data) };
}

// ─── Update ───────────────────────────────────────────────────────────────

export async function updateTaxonomyEntry(
  id: string,
  input: TaxonomyInput
): Promise<TaxonomyActionResult<GovTaxonomyRow>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "Missing taxonomy id." };

  const err = validate(input);
  if (err) return { success: false, error: err };

  const payload = toPayload(input);

  const existing = await getGovTaxonomy({ includeInactive: true });
  if (isDuplicate(existing, payload.ministry, payload.scheme, id)) {
    return {
      success: false,
      error: payload.scheme
        ? `"${payload.scheme}" already exists under ${payload.ministry}.`
        : `${payload.ministry} is already in the taxonomy.`,
    };
  }

  const svc = await createServiceClient();
  const { data, error } = await writeTable(svc)
    .update(payload)
    .eq("id", id)
    .select(WRITE_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update taxonomy entry.",
    };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(NATIONAL_PATH);
  return { success: true, data: mapWritten(data) };
}

// ─── Toggle needs_review ───────────────────────────────────────────────────
// The taxonomy is human-validated: clearing needs_review is the "I checked this
// against the real GoI record" action. Stored as the explicit value passed so
// the UI is the source of truth (not a blind flip).

export async function setTaxonomyNeedsReview(
  id: string,
  needsReview: boolean
): Promise<TaxonomyActionResult<GovTaxonomyRow>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "Missing taxonomy id." };

  const svc = await createServiceClient();
  const { data, error } = await writeTable(svc)
    .update({ needs_review: needsReview })
    .eq("id", id)
    .select(WRITE_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update review flag.",
    };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(NATIONAL_PATH);
  return { success: true, data: mapWritten(data) };
}

// ─── Toggle is_active (soft delete / restore) ──────────────────────────────

export async function setTaxonomyActive(
  id: string,
  isActive: boolean
): Promise<TaxonomyActionResult<GovTaxonomyRow>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "Missing taxonomy id." };

  const svc = await createServiceClient();
  const { data, error } = await writeTable(svc)
    .update({ is_active: isActive })
    .eq("id", id)
    .select(WRITE_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update active flag.",
    };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(NATIONAL_PATH);
  return { success: true, data: mapWritten(data) };
}

// ─── Hard delete ───────────────────────────────────────────────────────────
// Hard delete is offered alongside soft-delete because the taxonomy is a hand-
// curated vocabulary — a wrong entry (e.g. a hallucinated ministry caught in
// review) should be removable outright, not just hidden. Still super-admin only.

export async function deleteTaxonomyEntry(
  id: string
): Promise<TaxonomyActionResult<null>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "Missing taxonomy id." };

  const svc = await createServiceClient();
  const { error } = await writeTable(svc).delete().eq("id", id);

  if (error) {
    return {
      success: false,
      error: error?.message ?? "Failed to delete taxonomy entry.",
    };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(NATIONAL_PATH);
  return { success: true, data: null };
}
