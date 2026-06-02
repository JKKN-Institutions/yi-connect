"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// Global, CRUDable catalog of named scoring sessions (BUG-385 follow-up).
//
// Keyed by a stable session_key so distinct sessions sharing an agenda_type are
// each their own row. Global — applies to every chapter's events, like rubrics.
// Flexible JSONB parameters (subset/re-weight of 110 or custom; evaluation +
// participation). session_weight drives the cross-session weighted average.

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
  created_at: string | null;
  updated_at: string | null;
};

export type SessionParametersInput = {
  session_key: string;
  label: string;
  agenda_type?: string | null;
  display_order?: number;
  parameters: SessionParameter[];
  session_weight?: number;
  is_active?: boolean;
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

    cleaned.push({ key, label, kind, max_score: Math.round(max), weight });
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
  created_at: string | null;
  updated_at: string | null;
}): SessionParametersConfig {
  const parameters = Array.isArray(row.parameters)
    ? (row.parameters as SessionParameter[]).map((p) => ({
        key: p.key,
        label: p.label,
        kind: (KINDS.includes(p.kind) ? p.kind : "evaluation") as ParameterKind,
        max_score: Number(p.max_score),
        weight: Number(p.weight),
      }))
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

export async function getSessionParametersByKey(
  sessionKey: string
): Promise<SessionParametersConfig | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("session_parameters")
    .select("*")
    .eq("session_key", sessionKey)
    .maybeSingle();
  return data ? rowToConfig(data) : null;
}

// Create or update a session (unique on session_key).
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

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("session_parameters")
    .upsert(
      {
        session_key,
        label,
        agenda_type: input.agenda_type ?? null,
        display_order: Math.round(Number(input.display_order ?? 0)) || 0,
        parameters: parsed.parameters as unknown as never,
        total_max: parsed.total_max,
        session_weight,
        is_active: input.is_active !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_key" }
    )
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save session" };
  }

  revalidatePath(PATH);
  return { success: true, data: rowToConfig(data) };
}

// Hard-delete a session (true CRUD — defaults can be removed). Safe: nothing
// FK-references session_parameters.
export async function deleteSessionParameters(
  sessionKey: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("session_parameters")
    .delete()
    .eq("session_key", sessionKey);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, data: null };
}
