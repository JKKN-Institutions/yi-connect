"use client";

// Delegate self-service controls for the "My team" page (bug-fix Batch 1).
// Every action renders its failure reason inline — a denied action must never
// look like a silent no-op or bounce to /forbidden.

import { useState, useTransition } from "react";
import {
  renameTeamAsCaptain,
  leaveMyTeam,
  deleteMyTeamAsCaptain,
  removeMemberAsCaptain,
  cancelTeamInvite,
} from "@/app/yi-future/actions/team-invites";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function Feedback({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="mt-2 text-xs font-semibold text-yi-green">
      {result.message ?? "Done."}
    </p>
  ) : (
    <p className="mt-2 text-xs font-semibold text-red-600">{result.error}</p>
  );
}

// ─── Rename (captain) ───────────────────────────────────────────────
export function RenameTeamForm({
  teamId,
  defaultName,
}: {
  teamId: string;
  defaultName: string;
}) {
  const [name, setName] = useState(defaultName);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          setResult(await renameTeamAsCaptain(teamId, name));
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

// ─── Two-step confirm button (shared) ───────────────────────────────
function ConfirmButton({
  label,
  confirmLabel,
  confirmText,
  onConfirm,
  small = false,
}: {
  label: string;
  confirmLabel: string;
  confirmText: string;
  onConfirm: () => Promise<Result>;
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <div className={small ? "inline-block" : ""}>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setArmed(true);
          }}
          className={
            small
              ? "px-2.5 py-1 rounded-md border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
              : "px-4 py-2 rounded-md border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50"
          }
        >
          {label}
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  return (
    <div
      className={
        small
          ? "p-2 rounded-md bg-red-50 border border-red-200"
          : "p-3 rounded-md bg-red-50 border border-red-200"
      }
    >
      <p className="text-xs font-semibold text-navy mb-2">{confirmText}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await onConfirm();
              setResult(r);
              if (!r.ok) setArmed(false);
            });
          }}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Working..." : confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setArmed(false)}
          className="px-3 py-1.5 rounded-md border border-navy/20 text-navy text-xs font-semibold hover:bg-navy/5"
        >
          Keep as is
        </button>
      </div>
      <Feedback result={result} />
    </div>
  );
}

// ─── Leave team (non-captain member) ────────────────────────────────
export function LeaveTeamButton() {
  return (
    <ConfirmButton
      label="Leave this team"
      confirmLabel="Yes, leave team"
      confirmText="You'll be removed from this team and can join or create another one. Continue?"
      onConfirm={() => leaveMyTeam()}
    />
  );
}

// ─── Delete team (captain) ──────────────────────────────────────────
export function DeleteTeamButton({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  return (
    <ConfirmButton
      label="Delete this team"
      confirmLabel="Yes, delete team"
      confirmText={`"${teamName}" and its invitations will be permanently deleted, and all members freed to join other teams. Continue?`}
      onConfirm={() => deleteMyTeamAsCaptain(teamId)}
    />
  );
}

// ─── Remove member (captain) ────────────────────────────────────────
export function RemoveMemberButton({
  teamId,
  delegateId,
  memberName,
}: {
  teamId: string;
  delegateId: string;
  memberName: string;
}) {
  return (
    <ConfirmButton
      small
      label="Remove"
      confirmLabel="Yes, remove"
      confirmText={`Remove ${memberName} from the team? They can be re-invited later.`}
      onConfirm={() => removeMemberAsCaptain(teamId, delegateId)}
    />
  );
}

// ─── Cancel a pending invite ────────────────────────────────────────
export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await cancelTeamInvite(inviteId));
          });
        }}
        className="text-[11px] font-semibold text-red-600/70 hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "Cancelling..." : "Cancel invite"}
      </button>
      {result && !result.ok && (
        <span className="text-[10px] font-semibold text-red-600">
          {result.error}
        </span>
      )}
    </span>
  );
}
