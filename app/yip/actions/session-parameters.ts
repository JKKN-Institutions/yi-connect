"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import { normaliseRoleSlugs } from "@/lib/yip/scoring-roles";
import {
  normaliseRoundLevels,
  roundLevelScopeKey,
  scopesOverlap,
  describeRoundLevels,
  type RoundLevel,
} from "@/lib/yip/round-level";

// Global, CRUDable catalog of named scoring sessions (BUG-385 follow-up).
//
// Keyed by a stable session_key so distinct sessions sharing an agenda_type are
// each their own row. Flexible JSONB parameters (subset/re-weight of 110 or
// custom; evaluation + participation). session_weight drives the cross-session
// weighted average.
//
// ROUND LEVEL (2026-08)
// A sheet may now be scoped to chapter / regional / national rounds via
// `levels`. NULL = every round, which is what every pre-existing sheet means,
// so nothing changes until a scope is set. Because regional agenda rows already
// carry the SAME session_key values as chapter ones, two sheets may now share a
// session_key as long as their level scopes do not overlap — the identity of a
// row is therefore its `id`, not its session_key.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ParameterKind = "evaluation" | "participation";

export type SessionParameter = {
  key: string;
  label: string;
  kind: ParameterKind;
  max_score: number;
  weight: number;
  /**
   * Role slugs this criterion applies to (lib/yip/scoring-roles.ts).
   * Absent / null = applies to EVERYONE, which is what every criterion on all
   * 13 production sheets means. Set it to split a sheet across the two sides of
   * the House: the presenter's criteria, the opposition's criteria, and the
   * common ones left untagged. total_max below stays the sheet's PUBLISHED
   * total (Σ over every criterion); an individual student's denominator is
   * applicableMax() over the subset that matches their role.
   */
  roles?: string[] | null;
};

export type SessionParametersConfig = {
  id: string;
  session_key: string;
  label: string;
  agenda_type: string | null;
  display_order: number;
  parameters: SessionParameter[];
  total_max: number;
  session_weight: number;
  is_active: boolean;
  /** Round levels this sheet applies to. null = every round. */
  levels: RoundLevel[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SessionParametersInput = {
  /**
   * The row being edited. Absent = creating. Identity is the id, not the
   * session_key, because two sheets may share a key at different levels.
   */
  id?: string;
  session_key: string;
  label: string;
  agenda_type?: string | null;
  display_order?: number;
  parameters: SessionParameter[];
  session_weight?: number;
  is_active?: boolean;
  /** Round levels; empty / all three / omitted all mean "every round". */
  levels?: string[] | null;
};

const PATH = "/dashboard/admin/session-parameters";
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const KINDS: ParameterKind[] = ["evaluation", "participation"];

function normaliseParameters(
  raw: unknown
):
  | { ok: true; parameters: SessionParameter[]; total_max: number }
  | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Parameters must be an array" };
  if (raw.length === 0) return { ok: false, error: "At least one parameter is required" };

  const cleaned: SessionParameter[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Partial<SessionParameter>;
    const key = (row.key ?? "").trim();
    const label = (row.label ?? "").trim();
    const kind = (row.kind ?? "evaluation") as ParameterKind;
    const max = Number(row.max_score);
    const weight = Number(row.weight);

    if (!key) return { ok: false, error: `Row ${i + 1}: key is required` };
    if (!KEY_PATTERN.test(key)) {
      return { ok: false, error: `Row ${i + 1}: key "${key}" must be lowercase_snake_case` };
    }
    if (seen.has(key)) return { ok: false, error: `Duplicate parameter key: "${key}"` };
    seen.add(key);
    if (!label) return { ok: false, error: `Row ${i + 1}: label is required` };
    if (!KINDS.includes(kind)) {
      return { ok: false, error: `Row ${i + 1}: kind must be 'evaluation' or 'participation'` };
    }
    if (!Number.isFinite(max) || max < 1) {
      return { ok: false, error: `Row ${i + 1}: max_score must be a number >= 1` };
    }
    if (!Number.isFinite(weight) || weight < 0) {
      return { ok: false, error: `Row ${i + 1}: weight must be a number >= 0` };
    }

    // Role scope is optional and stored canonically: null means "everyone",
    // never []. Unknown/blank entries are dropped rather than rejected — the
    // scope is a filter, and an unrecognised slug simply matches nobody.
    const roles = normaliseRoleSlugs(row.roles);
    cleaned.push({
      key,
      label,
      kind,
      max_score: Math.round(max),
      weight,
      ...(roles ? { roles } : {}),
    });
  }

  const total_max = cleaned.reduce((s, p) => s + p.max_score, 0);
  return { ok: true, parameters: cleaned, total_max };
}

function rowToConfig(row: {
  id: string;
  session_key: string;
  label: string;
  agenda_type: string | null;
  display_order: number;
  parameters: unknown;
  total_max: number;
  session_weight: number;
  is_active: boolean | null;
  levels?: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}): SessionParametersConfig {
  const parameters = Array.isArray(row.parameters)
    ? (row.parameters as SessionParameter[]).map((p) => {
        const roles = normaliseRoleSlugs(p.roles);
        return {
          key: p.key,
          label: p.label,
          kind: (KINDS.includes(p.kind) ? p.kind : "evaluation") as ParameterKind,
          max_score: Number(p.max_score),
          weight: Number(p.weight),
          // null stays null — "applies to everyone", the meaning of every
          // criterion written before role scoping existed.
          roles,
        };
      })
    : [];
  return {
    id: row.id,
    session_key: row.session_key,
    label: row.label,
    agenda_type: row.agenda_type,
    display_order: Number(row.display_order) || 0,
    parameters,
    total_max: row.total_max,
    session_weight: Number(row.session_weight),
    is_active: row.is_active !== false,
    // NULL stays NULL — "every round", the meaning of every pre-levels row.
    levels: normaliseRoundLevels(row.levels),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listSessionParameters(): Promise<SessionParametersConfig[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("session_parameters")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []).map(rowToConfig);
}

/**
 * One sheet by key. A key may now be held by more than one row (same session,
 * different round levels), so this takes the lowest display_order rather than
 * .maybeSingle(), which would raise on a second row. Level-aware resolution is
 * resolveSessionConfig() in lib/yip/session-config-resolution.ts — use that when
 * the answer must match what a juror marked against.
 */
export async function getSessionParametersByKey(
  sessionKey: string
): Promise<SessionParametersConfig | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("session_parameters")
    .select("*")
    .eq("session_key", sessionKey)
    .order("display_order", { ascending: true })
    .limit(1);
  return data?.[0] ? rowToConfig(data[0]) : null;
}

// Create or update a session.
//
// Identity is the row `id`. A session_key alone is no longer unique: the same
// session may have one sheet for chapter rounds and another for regional ones.
// When no id is supplied we look for the row holding the SAME key at the SAME
// scope and update it — which is exactly what the previous
// upsert(onConflict: session_key) did while every sheet was global.
export async function upsertSessionParameters(
  input: SessionParametersInput
): Promise<ActionResult<SessionParametersConfig>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const session_key = (input.session_key ?? "").trim();
  if (!KEY_PATTERN.test(session_key)) {
    return { success: false, error: "Session key must be lowercase_snake_case" };
  }
  const label = (input.label ?? "").trim();
  if (label.length < 2) return { success: false, error: "Name must be at least 2 characters" };

  const parsed = normaliseParameters(input.parameters);
  if (!parsed.ok) return { success: false, error: parsed.error };

  const session_weight = Number(input.session_weight ?? 1);
  if (!Number.isFinite(session_weight) || session_weight < 0) {
    return { success: false, error: "Session weight must be a number >= 0" };
  }

  const levels = normaliseRoundLevels(input.levels);

  const supabase = await createServiceClient();

  // Every row already holding this key, so we can tell "edit this one" from
  // "add a second sheet for another level" from "two sheets fighting over the
  // same level".
  const { data: siblings } = await supabase
    .from("session_parameters")
    .select("id, levels")
    .eq("session_key", session_key);

  const sameKeyRows = (siblings ?? []) as { id: string; levels?: string[] | null }[];

  // The row we are writing: the one named by id, else the one at this exact
  // scope (the old overwrite-on-same-key behaviour), else a brand new row.
  const scope = roundLevelScopeKey(levels);
  const targetId =
    input.id ??
    sameKeyRows.find((r) => roundLevelScopeKey(r.levels) === scope)?.id ??
    null;

  // Two SCOPED sheets must not both claim a level — resolution would be
  // ambiguous. A global sheet never conflicts: it is the documented fallback
  // that a level-scoped sheet overrides.
  const clash = sameKeyRows.find(
    (r) => r.id !== targetId && scopesOverlap(normaliseRoundLevels(r.levels), levels)
  );
  if (clash) {
    return {
      success: false,
      error: `Another sheet with the key "${session_key}" already covers ${describeRoundLevels(
        levels
      )}. Change the rounds it applies to, or edit that sheet instead.`,
    };
  }

  const values = {
    session_key,
    label,
    agenda_type: input.agenda_type ?? null,
    display_order: Math.round(Number(input.display_order ?? 0)) || 0,
    parameters: parsed.parameters as unknown as never,
    total_max: parsed.total_max,
    session_weight,
    is_active: input.is_active !== false,
    levels: levels as never,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = targetId
    ? await supabase
        .from("session_parameters")
        .update(values)
        .eq("id", targetId)
        .select()
        .single()
    : await supabase.from("session_parameters").insert(values).select().single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save session" };
  }

  revalidatePath(PATH);
  return { success: true, data: rowToConfig(data) };
}

// Hard-delete ONE sheet (true CRUD — defaults can be removed). Safe: nothing
// FK-references session_parameters.
//
// Takes the row id, not the session_key: a key may be held by a chapter sheet
// and a regional sheet, and deleting by key would take both.
export async function deleteSessionParameters(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No session was specified" };
  const supabase = await createServiceClient();
  const { error } = await supabase.from("session_parameters").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, data: null };
}
