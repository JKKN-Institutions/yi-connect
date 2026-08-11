/**
 * The delegate's own list of team invitations — incoming (actionable) and sent.
 *
 * WHY THIS FILE CHANGED (silent-failure fix): the Accept and Decline buttons
 * used to be two inline `<form action={serverAction}>` blocks that called
 * `respondInvite(...)` and THREW THE RESULT AWAY — no variable, no branch, no
 * message. `respondInvite` returns `{ ok: false, error }` for every legitimate
 * refusal (team full, team locked, invitation expired, invitation no longer
 * pending, invitation not addressed to you, already on a team). So a failed
 * Accept looked identical to nothing happening: the page re-rendered, the
 * invitation was still sitting there, and the student had no idea why. They tap
 * again, it fails again.
 *
 * That matters at scale, not in theory: one chapter final holds ~141 live
 * pending invitations across ~93 students against ~106 open seats in 43 teams.
 * Capacity covers demand, but only just, and seats go first-come — so teams WILL
 * fill while another student is mid-tap and a meaningful number of Accepts will
 * legitimately fail.
 *
 * THE FIX IS REUSE, NOT A SECOND IMPLEMENTATION. The dashboard reminder
 * (components/yi-future/team/PendingInviteAlert.tsx) already solved this exact
 * problem and is deployed, so this page now renders the SAME
 * <PendingInviteActions> client component: one accept/decline code path, one
 * humanise() translator, one 12s watchdog, one set of sentences. Two divergent
 * copies of this logic is precisely how the next silent failure gets introduced.
 *
 * This page also stops drawing buttons that CANNOT succeed. respondInvite is
 * still the authority — it re-checks everything server-side — but a doomed
 * Accept button is worse than no button, so a locked team, a full team and
 * "you're already on a team" are each explained up front and Accept is withheld.
 * Decline stays available in all three cases so the student can tidy up.
 *
 * Nothing under app/yi-future/actions/ is modified by this change: respondInvite
 * is read and called, never edited.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { PendingInviteActions } from "@/components/yi-future/team/PendingInviteActions";

type IncomingInvite = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  teams: {
    id: string;
    team_name: string;
    chapter_id: string;
    /** Locked by the chapter — an Accept would be refused, so none is offered. */
    is_frozen: boolean | null;
    chapters: { name: string } | null;
  } | null;
  invited_by_delegate: { full_name: string } | null;
};

type OutgoingInvite = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  teams: { id: string; team_name: string } | null;
  invited_delegate: { full_name: string } | null;
};

async function loadIncoming(delegateId: string): Promise<IncomingInvite[]> {
  const svc = await createServiceClient();
  // team_invitations not yet in generated types (migration 120)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("team_invitations")
    .select(
      "id, status, message, created_at, responded_at, teams(id, team_name, chapter_id, is_frozen, chapters(name)), invited_by_delegate:delegates!team_invitations_invited_by_fkey(full_name)"
    )
    .eq("invited_delegate_id", delegateId)
    .order("created_at", { ascending: false });
  return (data as unknown as IncomingInvite[]) ?? [];
}

async function loadOutgoing(delegateId: string): Promise<OutgoingInvite[]> {
  const svc = await createServiceClient();
  // team_invitations not yet in generated types (migration 120)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("team_invitations")
    .select(
      "id, status, message, created_at, responded_at, teams(id, team_name), invited_delegate:delegates!team_invitations_invited_delegate_id_fkey(full_name)"
    )
    .eq("invited_by", delegateId)
    .order("created_at", { ascending: false });
  return (data as unknown as OutgoingInvite[]) ?? [];
}

/**
 * The team this delegate is ALREADY on, if any.
 *
 * One team per edition is enforced by the uniq_delegate_per_edition unique
 * index, so once a student is on a team every remaining pending invitation is
 * un-acceptable. respondInvite would surface that as raw Postgres duplicate-key
 * text; better to not offer the button and say why. (~24 delegates nationally
 * sit in exactly this state — on a team with pending invitations still listed.)
 */
async function loadOwnTeamId(delegateId: string): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  return (data as { team_id: string } | null)?.team_id ?? null;
}

/**
 * Live member counts for the teams behind the ACTIONABLE invitations only.
 *
 * Bounded by construction, so no fetchAllRows / 1,000-row-cap concern:
 * UNIQUE(team_id, invited_delegate_id) means a student holds at most one
 * invitation per team, the observed maximum held by one student is 5, and each
 * team holds at most TEAM_SIZE_MAX members.
 *
 * This count is a snapshot for rendering only. It decides whether to DRAW the
 * Accept button; whether an Accept SUCCEEDS is still decided server-side by
 * respondInvite, which re-counts at write time. A team that fills up in the
 * seconds after this read is the expected race, and PendingInviteActions is
 * what handles it honestly.
 */
async function loadTeamSizes(teamIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (teamIds.length === 0) return counts;
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);
  for (const m of (data as { team_id: string }[] | null) ?? []) {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Accept / Decline footer for ONE pending, non-expired incoming invitation.
 *
 * Only decides what is WORTH offering and explains anything withheld; the
 * buttons themselves — and every failure message — come from the shared
 * PendingInviteActions client component so this page and the dashboard reminder
 * can never drift apart.
 */
function InviteDecision({
  invite,
  memberCount,
  alreadyOnTeam,
}: {
  invite: IncomingInvite;
  memberCount: number;
  alreadyOnTeam: boolean;
}) {
  const team = invite.teams;
  if (!team) return null;

  const frozen = Boolean(team.is_frozen);
  const full = memberCount >= TEAM_SIZE_MAX;
  const seatsLeft = TEAM_SIZE_MAX - memberCount;
  const canAccept = !alreadyOnTeam && !frozen && !full;

  return (
    <div className="space-y-1.5 pt-1">
      {alreadyOnTeam ? (
        <p className="text-xs font-semibold text-yi-saffron">
          You&apos;re already on a team for this edition, so you can&apos;t accept
          this invitation as well. Decline it so they can invite someone else, or
          leave your current team first.
        </p>
      ) : frozen ? (
        <p className="text-xs font-semibold text-yi-saffron">
          This team is locked by the chapter, so nobody new can join it right now.
          Decline it and join another team, or ask{" "}
          {invite.invited_by_delegate?.full_name ?? "the team"} to have their
          chapter admin unlock it.
        </p>
      ) : full ? (
        <p className="text-xs font-semibold text-yi-saffron">
          This team is already full ({TEAM_SIZE_MAX} of {TEAM_SIZE_MAX} members),
          so you can&apos;t join it. Decline it and look for another team.
        </p>
      ) : (
        <p className="text-xs text-navy/50">
          {memberCount}/{TEAM_SIZE_MAX} members · {seatsLeft} seat
          {seatsLeft === 1 ? "" : "s"} left
        </p>
      )}

      <PendingInviteActions
        inviteId={invite.id}
        canAccept={canAccept}
        teamName={team.team_name}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-yi-gold/15 text-yi-gold",
    },
    accepted: {
      label: "Accepted",
      cls: "bg-yi-green/10 text-yi-green",
    },
    declined: {
      label: "Declined",
      cls: "bg-navy/10 text-navy/60",
    },
    expired: {
      label: "Expired",
      cls: "bg-red-500/10 text-red-600/80",
    },
  };
  const m = map[status] ?? { label: status, cls: "bg-navy/10 text-navy/60" };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MyInvitesPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const [incoming, outgoing, ownTeamId] = await Promise.all([
    loadIncoming(session.id),
    loadOutgoing(session.id),
    loadOwnTeamId(session.id),
  ]);

  // Only pending, non-expired invitations get buttons, so only their teams need
  // a live size read.
  const actionable = incoming.filter(
    (i) => i.status === "pending" && i.teams && !isInviteExpired(i.created_at)
  );
  const teamSizes = await loadTeamSizes(
    Array.from(new Set(actionable.map((i) => i.teams!.id)))
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">My invitations</h2>
        <p className="mt-1 text-sm text-navy/60">
          Browse incoming team invites and track ones you&apos;ve sent.
        </p>
        <div className="mt-2 text-xs text-navy/50">
          <Link
            href="/yi-future/me/team/directory"
            className="font-semibold text-navy hover:text-yi-gold"
          >
            Open chapter directory →
          </Link>
        </div>
      </div>

      {/* Invitations to you */}
      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/10 bg-navy/5">
          <div className="text-xs font-bold uppercase tracking-widest text-navy/60">
            Invitations to you ({incoming.length})
          </div>
        </div>

        {incoming.length === 0 ? (
          <p className="p-6 text-sm text-navy/50 italic text-center">
            You don&apos;t have any invitations yet.
          </p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {incoming.map((inv) => (
              <li key={inv.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy">
                      {inv.teams?.team_name ?? "Unknown team"}
                    </div>
                    <div className="text-xs text-navy/60">
                      Invited by{" "}
                      <span className="font-semibold">
                        {inv.invited_by_delegate?.full_name ?? "—"}
                      </span>
                      {" · "}
                      {fmtDate(inv.created_at)}
                      {inv.teams?.chapters?.name && (
                        <> · {inv.teams.chapters.name}</>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={inv.status === "pending" && isInviteExpired(inv.created_at) ? "expired" : inv.status} />
                </div>
                {inv.message && (
                  <p className="text-sm text-navy/70 italic border-l-2 border-yi-gold/40 pl-3">
                    “{inv.message}”
                  </p>
                )}
                {inv.status === "pending" && !isInviteExpired(inv.created_at) && (
                  <InviteDecision
                    invite={inv}
                    memberCount={
                      inv.teams ? (teamSizes.get(inv.teams.id) ?? 0) : 0
                    }
                    alreadyOnTeam={ownTeamId !== null}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Invitations you've sent */}
      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/10 bg-navy/5">
          <div className="text-xs font-bold uppercase tracking-widest text-navy/60">
            Invitations you&apos;ve sent ({outgoing.length})
          </div>
        </div>

        {outgoing.length === 0 ? (
          <p className="p-6 text-sm text-navy/50 italic text-center">
            You haven&apos;t sent any invitations yet.
          </p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {outgoing.map((inv) => (
              <li key={inv.id} className="p-4 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy">
                      {inv.invited_delegate?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-navy/60">
                      To join{" "}
                      <span className="font-semibold">
                        {inv.teams?.team_name ?? "—"}
                      </span>
                      {" · sent "}
                      {fmtDate(inv.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={inv.status === "pending" && isInviteExpired(inv.created_at) ? "expired" : inv.status} />
                </div>
                {inv.message && (
                  <p className="text-xs text-navy/60 italic">“{inv.message}”</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
