"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// Global per-session scoring configuration (BUG-385 follow-up).
//
// Super-admin defines, per session TYPE (agenda_type), which parameters apply
// and how the session is weighted in a delegate's final WEIGHTED AVERAGE. The
// config is GLOBAL — keyed by agenda_type with no event/chapter scope — so it
// applies to every chapter's events, exactly like yip.rubrics. Stored as
// flexible JSONB so a session can use a subset+re-weight of the 110 rubric OR
// session-specific parameters, and can carry both evaluation and participation
// parameters.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ParameterKind = "evaluation" | "participation";

export type SessionParameter = {
  key: string; // lowercase_snake_case, unique within the session
  label: string;
  kind: ParameterKind;
  max_score: number;
  weight: number; // relative weight within this session's parameters
};

export type SessionParametersConfig = {
  id: string;
  agenda_type: string;
  label: string;
  parameters: SessionParameter[];
  total_max: number;
  session_weight: number; // weight of this session in the cross-session average
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type SessionParametersInput = {
  agenda_type: string;
  label: string;
  parameters: SessionParameter[];
  session_weight?: number;
  is_active?: boolean;
};

const SESSION_PARAMS_PATH = "/dashboard/admin/session-parameters";
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const KINDS: ParameterKind[] = ["evaluation", "participation"];

function normaliseParameters(
  raw: unknown
): { ok: true; parameters: SessionParameter[]; total_max: number } | { ok: false; error: string } {
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
      return {
        ok: false,
        error: `Row ${i + 1}: key "${key}" must be lowercase_snake_case`,
      };
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

    cleaned.push({
      key,
      label,
      kind,
      max_score: Math.round(max),
      weight,
    });
  }

  const total_max = cleaned.reduce((s, p) => s + p.max_score, 0);
  return { ok: true, parameters: cleaned, total_max };
}

function rowToConfig(row: {
  id: string;
  agenda_type: string;
  label: string;
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
    agenda_type: row.agenda_type,
    label: row.label,
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
    .order("agenda_type", { ascending: true });
  return (data ?? []).map(rowToConfig);
}

export async function getSessionParameters(
  agendaType: string
): Promise<SessionParametersConfig | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("session_parameters")
    .select("*")
    .eq("agenda_type", agendaType)
    .eq("is_active", true)
    .maybeSingle();
  return data ? rowToConfig(data) : null;
}

// Create or update the config for a session type (unique on agenda_type).
export async function upsertSessionParameters(
  input: SessionParametersInput
): Promise<ActionResult<SessionParametersConfig>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const agenda_type = (input.agenda_type ?? "").trim();
  if (!agenda_type) return { success: false, error: "Session type is required" };
  const label = (input.label ?? "").trim();
  if (label.length < 2) return { success: false, error: "Label must be at least 2 characters" };

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
        agenda_type,
        label,
        parameters: parsed.parameters as unknown as never,
        total_max: parsed.total_max,
        session_weight,
        is_active: input.is_active !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agenda_type" }
    )
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save session parameters" };
  }

  revalidatePath(SESSION_PARAMS_PATH);
  return { success: true, data: rowToConfig(data) };
}

export async function deactivateSessionParameters(
  agendaType: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("session_parameters")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("agenda_type", agendaType);
  if (error) return { success: false, error: error.message };
  revalidatePath(SESSION_PARAMS_PATH);
  return { success: true, data: null };
}
