import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { respondInvite } from "@/app/yi-future/actions/team-invites";

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
      "id, status, message, created_at, responded_at, teams(id, team_name, chapter_id, chapters(name)), invited_by_delegate:delegates!team_invitations_invited_by_fkey(full_name)"
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

  const [incoming, outgoing] = await Promise.all([
    loadIncoming(session.id),
    loadOutgoing(session.id),
  ]);

  async function acceptAction(formData: FormData) {
    "use server";
    const id = String(formData.get("invite_id") ?? "");
    await respondInvite(id, "accepted");
  }

  async function declineAction(formData: FormData) {
    "use server";
    const id = String(formData.get("invite_id") ?? "");
    await respondInvite(id, "declined");
  }

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
                  <StatusBadge status={inv.status} />
                </div>
                {inv.message && (
                  <p className="text-sm text-navy/70 italic border-l-2 border-yi-gold/40 pl-3">
                    “{inv.message}”
                  </p>
                )}
                {inv.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <form action={acceptAction}>
                      <input type="hidden" name="invite_id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-md bg-yi-green text-ivory text-xs font-bold hover:opacity-90"
                      >
                        Accept
                      </button>
                    </form>
                    <form action={declineAction}>
                      <input type="hidden" name="invite_id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-md border border-navy/20 text-navy text-xs font-semibold hover:bg-navy/5"
                      >
                        Decline
                      </button>
                    </form>
                  </div>
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
                  <StatusBadge status={inv.status} />
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
