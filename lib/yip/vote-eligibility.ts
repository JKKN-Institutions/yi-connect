import type { createServiceClient } from "@/lib/yip/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Require that a voter is checked in for the day the vote belongs to.
 *
 * Decision (rehearsal interview 2026-06-14): only students checked in for the
 * CURRENT DAY may cast a House vote — applied uniformly to the self, kiosk, and
 * organiser roll-call paths so there is no un-checked-in bypass. The vote's day
 * is its agenda item's `day` field; we require that day's check-in flag,
 * falling back to the derived `checked_in` when the agenda item carries no day.
 *
 * Returns a clear, user-facing error on failure — never a silent redirect/drop
 * (CLAUDE.md #27). Operational dependency: complete that day's check-in BEFORE
 * opening any vote on that day, or every cast is correctly blocked.
 */
export async function assertCheckedInForVote(
  supabase: ServiceClient,
  participantId: string,
  agendaItemId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: participant } = await supabase
    .from("participants")
    .select("checked_in, checked_in_day1, checked_in_day2")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participant not found." };

  let present: boolean;
  if (agendaItemId) {
    const { data: item } = await supabase
      .from("agenda")
      .select("day")
      .eq("id", agendaItemId)
      .maybeSingle();
    const day = item?.day;
    present =
      day === 1
        ? !!participant.checked_in_day1
        : day === 2
          ? !!participant.checked_in_day2
          : !!participant.checked_in;
  } else {
    present = !!participant.checked_in;
  }

  if (!present) {
    return {
      ok: false,
      error:
        "You're not checked in for today's session. Please see an organiser to check in, then vote.",
    };
  }
  return { ok: true };
}
