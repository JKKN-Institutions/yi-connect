"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import {
  parseCSV,
  buildHeaderMap,
  normalizeRow,
  type NormalizedRegistration,
  type RegistrationSource,
  type RegistrationStatus,
  type RegistrationField,
} from "@/lib/yip/registrations";

// ── Result helper ─────────────────────────────────────────────────
type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Row shape returned to the client ─────────────────────────────
export type Registration = {
  id: string;
  event_id: string;
  source: RegistrationSource;
  raw_payload: Record<string, unknown>;
  full_name: string;
  school_name: string | null;
  class: number | null;
  section: string | null;
  phone: string | null;
  email: string | null;
  parent_phone: string | null;
  city: string | null;
  home_state: string | null;
  status: RegistrationStatus;
  participant_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  submission_batch: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  duplicate: number;
  participants_count: number;
};

type AnyClient = ReturnType<typeof createServiceClient> extends Promise<infer C>
  ? C
  : never;
function regs(client: AnyClient) {
  return client.from("registrations");
}

// ── Access code generation (copy of participants.ts helper) ──────
async function generateUniqueCode(
  supabase: AnyClient,
  eventId: string,
  existingCodes: Set<string>
): Promise<string> {
  let code = generateAccessCode();
  for (let attempt = 0; attempt < 25; attempt++) {
    if (!existingCodes.has(code)) {
      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", eventId)
        .eq("access_code", code)
        .maybeSingle();
      if (!p) {
        const { data: j } = await supabase
          .from("jury_assignments")
          .select("id")
          .eq("event_id", eventId)
          .eq("access_code", code)
          .maybeSingle();
        if (!j) {
          existingCodes.add(code);
          return code;
        }
      }
    }
    code = generateAccessCode();
  }
  throw new Error("Failed to generate unique access code after 25 attempts");
}

// ── Duplicate heuristic ──────────────────────────────────────────
// A row is a "duplicate" if an existing participant in the same event has
// a matching phone OR matching email OR (same school + same full_name).
async function findLikelyDuplicateParticipant(
  supabase: AnyClient,
  eventId: string,
  row: {
    full_name: string;
    phone: string | null;
    email: string | null;
    school_name: string | null;
  }
): Promise<string | null> {
  const orClauses: string[] = [];
  if (row.phone) orClauses.push(`phone.eq.${row.phone}`);
  if (row.email) orClauses.push(`email.eq.${row.email}`);
  if (orClauses.length > 0) {
    const { data } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", eventId)
      .or(orClauses.join(","))
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }
  if (row.school_name && row.full_name) {
    const { data } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("school_name", row.school_name)
      .ilike("full_name", row.full_name)
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }
  return null;
}

// ========================================================================
// ingestCSV
// ========================================================================
export async function ingestCSV(
  eventId: string,
  csvText: string,
  source: RegistrationSource = "microsoft_forms",
  headerOverrides?: Record<number, RegistrationField>
): Promise<
  ActionResult<{
    inserted: number;
    duplicates: number;
    errors: string[];
    batch: string;
  }>
> {
  if (!csvText || !csvText.trim()) {
    return { success: false, error: "CSV is empty" };
  }

  const supabase = await createServiceClient();

  // Verify event exists + ingestion enabled
  const { data: event } = await supabase
    .from("events")
    .select("id, ingestion_enabled")
    .eq("id", eventId)
    .single();

  if (!event) return { success: false, error: "Event not found" };
  if (event.ingestion_enabled === false) {
    return {
      success: false,
      error: "Ingestion is disabled for this event. Enable it in event settings.",
    };
  }

  const parsed = parseCSV(csvText);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { success: false, error: "No rows detected in CSV" };
  }

  const autoMap = buildHeaderMap(parsed.headers);
  const headerMap: Record<number, RegistrationField> = {
    ...autoMap,
    ...(headerOverrides ?? {}),
  };

  const batch = `${source}_${Date.now()}`;
  const errors: string[] = [];
  const inserts: Array<{
    event_id: string;
    source: RegistrationSource;
    raw_payload: Record<string, string>;
    full_name: string;
    school_name: string | null;
    class: number | null;
    section: string | null;
    phone: string | null;
    email: string | null;
    parent_phone: string | null;
    city: string | null;
    home_state: string | null;
    status: RegistrationStatus;
    submission_batch: string;
  }> = [];

  let duplicates = 0;

  for (let i = 0; i < parsed.rows.length; i++) {
    const row: NormalizedRegistration = normalizeRow(
      parsed.headers,
      parsed.rows[i],
      headerMap
    );
    if (row.errors.length > 0) {
      errors.push(`Row ${i + 2}: ${row.errors.join(", ")}`);
      continue; // skip malformed rows entirely
    }

    // Tentative duplicate check against participants table
    const dupe = await findLikelyDuplicateParticipant(supabase, eventId, {
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      school_name: row.school_name,
    });

    if (dupe) duplicates++;

    inserts.push({
      event_id: eventId,
      source,
      raw_payload: row.raw,
      full_name: row.full_name,
      school_name: row.school_name,
      class: row.class,
      section: row.section,
      phone: row.phone,
      email: row.email,
      parent_phone: row.parent_phone,
      city: row.city,
      home_state: row.home_state,
      status: dupe ? "duplicate" : "pending",
      submission_batch: batch,
    });
  }

  if (inserts.length === 0) {
    return {
      success: false,
      error:
        errors.length > 0
          ? `No valid rows. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`
          : "No valid rows in CSV",
    };
  }

  const { error: insertErr } = await regs(supabase).insert(inserts);
  if (insertErr) return { success: false, error: insertErr.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/registrations`);

  return {
    success: true,
    data: {
      inserted: inserts.length,
      duplicates,
      errors,
      batch,
    },
  };
}

// ========================================================================
// listRegistrations
// ========================================================================
export async function listRegistrations(
  eventId: string,
  filter?: { status?: RegistrationStatus; batch?: string }
): Promise<Registration[]> {
  const supabase = await createServiceClient();
  let q = regs(supabase)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.batch) q = q.eq("submission_batch", filter.batch);
  const { data } = await q;
  return (data ?? []) as Registration[];
}

// ========================================================================
// getRegistrationStats
// ========================================================================
export async function getRegistrationStats(
  eventId: string
): Promise<RegistrationStats> {
  const supabase = await createServiceClient();
  const [regsRes, partsRes] = await Promise.all([
    regs(supabase).select("status").eq("event_id", eventId),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);

  const rows = (regsRes.data ?? []) as { status: RegistrationStatus }[];
  const count = (s: RegistrationStatus) => rows.filter((r) => r.status === s).length;

  return {
    total: rows.length,
    pending: count("pending"),
    approved: count("approved"),
    rejected: count("rejected"),
    duplicate: count("duplicate"),
    participants_count: partsRes.count ?? 0,
  };
}

// ========================================================================
// approveRegistration — creates a participants row + links back.
// ========================================================================
export async function approveRegistration(
  regId: string
): Promise<ActionResult<{ participant_id: string; access_code: string }>> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reg } = await regs(supabase)
    .select("*")
    .eq("id", regId)
    .single();

  if (!reg) return { success: false, error: "Registration not found" };
  if (reg.status === "approved") {
    return { success: false, error: "Already approved" };
  }

  if (!reg.full_name) {
    return { success: false, error: "Cannot approve: missing full_name" };
  }

  try {
    const code = await generateUniqueCode(supabase, reg.event_id, new Set());

    // Find-or-create the stable person identity (Option B).
    // Preserves profile across chapter → regional → national rounds and years.
    const { findOrCreatePerson } = await import("./people");
    const personRes = await findOrCreatePerson({
      full_name: reg.full_name,
      school_name: reg.school_name ?? null,
      class: reg.class ?? null,
      section: reg.section ?? null,
      phone: reg.phone ?? null,
      email: reg.email ?? null,
      parent_phone: reg.parent_phone ?? null,
      city: reg.city ?? null,
      home_state: reg.home_state ?? null,
    });
    const personId = personRes.success ? personRes.data.id : null;

    const { data: participant, error: partErr } = await supabase
      .from("participants")
      .insert({
        event_id: reg.event_id,
        person_id: personId,
        full_name: reg.full_name,
        school_name: reg.school_name ?? "",
        class: reg.class ?? 10,
        section: reg.section ?? null,
        phone: reg.phone ?? null,
        email: reg.email ?? null,
        parent_phone: reg.parent_phone ?? null,
        city: reg.city ?? null,
        home_state: reg.home_state ?? null,
        access_code: code,
      })
      .select("id, access_code")
      .single();

    if (partErr || !participant) {
      return {
        success: false,
        error: partErr?.message ?? "Failed to create participant",
      };
    }

    const { error: updateErr } = await regs(supabase)
      .update({
        status: "approved",
        participant_id: participant.id,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", regId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath(`/yip/dashboard/events/${reg.event_id}/registrations`);
    revalidatePath(`/yip/dashboard/events/${reg.event_id}/participants`);

    return {
      success: true,
      data: {
        participant_id: participant.id as string,
        access_code: participant.access_code as string,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ========================================================================
// rejectRegistration
// ========================================================================
export async function rejectRegistration(
  regId: string,
  reason: string
): Promise<ActionResult> {
  if (!reason || !reason.trim()) {
    return { success: false, error: "Rejection reason is required" };
  }
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reg } = await regs(supabase)
    .select("event_id")
    .eq("id", regId)
    .single();

  const { error } = await regs(supabase)
    .update({
      status: "rejected",
      rejection_reason: reason.trim(),
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", regId);

  if (error) return { success: false, error: error.message };
  if (reg) revalidatePath(`/yip/dashboard/events/${reg.event_id}/registrations`);
  return { success: true, data: null };
}

// ========================================================================
// markAsDuplicate
// ========================================================================
export async function markAsDuplicate(regId: string): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reg } = await regs(supabase)
    .select("event_id")
    .eq("id", regId)
    .single();

  const { error } = await regs(supabase)
    .update({
      status: "duplicate",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", regId);

  if (error) return { success: false, error: error.message };
  if (reg) revalidatePath(`/yip/dashboard/events/${reg.event_id}/registrations`);
  return { success: true, data: null };
}

// ========================================================================
// bulkApprove — approves many registrations sequentially (access-code
// generation can't be batched safely). Collects per-row errors but does
// NOT abort the whole batch on a single failure.
// ========================================================================
export async function bulkApprove(
  regIds: string[]
): Promise<ActionResult<{ approved: number; failed: number; errors: string[] }>> {
  if (regIds.length === 0) {
    return { success: false, error: "No registrations selected" };
  }
  let approved = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of regIds) {
    const res = await approveRegistration(id);
    if (res.success) approved++;
    else {
      failed++;
      errors.push(`${id.slice(0, 8)}…: ${res.error}`);
    }
  }
  return { success: true, data: { approved, failed, errors } };
}

// ========================================================================
// deleteRegistration — event-owner only, per RLS policy.
// ========================================================================
export async function deleteRegistration(
  regId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { data: reg } = await regs(supabase)
    .select("event_id")
    .eq("id", regId)
    .single();

  if (!reg) return { success: false, error: "Registration not found" };

  // Registrations carry student PII — deletion is chair-only.
  const access = await getYipEventAccess(reg.event_id);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete registrations" };
  }

  const { error } = await regs(supabase)
    .delete()
    .eq("id", regId)
    .eq("event_id", reg.event_id);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "registrations",
    target_id: regId,
    target_event_id: reg?.event_id ?? null,
  });
  if (reg) revalidatePath(`/yip/dashboard/events/${reg.event_id}/registrations`);
  return { success: true, data: null };
}

// ========================================================================
// setIngestionEnabled — toggle ingestion kill-switch per event.
// ========================================================================
export async function setIngestionEnabled(
  eventId: string,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ ingestion_enabled: enabled })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/registrations`);
  return { success: true, data: null };
}
