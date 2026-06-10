/**
 * Yi Youth Academy audit logger (clone of lib/yip/audit/log-action.ts).
 *
 * Writes one row into yuva.audit_log per mutation worth tracing (academy
 * activate/deactivate, cohort formation, certificate issue/reissue,
 * attendance reopen, access-code regeneration, …).
 *
 * Design contract (CRITICAL — same as the YIP donor):
 *   1. NEVER throws. Wrapped in try/catch internally — audit failures must
 *      never block the user's action.
 *   2. Uses the SERVICE client (no write RLS exists in yuva anyway) — audit
 *      rows always succeed, even for callers without an auth.user (student
 *      cookie-session paths).
 *   3. Resolves actor_person_id from the yi_directory funnel when no
 *      explicit override is passed (canonical identity — never a
 *      per-vertical table). Student paths pass the enrollment's personId
 *      explicitly via `actor_person_id`.
 *
 * Usage:
 *   await logYuvaAudit({
 *     action: "deactivate",
 *     entity: "academies",
 *     entity_id: academyId,
 *     chapter: academy.chapter,
 *     meta: { display_name: academy.display_name },
 *   });
 */
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { createServiceClient } from "@/lib/yuva/supabase/service";

export interface LogYuvaAuditInput {
  /** Verb, e.g. "create" | "update" | "delete" | "publish" | "issue" | "login". */
  action: string;
  /** Target table / domain object, e.g. "academies", "runs", "certificates". */
  entity: string;
  entity_id?: string | null;
  /** Chapter scope of the action when known (fast per-chapter filtering). */
  chapter?: string | null;
  /**
   * Optional actor override — supply for paths with no OAuth session
   * (student cookie-session actions). When omitted, the actor is resolved
   * from the yi_directory funnel.
   */
  actor_person_id?: string | null;
  meta?: Record<string, unknown>;
}

export async function logYuvaAudit(input: LogYuvaAuditInput): Promise<void> {
  try {
    let actorPersonId: string | null = input.actor_person_id ?? null;

    // Resolve the actor from the funnel if not explicitly provided.
    if (!actorPersonId) {
      try {
        const me = await getCurrentPersonRoles();
        actorPersonId = me?.person_id ?? null;
      } catch {
        // Cookie scope unavailable (e.g. called from a cron route). Ignore.
      }
    }

    const svc = await createServiceClient();
    await svc.from("audit_log").insert({
      actor_person_id: actorPersonId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      chapter: input.chapter ?? null,
      meta: (input.meta ?? {}) as never,
    });
  } catch {
    // Swallow all errors — audit is observational, never blocking.
  }
}
