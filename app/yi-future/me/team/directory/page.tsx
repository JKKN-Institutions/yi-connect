import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { sendInvite } from "@/app/yi-future/actions/team-invites";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

type Me = {
  id: string;
  full_name: string;
  chapter_id: string;
  edition_id: string;
  chapters: { name: string; city: string } | null;
  team_members: {
    teams: {
      id: string;
      team_name: string;
      is_frozen: boolean | null;
      captain_id: string | null;
      leader_delegate_id: string | null;
      team_members: { delegate_id: string }[];
    } | null;
  }[];
};

type ChapterDelegate = {
  id: string;
  full_name: string;
  email: string | null;
  team_members: { team_id: string }[];
};

async function loadMe(id: string): Promise<Me | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, chapter_id, edition_id, chapters(name, city), team_members(teams(id, team_name, is_frozen, captain_id, leader_delegate_id, team_members(delegate_id)))"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Me) ?? null;
}

async function loadChapterDelegates(
  chapterId: string,
  editionId: string
): Promise<ChapterDelegate[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, email, team_members(team_id)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data as unknown as ChapterDelegate[]) ?? [];
}

async function loadAlumniEmails(
  delegates: ChapterDelegate[],
  editionId: string
): Promise<Set<string>> {
  const emails = delegates.map((d) => d.email).filter(Boolean) as string[];
  if (emails.length === 0) return new Set();
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("email")
    .in("email", emails)
    .neq("edition_id", editionId);
  const alumniEmails = new Set(
    ((data ?? []) as { email: string }[]).map((r) => r.email)
  );
  return alumniEmails;
}

async function loadPendingInviteeIds(teamId: string): Promise<Set<string>> {
  const svc = await createServiceClient();
  // team_invitations not yet in generated types (migration 120)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("team_invitations")
    .select("invited_delegate_id")
    .eq("team_id", teamId)
    .eq("status", "pending");
  const rows =
    (data as unknown as { invited_delegate_id: string }[] | null) ?? [];
  return new Set(rows.map((r) => r.invited_delegate_id));
}

export default async function TeamDirectoryPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const me = await loadMe(session.id);
  if (!me) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <p className="text-navy/60 text-sm">Delegate record not found.</p>
      </div>
    );
  }

  const myTeam = me.team_members[0]?.teams ?? null;
  const myTeamSize = myTeam?.team_members.length ?? 0;
  const canInviteFromMyTeam =
    !!myTeam && !myTeam.is_frozen && myTeamSize < TEAM_SIZE_MAX;

  const [delegates, pendingInviteeIds] = await Promise.all([
    loadChapterDelegates(me.chapter_id, me.edition_id),
    myTeam ? loadPendingInviteeIds(myTeam.id) : Promise.resolve(new Set<string>()),
  ]);

  const alumniEmails = await loadAlumniEmails(delegates, me.edition_id);

  async function inviteAction(formData: FormData) {
    "use server";
    const toDelegateId = String(formData.get("to_delegate_id") ?? "");
    const teamId = String(formData.get("team_id") ?? "");
    const message = String(formData.get("message") ?? "").trim() || undefined;
    await sendInvite({ teamId, toDelegateId, message });
  }

  const others = delegates.filter((d) => d.id !== me.id);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Chapter directory
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {me.chapters?.name ?? "Your chapter"} · names only — reach out via
          chapter admin if you need contact details.
        </p>
        <div className="mt-2 text-xs text-navy/50">
          <Link
            href="/yi-future/me/team/invites"
            className="font-semibold text-navy hover:text-yi-gold"
          >
            View my invitations →
          </Link>
        </div>
      </div>

      {!myTeam && (
        <div className="bg-yi-saffron/10 border border-yi-saffron/30 rounded-lg p-4 text-sm">
          <div className="font-bold text-navy">Create a team first</div>
          <p className="mt-1 text-navy/70">
            You can&apos;t send invites until you&apos;re on a team.
          </p>
          <Link
            href="/yi-future/me/team"
            className="mt-2 inline-block px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
          >
            Go to my team
          </Link>
        </div>
      )}

      {myTeam && myTeam.is_frozen && (
        <div className="bg-navy/5 border border-navy/20 rounded-lg p-3 text-xs text-navy/70">
          Your team <span className="font-semibold">{myTeam.team_name}</span> is
          frozen. New invites can&apos;t be sent.
        </div>
      )}

      {myTeam && !myTeam.is_frozen && myTeamSize >= TEAM_SIZE_MAX && (
        <div className="bg-navy/5 border border-navy/20 rounded-lg p-3 text-xs text-navy/70">
          Your team is full ({TEAM_SIZE_MAX}/{TEAM_SIZE_MAX}). No more invites
          can be sent.
        </div>
      )}

      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-navy/10 bg-navy/5">
          <div className="text-xs font-bold uppercase tracking-widest text-navy/60">
            {others.length} other delegate{others.length === 1 ? "" : "s"} in
            your chapter
          </div>
        </div>

        {others.length === 0 ? (
          <p className="p-6 text-sm text-navy/50 italic text-center">
            No other delegates have registered yet in your chapter.
          </p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {others.map((d) => {
              const onTeam = d.team_members.length > 0;
              const alreadyInvited = pendingInviteeIds.has(d.id);
              const canSend =
                canInviteFromMyTeam && !onTeam && !alreadyInvited;
              const isAlumni = !!(d.email && alumniEmails.has(d.email));

              return (
                <li
                  key={d.id}
                  className="p-4 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-navy truncate">
                      {d.full_name}
                      {isAlumni && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full bg-[#F5A623]/15 text-[#F5A623] text-[9px] font-bold uppercase tracking-wider align-middle">
                          Alumni
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
                      {onTeam ? (
                        <span className="px-2 py-0.5 rounded-full bg-navy/10 text-navy/60">
                          On a team
                        </span>
                      ) : alreadyInvited ? (
                        <span className="px-2 py-0.5 rounded-full bg-yi-gold/15 text-yi-gold">
                          Invite pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-yi-green/10 text-yi-green">
                          Available
                        </span>
                      )}
                    </div>
                  </div>

                  {canSend && myTeam && (
                    <details className="shrink-0">
                      <summary className="cursor-pointer list-none px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark">
                        Invite to my team
                      </summary>
                      <form
                        action={inviteAction}
                        className="mt-2 w-72 max-w-[80vw] bg-white border border-navy/10 rounded-md p-3 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="team_id"
                          value={myTeam.id}
                        />
                        <input
                          type="hidden"
                          name="to_delegate_id"
                          value={d.id}
                        />
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-navy/60">
                          Optional message
                        </label>
                        <textarea
                          name="message"
                          rows={3}
                          maxLength={500}
                          placeholder={`Hi ${d.full_name.split(" ")[0]} — would you like to join ${myTeam.team_name}?`}
                          className="w-full px-2 py-1.5 border border-navy/20 rounded text-xs"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-md bg-yi-gold text-navy text-xs font-bold hover:bg-yi-gold/90"
                          >
                            Send invite
                          </button>
                        </div>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-navy/40 italic">
        Privacy: per programme rules, only delegate names are shown. Contact
        details stay with chapter admin.
      </p>
    </div>
  );
}
