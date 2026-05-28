/**
 * Admin audit logger (Phase 19 / B — 2026-05-28)
 *
 * Writes one row into yip.admin_audit_log per destructive / mutation action.
 * The 2026-05-27 Yi National team meeting captured the requirement:
 *
 *   "Database — which mobile number entered, who did the changes, who logged
 *    in, what has happened."
 *
 * Design contract (CRITICAL):
 *   1. NEVER throws. Wrapped in try/catch internally — audit failures must
 *      never block the user's action.
 *   2. Uses the SERVICE client (bypasses RLS) — audit rows always succeed,
 *      even for callers without an auth.user (e.g. jury login by email).
 *   3. Resolves performed_by from the cookie-scoped auth.getUser() when no
 *      explicit override is passed. Adds organizers.id and email when found.
 *
 * Usage:
 *
 *   await logAuditAction({
 *     action_type: "delete",
 *     target_table: "participants",
 *     target_id: participantId,
 *     target_event_id: eventId,
 *     metadata: { full_name: "..." },
 *   });
 *
 * For paths with no auth.user (jury login by email):
 *
 *   await logAuditAction({
 *     action_type: "login",
 *     target_table: "auth",
 *     target_id: juryAssignmentId,
 *     target_event_id: eventId,
 *     performed_by: { email: normalisedEmail },
 *     metadata: { method: "jury-email" },
 *   });
 */
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";

export type AuditActionType =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "wipe"
  | "import"
  | "export";

export interface LogAuditActionInput {
  action_type: AuditActionType;
  target_table: string;
  target_id?: string | null;
  target_event_id?: string | null;
  /** Optional override — supply when no auth.user is available (jury login). */
  performed_by?: {
    user_id?: string | null;
    organizer_id?: string | null;
    email?: string | null;
  };
  metadata?: Record<string, unknown>;
}

export async function logAuditAction(input: LogAuditActionInput): Promise<void> {
  try {
    let performed_by_user_id: string | null = input.performed_by?.user_id ?? null;
    let performed_by_organizer_id: string | null =
      input.performed_by?.organizer_id ?? null;
    let performed_by_email: string | null = input.performed_by?.email ?? null;

    // Resolve auth.user from cookies if not explicitly provided.
    if (!performed_by_user_id) {
      try {
        const supa = await createClient();
        const {
          data: { user },
        } = await supa.auth.getUser();
        if (user) {
          performed_by_user_id = user.id;
          performed_by_email ??= user.email ?? null;
        }
      } catch {
        // Cookie scope unavailable (e.g. called from a webhook). Ignore.
      }
    }

    const svc = await createServiceClient();

    // Best-effort organizer lookup (denormalize id + email for fast filtering).
    if (performed_by_user_id && !performed_by_organizer_id) {
      try {
        const { data: org } = await svc
          .from("organizers")
          .select("id, email")
          .eq("user_id", performed_by_user_id)
          .maybeSingle();
        if (org) {
          performed_by_organizer_id = org.id;
          performed_by_email ??= org.email ?? null;
        }
      } catch {
        // Non-fatal.
      }
    }

    // Use a raw insert via fetch to the PostgREST endpoint to avoid the
    // strict generated-types narrowing for a newly-added table. The service
    // client already targets schema "yip"; supply a Record<string, unknown>.
    const payload = {
      action_type: input.action_type,
      target_table: input.target_table,
      target_id: input.target_id ?? null,
      target_event_id: input.target_event_id ?? null,
      performed_by_user_id,
      performed_by_organizer_id,
      performed_by_email,
      metadata: input.metadata ?? {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from("admin_audit_log" as any) as any).insert(payload);
  } catch {
    // Swallow all errors — audit is observational, never blocking.
  }
}
