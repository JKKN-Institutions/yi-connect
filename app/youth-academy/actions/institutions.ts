"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — institution master actions (Phase 5).
//
// The canonical institution master is `yi.institutions` (conductor override
// 2026-06-10 — verified live, 60 rows, has_yuva_chapter flag). This app
// never edits that master beyond an "ask to add" request row; national
// curates afterwards.
//
//   searchInstitutions  — public read of ACTIVE institutions (name ilike);
//                         feeds the institution picker on the NATIONAL
//                         academy form and (Phase 8) the public apply form.
//   requestInstitutionAdd — inserts a yi.institutions row with
//                         has_yuva_chapter=true and provenance in `notes`.
//                         Gate (spec inventory row): chapter gate — an
//                         active yuva chapter_admin or the national tier.
//
// Cross-schema access uses a per-call .schema("yi") on the service client
// with a minimal structural cast (repo precedent:
// lib/yi/directory/resolve-person.ts).
// ═══════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { createServiceClient } from "@/lib/yuva/supabase/service";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;
type DbErr = { message: string; code?: string } | null;
type OneRow = Promise<{ data: Record<string, unknown> | null; error: DbErr }>;

interface LooseBuilder extends PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: DbErr;
}> {
  select: (cols: string) => LooseBuilder;
  insert: (row: Record<string, unknown>) => LooseBuilder;
  eq: (col: string, val: unknown) => LooseBuilder;
  ilike: (col: string, val: string) => LooseBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => LooseBuilder;
  limit: (n: number) => LooseBuilder;
  maybeSingle: () => OneRow;
  single: () => OneRow;
}

function yiInstitutions(svc: Svc) {
  return (
    svc.schema("yi" as never) as unknown as {
      from: (table: "institutions") => LooseBuilder;
    }
  ).from("institutions");
}

// Escape % and _ so user text can't smuggle wildcards into ilike patterns.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

type InstitutionHit = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  type: string;
};

function toHit(r: Record<string, unknown>): InstitutionHit {
  return {
    id: String(r.id),
    name: String(r.name),
    city: (r.city as string | null) ?? null,
    state: (r.state as string | null) ?? null,
    type: String(r.type ?? "college"),
  };
}

// ─── searchInstitutions (public read) ────────────────────────────────────

export async function searchInstitutions(
  query: string
): Promise<ActionResult<InstitutionHit[]>> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { success: true, data: [] };
  if (q.length > 120) {
    return { success: false, error: "Search text is too long." };
  }

  const svc = await createServiceClient();
  const { data, error } = await yiInstitutions(svc)
    .select("id, name, city, state, type")
    .eq("is_active", true)
    .ilike("name", `%${escapeLike(q)}%`)
    .order("name")
    .limit(20);
  if (error) return { success: false, error: error.message };

  return { success: true, data: (data ?? []).map(toHit) };
}

// ─── requestInstitutionAdd (chapter gate; national passes too) ──────────

const requestSchema = z.object({
  name: z.string().trim().min(3, "Institution name is too short").max(200),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
});

export async function requestInstitutionAdd(
  input: z.infer<typeof requestSchema>
): Promise<ActionResult<InstitutionHit & { already_existed: boolean }>> {
  // Chapter gate (spec inventory): an active yuva chapter_admin — the
  // national tier passes too (the picker on the national academy form is the
  // Phase 5 consumer). Coordinators / mentors / anonymous are denied.
  const access = await getYuvaAccess();
  if (!access.isNational && access.chapterAdminOf === null) {
    return {
      success: false,
      error: `Only the Yi national team or a chapter admin can request a new institution. Your access: ${access.reason}`,
    };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid institution details",
    };
  }
  const v = parsed.data;

  const svc = await createServiceClient();

  // Dedupe on lower(name): if an active institution already exists, return
  // it (selected) instead of inserting a duplicate into the master.
  const { data: existing } = await yiInstitutions(svc)
    .select("id, name, city, state, type")
    .eq("is_active", true)
    .ilike("name", escapeLike(v.name))
    .maybeSingle();
  if (existing) {
    return {
      success: true,
      data: { ...toHit(existing), already_existed: true },
      warning: `"${String(existing.name)}" is already in the institution list — it has been selected.`,
    };
  }

  const requestedBy = access.personId ?? "unknown";
  const { data: created, error } = await yiInstitutions(svc)
    .insert({
      name: v.name,
      type: "college",
      city: v.city || null,
      state: v.state || null,
      has_yuva_chapter: true,
      is_active: true,
      notes: `Requested via Yi Youth Academy on ${new Date().toISOString().slice(0, 10)} by person ${requestedBy} (${access.reason}) — pending national curation.`,
    })
    .select("id, name, city, state, type")
    .single();
  if (error || !created) {
    return {
      success: false,
      error: `Could not add the institution: ${error?.message ?? "unknown error"}`,
    };
  }

  await logYuvaAudit({
    action: "request_add",
    entity: "yi.institutions",
    entity_id: String(created.id),
    chapter: access.chapterAdminOf,
    meta: { name: v.name, city: v.city ?? null, state: v.state ?? null },
  });

  return {
    success: true,
    data: { ...toHit(created), already_existed: false },
  };
}
