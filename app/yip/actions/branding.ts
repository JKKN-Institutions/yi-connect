"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import {
  BRANDING_RULES,
  type BrandingRule,
  type BrandingCategory,
  type BrandingSeverity,
} from "@/lib/yip/branding-rules";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ComplianceStatus =
  | "not_checked"
  | "pending_evidence"
  | "verified"
  | "violation"
  | "waived";

export type BrandingCheckRow = {
  id: string | null;
  event_id: string;
  rule_key: string;
  status: ComplianceStatus;
  evidence_url: string | null;
  checked_by: string | null;
  checked_at: string | null;
  notes: string | null;
  violation_action: string | null;
  /** Rule metadata, merged in from the active rule catalogue (DB or fallback). */
  rule: BrandingRule;
};

export type InvitationRow = {
  id: string;
  event_id: string;
  invitee_name: string;
  invitee_role: string | null;
  invitation_category: string | null;
  draft_url: string | null;
  submitted_for_approval_at: string | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_by_national: boolean;
  approved_at: string | null;
  approval_note: string | null;
  created_at: string;
};

export type ComplianceScore = {
  total_rules: number;
  verified: number;
  violations: number;
  pending: number;
  not_checked: number;
  waived: number;
  score_pct: number;
  blocker_violations: number;
  blocker_unchecked: number;
};

// ─────────────────────────────────────────────────────────────────────────
// Rule-catalogue loader (DB → fallback to static)
// ─────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: ReadonlySet<BrandingCategory> = new Set<BrandingCategory>([
  "logo",
  "backdrop",
  "collateral",
  "fund",
  "invitation",
  "recognition",
]);
const VALID_SEVERITIES: ReadonlySet<BrandingSeverity> = new Set<BrandingSeverity>([
  "blocker",
  "warning",
  "advisory",
]);

function coerceCategory(value: string): BrandingCategory {
  return (VALID_CATEGORIES.has(value as BrandingCategory)
    ? value
    : "collateral") as BrandingCategory;
}

function coerceSeverity(value: string): BrandingSeverity {
  return (VALID_SEVERITIES.has(value as BrandingSeverity)
    ? value
    : "warning") as BrandingSeverity;
}

async function loadActiveRules(): Promise<readonly BrandingRule[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .schema("yi").from("brand_rules") /* TODO yip-absorption: verify schema-pin */
    .select(
      "rule_key, category, title, description, handbook_page, requires_evidence, severity, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("rule_key", { ascending: true });

  // Defensive fallback: if the DB call fails or the table is empty (e.g.
  // migration 017 not yet seeded in this env), use the static catalogue so
  // the compliance checker keeps rendering. Admin edits at
  // /dashboard/admin/branding-rules will take effect once rows exist.
  if (error || !data || data.length === 0) {
    return BRANDING_RULES;
  }

  return data.map((row) => ({
    key: row.rule_key,
    category: coerceCategory(row.category),
    title: row.title,
    description: row.description,
    handbook_page: row.handbook_page ?? 0,
    requires_evidence: !!row.requires_evidence,
    severity: coerceSeverity(row.severity ?? "advisory"),
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Compliance checks
// ─────────────────────────────────────────────────────────────────────────

export async function listComplianceChecks(
  eventId: string
): Promise<BrandingCheckRow[]> {
  const supabase = await createServiceClient();
  const rules = await loadActiveRules();

  const { data } = await supabase
    .from("brand_checks")
    .select("*")
    .eq("event_id", eventId);

  const byKey = new Map<string, NonNullable<typeof data>[number]>();
  for (const row of data ?? []) {
    byKey.set(row.rule_key, row);
  }

  return rules.map((rule) => {
    const existing = byKey.get(rule.key);
    if (existing) {
      return {
        id: existing.id ?? null,
        event_id: eventId,
        rule_key: rule.key,
        status: (existing.status as ComplianceStatus) ?? "not_checked",
        evidence_url: existing.evidence_url ?? null,
        checked_by: existing.checked_by ?? null,
        checked_at: existing.checked_at ?? null,
        notes: existing.notes ?? null,
        violation_action: existing.violation_action ?? null,
        rule,
      } satisfies BrandingCheckRow;
    }
    return {
      id: null,
      event_id: eventId,
      rule_key: rule.key,
      status: "not_checked" as ComplianceStatus,
      evidence_url: null,
      checked_by: null,
      checked_at: null,
      notes: null,
      violation_action: null,
      rule,
    } satisfies BrandingCheckRow;
  });
}

export async function setComplianceStatus(
  eventId: string,
  ruleKey: string,
  status: ComplianceStatus,
  options?: {
    evidenceUrl?: string | null;
    notes?: string | null;
    violationAction?: string | null;
  }
): Promise<ActionResult> {
  // Validate rule_key against the active catalogue (DB-driven, with static
  // fallback) so admin-added rules are accepted but typos still fail loud.
  const activeRules = await loadActiveRules();
  if (!activeRules.some((r) => r.key === ruleKey)) {
    return { success: false, error: `Unknown branding rule: ${ruleKey}` };
  }

  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nowIso = new Date().toISOString();
  const checked = status !== "not_checked";

  const { error } = await supabase
    .from("brand_checks")
    .upsert(
      {
        event_id: eventId,
        rule_key: ruleKey,
        status,
        evidence_url: options?.evidenceUrl ?? null,
        notes: options?.notes ?? null,
        violation_action: options?.violationAction ?? null,
        checked_by: checked ? user?.id ?? null : null,
        checked_at: checked ? nowIso : null,
      },
      { onConflict: "event_id,rule_key" }
    );

  if (error) return { success: false, error: error.message };
  revalidatePath(`/dashboard/events/${eventId}/branding`);
  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

export async function getComplianceScore(
  eventId: string
): Promise<ComplianceScore> {
  const rows = await listComplianceChecks(eventId);
  const total = rows.length;

  let verified = 0;
  let violations = 0;
  let pending = 0;
  let notChecked = 0;
  let waived = 0;
  let blockerViolations = 0;
  let blockerUnchecked = 0;

  for (const row of rows) {
    switch (row.status) {
      case "verified":
        verified += 1;
        break;
      case "violation":
        violations += 1;
        if (row.rule.severity === "blocker") blockerViolations += 1;
        break;
      case "pending_evidence":
        pending += 1;
        break;
      case "waived":
        waived += 1;
        break;
      case "not_checked":
      default:
        notChecked += 1;
        if (row.rule.severity === "blocker") blockerUnchecked += 1;
        break;
    }
  }

  // Score = (verified + waived) / total. Guard against div-by-zero when
  // the catalogue is empty so callers never see NaN.
  const scorePct =
    total > 0 ? Math.round(((verified + waived) / total) * 100) : 0;

  return {
    total_rules: total,
    verified,
    violations,
    pending,
    not_checked: notChecked,
    waived,
    score_pct: scorePct,
    blocker_violations: blockerViolations,
    blocker_unchecked: blockerUnchecked,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Invitation approvals
// ─────────────────────────────────────────────────────────────────────────

function toInvitationRow(row: {
  id: string;
  event_id: string;
  invitee_name: string;
  invitee_role: string | null;
  invitation_category: string | null;
  draft_url: string | null;
  submitted_for_approval_at: string | null;
  approval_status: string;
  approved_by_national: boolean | null;
  approved_at: string | null;
  approval_note: string | null;
  created_at: string | null;
}): InvitationRow {
  const status: InvitationRow["approval_status"] =
    row.approval_status === "approved" || row.approval_status === "rejected"
      ? row.approval_status
      : "pending";
  return {
    id: row.id,
    event_id: row.event_id,
    invitee_name: row.invitee_name,
    invitee_role: row.invitee_role,
    invitation_category: row.invitation_category,
    draft_url: row.draft_url,
    submitted_for_approval_at: row.submitted_for_approval_at,
    approval_status: status,
    approved_by_national: !!row.approved_by_national,
    approved_at: row.approved_at,
    approval_note: row.approval_note,
    created_at: row.created_at ?? "",
  };
}

export async function listInvitations(
  eventId: string
): Promise<InvitationRow[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(toInvitationRow);
}

export async function recordInvitation(
  eventId: string,
  invitee: { name: string; role?: string | null },
  category: string,
  draftUrl?: string | null
): Promise<ActionResult<InvitationRow>> {
  if (!invitee.name?.trim()) {
    return { success: false, error: "Invitee name is required" };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      event_id: eventId,
      invitee_name: invitee.name.trim(),
      invitee_role: invitee.role?.trim() || null,
      invitation_category: category,
      draft_url: draftUrl?.trim() || null,
      approval_status: "pending",
      approved_by_national: false,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to record invitation" };
  }
  revalidatePath(`/dashboard/events/${eventId}/branding`);
  return { success: true, data: toInvitationRow(data) };
}

export async function approveInvitation(
  id: string,
  note?: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current, error: fetchErr } = await supabase
    .from("invitations")
    .select("event_id")
    .eq("id", id)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };

  const { error } = await supabase
    .from("invitations")
    .update({
      approval_status: "approved",
      approved_by_national: true,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      approval_note: note?.trim() || null,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  const eventId = current?.event_id;
  if (eventId) revalidatePath(`/dashboard/events/${eventId}/branding`);
  return { success: true, data: null };
}

export async function rejectInvitation(
  id: string,
  note?: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current, error: fetchErr } = await supabase
    .from("invitations")
    .select("event_id")
    .eq("id", id)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };

  const { error } = await supabase
    .from("invitations")
    .update({
      approval_status: "rejected",
      approved_by_national: false,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      approval_note: note?.trim() || null,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  const eventId = current?.event_id;
  if (eventId) revalidatePath(`/dashboard/events/${eventId}/branding`);
  return { success: true, data: null };
}

export async function deleteInvitation(
  id: string,
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "invitations",
    target_id: id,
    target_event_id: eventId,
  });
  revalidatePath(`/dashboard/events/${eventId}/branding`);
  return { success: true, data: null };
}
