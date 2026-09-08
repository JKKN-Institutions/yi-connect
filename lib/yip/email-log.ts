/**
 * yip.email_log writer.
 *
 * YIP had no email logging. When a send fails — or half-fails — the only record
 * was a dialog on screen that vanished when closed, so "I never got my code"
 * was unanswerable. This mirrors what future.notification_log does for
 * Yi-Future.
 *
 * Order matters: rows go in as 'pending' BEFORE the provider is called, so a
 * crash, a timeout or a rejected batch still leaves evidence of what was
 * attempted and to whom. Logging is best-effort — a logging failure must never
 * stop an email going out, so every function here swallows its own errors and
 * reports them to the console only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type YipEmailLogStatus = "pending" | "sent" | "failed" | "skipped";

export type YipEmailLogEntry = {
  eventId: string;
  participantId?: string | null;
  triggerType: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  subjectLine?: string | null;
  status: YipEmailLogStatus;
  error?: string | null;
};

// The action files are "use server"; the Supabase client is created there and
// passed in, so this module stays free of request-scoped state.
type Db = SupabaseClient<never, "yip", never>;

/**
 * Insert log rows. Returns the new row ids in the same order as `entries`, or
 * an empty array if the insert failed — callers use the ids to settle the rows
 * afterwards and simply skip settling when logging is unavailable.
 */
export async function logYipEmails(
  db: Db,
  entries: YipEmailLogEntry[]
): Promise<string[]> {
  if (entries.length === 0) return [];
  try {
    const { data, error } = await db
      .from("email_log" as never)
      .insert(
        entries.map((e) => ({
          event_id: e.eventId,
          participant_id: e.participantId ?? null,
          trigger_type: e.triggerType,
          recipient_email: e.recipientEmail?.toLowerCase().trim() ?? null,
          recipient_name: e.recipientName ?? null,
          subject_line: e.subjectLine ?? null,
          status: e.status,
          error: e.error ?? null,
          sent_at: e.status === "sent" ? new Date().toISOString() : null,
        })) as never
      )
      .select("id");
    if (error) {
      console.error("[yip-email-log] insert failed:", error.message);
      return [];
    }
    return ((data ?? []) as { id: string }[]).map((r) => r.id);
  } catch (e) {
    console.error(
      "[yip-email-log] insert threw:",
      e instanceof Error ? e.message : String(e)
    );
    return [];
  }
}

/** Settle previously-pending rows once the provider has answered. */
export async function settleYipEmails(
  db: Db,
  ids: string[],
  status: Extract<YipEmailLogStatus, "sent" | "failed">,
  error?: string | null
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const { error: updateError } = await db
      .from("email_log" as never)
      .update({
        status,
        error: error ?? null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      } as never)
      .in("id", ids);
    if (updateError) {
      console.error("[yip-email-log] settle failed:", updateError.message);
    }
  } catch (e) {
    console.error(
      "[yip-email-log] settle threw:",
      e instanceof Error ? e.message : String(e)
    );
  }
}
