"use server";

import { listChannels, listMessages } from "@/app/yip/actions/chat";

/**
 * Announcement feed for the participant-home strip (app/yip/me).
 *
 * DEFENSIVE BY DESIGN. This powers a strip that sits directly ABOVE the live
 * ballot on /yip/me, so it must NEVER throw or block. Every failure path —
 * chat disabled, gating denial, no announcement channel, query error,
 * unexpected exception — collapses to an empty array, and the strip then
 * renders nothing while the ballot below stays untouched.
 *
 * Composes the existing, already-gated chat reads: listChannels finds the
 * event's single `announcement` channel (visible to every participant of the
 * event), then listMessages pulls its feed. We surface only the most recent
 * non-deleted, non-empty messages, newest first.
 *
 * Returns plain `{ id, body, createdAt }` objects (no exported type — this is
 * a "use server" module, which may export async functions only).
 */
export async function getEventAnnouncements(
  eventId: string,
  participantId: string
): Promise<{ id: string; body: string; createdAt: string }[]> {
  try {
    if (!eventId || !participantId) return [];

    const channels = await listChannels(eventId, participantId);
    if (!channels.success) return [];

    const announcement = channels.data.find((c) => c.kind === "announcement");
    if (!announcement) return [];

    const messages = await listMessages({
      channelId: announcement.id,
      participantId,
    });
    if (!messages.success) return [];

    return messages.data
      .filter((m) => !m.deletedAt && m.body.trim().length > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt }));
  } catch {
    // Announcements are non-critical: never let a read failure reach the page.
    return [];
  }
}
