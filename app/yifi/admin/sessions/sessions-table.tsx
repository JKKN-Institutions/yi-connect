"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "./actions";
import { SessionForm } from "./session-form";

export interface AdminSession {
  id: string;
  edition_id: string;
  title: string;
  speaker_name: string | null;
  speaker_bio: string | null;
  session_type: string | null;
  start_time: string | null;
  end_time: string | null;
  consent_archiving: boolean;
  transcript_url: string | null;
  transcript_text: string | null;
  has_transcript: boolean;
  themes: string[] | null;
  concepts: unknown;
  created_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  keynote: "Keynote",
  panel: "Panel",
  fireside: "Fireside",
  workshop: "Workshop",
  tour: "Tour",
  peer: "Peer",
};

function typeBadgeClasses(type: string | null): string {
  switch (type) {
    case "keynote":
      return "bg-[#FD7215]/20 text-[#FD7215]";
    case "panel":
      return "bg-cyan-500/20 text-cyan-400";
    case "fireside":
      return "bg-purple-500/20 text-purple-300";
    case "workshop":
      return "bg-[#229434]/20 text-[#229434]";
    case "tour":
      return "bg-amber-500/20 text-amber-300";
    case "peer":
      return "bg-pink-500/20 text-pink-300";
    default:
      return "bg-white/10 text-white/40";
  }
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionsTable({ rows }: { rows: AdminSession[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
        <p className="text-white/40 text-sm">
          No sessions yet. Add one with the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </div>
  );
}

function SessionRow({ session }: { session: AdminSession }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("id", session.id);
    startTransition(async () => {
      const res = await deleteSession(formData);
      if ("error" in res) {
        setError(res.error);
        setConfirmingDelete(false);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="bg-white/5 border border-[#FD7215]/30 rounded-xl p-4">
        <p className="text-xs text-white/40 mb-3">
          Editing &ldquo;{session.title}&rdquo;
        </p>
        <SessionForm
          session={session}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const typeLabel = session.session_type
    ? TYPE_LABELS[session.session_type] ?? session.session_type
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-white font-medium">{session.title}</p>
            {typeLabel && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeClasses(session.session_type)}`}
              >
                {typeLabel}
              </span>
            )}
          </div>
          <p className="text-white/40 text-xs">
            {session.speaker_name || "No speaker"}
            <span className="text-white/30"> · {formatTime(session.start_time)}</span>
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-xs ${session.has_transcript ? "text-[#229434]" : "text-white/30"}`}
            >
              {session.has_transcript ? "✓" : "—"} Transcript
            </span>
            <span
              className={`text-xs ${session.consent_archiving ? "text-[#229434]" : "text-white/30"}`}
            >
              {session.consent_archiving ? "✓" : "—"} Consent
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:border-white/40 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-white/40 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:border-red-500/60 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
