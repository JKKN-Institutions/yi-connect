"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/yip/ui/dialog";
import { getParticipantProfile } from "@/app/yip/actions/participant-profile";
import type { ParticipantProfile } from "@/app/yip/actions/participant-profile";
import { ParticipantProfileClient } from "@/app/yip/dashboard/events/[id]/participants/[participantId]/participant-profile-client";

/**
 * A participant's full profile in a popup — the SAME component the standalone
 * /participants/[participantId] page renders, in `variant="dialog"`. Reusing it
 * rather than rebuilding a summary means the popup can never drift from the
 * page it mirrors.
 *
 * The profile is fetched ONLY when the dialog opens, not for every row: a
 * nominations or roster table can be hundreds of rows, and eagerly loading a
 * full profile per row would be hundreds of pointless round-trips.
 *
 * Authorisation is unchanged and still server-side — getParticipantProfile()
 * gates on the caller's access to the event and returns null otherwise, which
 * renders as an explicit "can't open this" message rather than a blank popup.
 */
export function ParticipantProfileDialog({
  eventId,
  eventName,
  participantId,
  fallbackName,
  open,
  onOpenChange,
}: {
  eventId: string;
  eventName: string;
  participantId: string | null;
  /** Shown in the title while the profile is still loading. */
  fallbackName?: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!participantId) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const res = await getParticipantProfile(eventId, participantId);
      if (res) setProfile(res);
      else
        setError(
          "This participant's profile isn't available — they may not belong to this event, or your role may not include access."
        );
    } catch {
      // A server action can reject outright (e.g. the endpoint an already-open
      // page was built against is gone after a deploy). Say so rather than
      // leaving an empty popup that looks like the student has no data.
      setError("Could not load this profile. Close this and try again.");
    } finally {
      setLoading(false);
    }
  }, [eventId, participantId]);

  useEffect(() => {
    if (open && participantId) void load();
    if (!open) {
      setProfile(null);
      setError(null);
    }
  }, [open, participantId, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {profile?.participant.full_name ?? fallbackName ?? "Participant"}
          </DialogTitle>
          <DialogDescription>
            Full profile — the same detail as the participant page.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-[#1a1a3e]/60">
            <Loader2 className="size-4 animate-spin" />
            Loading profile…
          </p>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <ParticipantProfileClient
              eventId={eventId}
              eventName={eventName}
              profile={profile}
              variant="dialog"
            />
            {/* An escape hatch to the real page — for anyone who wants to
                bookmark, share or print one student's profile. */}
            <Link
              href={`/yip/dashboard/events/${eventId}/participants/${participantId}`}
              className="inline-flex items-center gap-1.5 text-xs text-[#1a1a3e]/55 hover:text-[#1a1a3e]"
            >
              <ExternalLink className="size-3.5" />
              Open as a full page
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Drop-in replacement for a participant's name in a table cell: renders the
 * name as a button that opens their profile in a popup, and owns its own
 * dialog state so a table only has to swap `{name}` for this.
 */
export function ParticipantNameButton({
  eventId,
  eventName,
  participantId,
  name,
  className,
}: {
  eventId: string;
  eventName: string;
  participantId: string;
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-left font-medium text-[#1a1a3e] underline-offset-4 hover:underline"
        }
        title={`Open ${name}'s profile`}
      >
        {name}
      </button>
      <ParticipantProfileDialog
        eventId={eventId}
        eventName={eventName}
        participantId={participantId}
        fallbackName={name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
