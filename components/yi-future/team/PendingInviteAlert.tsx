import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { PendingInviteActions } from "./PendingInviteActions";

/**
 * Unmissable in-app reminder that a delegate has team invitation(s) waiting.
 *
 * WHY THIS EXISTS: invitations were only ever announced by email, and Resend's
 * monthly quota ran out — so ~1,200 still-valid invitations nationally were
 * never seen by the student they were sent to (149 of them in Erode, whose
 * chapter final is 12 Aug 2026). The director's call was "just a reminder
 * inside the app": nothing is sent to anyone, the student simply cannot miss it
 * when they open the site.
 *
 * Renders NOTHING (not an empty state — nothing at all) when:
 *   - the viewer isn't a signed-in delegate,
 *   - the delegate is already on a team (their pending invites are moot; the
 *     /me/team/invites page still lists them), or
 *   - there are no non-expired pending invitations.
 *
 * Async server component that fetches its own data, matching
 * DelegateAnnouncementsPanel on the same page. The parent /yi-future/me layout
 * is force-dynamic, so this is re-read on every visit.
 */

// team_invitations is not in the generated Supabase types yet (migration 120),
// so the schema client is untyped at these call sites — same as every other
// reader of this table.
type AnyClient = any;

type PendingInvite = {
  id: string;
  message: string | null;
  created_at: string;
  teams: {
    id: string;
    team_name: string;
    is_frozen: boolean | null;
    chapters: { name: string } | null;
  } | null;
  invited_by_delegate: { full_name: string } | null;
};

/**
 * How many invitations the banner itself lists. The rest are reachable via the
 * full invitations page. Bounded on purpose: the observed maximum held by one
 * student is 5, and the UNIQUE(team_id, invited_delegate_id) constraint caps the
 * theoretical maximum at one per team in the chapter (largest chapter = 231
 * teams), so this read can never approach the 1,000-row PostgREST cap and does
 * not need fetchAllRows.
 */
const DISPLAY_CAP = 6;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}

export async function PendingInviteAlert() {
  const session = await readSession();
  if (!session || session.type !== "delegate") return null;

  const svc = await createServiceClient();

  // Already on a team? Then no invitation is actionable — accepting any of them
  // would be rejected by the uniq_delegate_per_edition index. Show nothing
  // rather than a button that is guaranteed to fail. (24 delegates nationally
  // are in exactly this state.)
  const { data: membership } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (membership) return null;

  const { data: rows } = await (svc as AnyClient)
    .schema("future")
    .from("team_invitations")
    .select(
      "id, message, created_at, teams(id, team_name, is_frozen, chapters(name)), invited_by_delegate:delegates!team_invitations_invited_by_fkey(full_name)"
    )
    .eq("invited_delegate_id", session.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const all = (rows as unknown as PendingInvite[]) ?? [];

  // Expired invitations must never be offered as actionable. 1,200+ pending rows
  // nationally are already past the 7-day window (369 in Bengaluru alone) and
  // respondInvite would reject them anyway.
  const live = all.filter((i) => i.teams && !isInviteExpired(i.created_at));
  if (live.length === 0) return null;

  const shown = live.slice(0, DISPLAY_CAP);
  const hidden = live.length - shown.length;

  // Member counts for the invited teams, to spot ones that are already full.
  // At most DISPLAY_CAP teams × TEAM_SIZE_MAX members — a handful of rows.
  const teamIds = Array.from(new Set(shown.map((i) => i.teams!.id)));
  const { data: memberRows } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);
  const counts = new Map<string, number>();
  for (const m of (memberRows as { team_id: string }[] | null) ?? []) {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  }

  const NAVY = "#1a1a3e";
  const GOLD = "#F5A623";

  return (
    <section
      className="rounded-xl border-2 overflow-hidden shadow-sm"
      style={{ borderColor: GOLD, background: "#FFF8EC" }}
      aria-labelledby="pending-invite-heading"
    >
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ background: GOLD }}
      >
        <span className="text-lg leading-none" aria-hidden="true">
          ✉️
        </span>
        <h2
          id="pending-invite-heading"
          className="text-sm font-extrabold uppercase tracking-wide"
          style={{ color: NAVY }}
        >
          {live.length === 1
            ? "You have a team invitation waiting"
            : `You have ${live.length} team invitations waiting`}
        </h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm" style={{ color: `${NAVY}cc` }}>
          {live.length === 1
            ? "Accept it to join the team, or decline so they can invite someone else."
            : "You can join only one team — accepting one automatically declines the rest."}
        </p>

        <ul className="space-y-4">
          {shown.map((inv) => {
            const team = inv.teams!;
            const size = counts.get(team.id) ?? 0;
            const frozen = Boolean(team.is_frozen);
            const full = size >= TEAM_SIZE_MAX;
            const canAccept = !frozen && !full;

            return (
              <li
                key={inv.id}
                className="rounded-lg border bg-white p-4"
                style={{ borderColor: `${NAVY}1f` }}
              >
                <div className="font-bold text-navy">{team.team_name}</div>
                <div className="mt-0.5 text-xs text-navy/60">
                  {inv.invited_by_delegate?.full_name ? (
                    <>
                      Invited by{" "}
                      <span className="font-semibold text-navy/80">
                        {inv.invited_by_delegate.full_name}
                      </span>
                    </>
                  ) : (
                    <>Invited by a team member</>
                  )}
                  {" · "}
                  {fmtDate(inv.created_at)}
                  {team.chapters?.name && <> · {team.chapters.name}</>}
                  {!frozen && !full && (
                    <>
                      {" · "}
                      {size}/{TEAM_SIZE_MAX} members
                    </>
                  )}
                </div>

                {inv.message && (
                  <p className="mt-2 text-sm italic text-navy/70 border-l-2 pl-3" style={{ borderColor: `${GOLD}88` }}>
                    &ldquo;{inv.message}&rdquo;
                  </p>
                )}

                {/* A doomed Accept button is worse than no button — explain instead. */}
                {frozen ? (
                  <p className="mt-2 text-xs font-semibold text-yi-saffron">
                    This team is locked, so you can&apos;t join it right now. Ask{" "}
                    {inv.invited_by_delegate?.full_name ?? "the team"} to get
                    their chapter admin to unlock it — or decline and join
                    another team.
                  </p>
                ) : full ? (
                  <p className="mt-2 text-xs font-semibold text-yi-saffron">
                    This team is already full ({TEAM_SIZE_MAX} of{" "}
                    {TEAM_SIZE_MAX} members), so you can&apos;t join it. Decline
                    it and look for another team.
                  </p>
                ) : null}

                <PendingInviteActions
                  inviteId={inv.id}
                  canAccept={canAccept}
                  teamName={team.team_name}
                />
              </li>
            );
          })}
        </ul>

        {hidden > 0 && (
          <Link
            href="/yi-future/me/team/invites"
            className="inline-block text-xs font-bold underline"
            style={{ color: NAVY }}
          >
            + {hidden} more invitation{hidden === 1 ? "" : "s"} — see all →
          </Link>
        )}
      </div>
    </section>
  );
}
