import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getSpeakingFloor } from "@/app/yip/actions/speaking-floor";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Who Has Spoken — the floor's fairness ledger.
 *
 * The control panel's Speaking Floor card lists only the members on ZERO turns,
 * as chips in a small scrolling box. On Day 1 of the SRTN Regional round that
 * box held 65 names, which is not something a Chair can act on mid-sitting, and
 * there was no way at all to see who had spoken three or five times.
 *
 * The numbers that made this page necessary: 177 turns were taken across 185
 * eligible members — almost exactly one each — yet 65 members never spoke once,
 * because 45 members took 99 of the turns between them. The floor was never
 * short of turns. It was short of DISTRIBUTION, and nothing on screen showed
 * that while there was still time to fix it.
 *
 * Read-only. Turns are derived at read time by getSpeakingFloor (completed
 * Now-Speaking rows plus spoken hand-raises, one per occasion), never stored,
 * so this cannot drift from the board the Chair is calling from.
 */
export default async function WhoHasSpokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  // getEvent is the single source of truth for event view-access; a null event
  // means deny — render an explicit 403, never a silent redirect (rule 27).
  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's speaking record. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  const res = await getSpeakingFloor(id);
  if (!res.success) {
    return (
      <Forbidden403 reason={res.error} />
    );
  }

  const board = res.data.board;
  const eligible = board.length;
  const never = board.filter((m) => m.turns === 0);
  const once = board.filter((m) => m.turns === 1);
  const twice = board.filter((m) => m.turns === 2);
  const more = board.filter((m) => m.turns >= 3);
  const spoken = eligible - never.length;
  const totalTurns = board.reduce((sum, m) => sum + m.turns, 0);

  const benchCount = (side: string, list: typeof board) =>
    list.filter((m) => m.partySide === side).length;

  // The headline the Chair needs: how many turns are sitting with members who
  // already had one, expressed as the number of silent members they could cover.
  const surplus = board.reduce((s, m) => s + Math.max(0, m.turns - 1), 0);

  const groups = [
    {
      key: "never",
      title: "Not spoken yet",
      tone: "text-red-700 border-red-200 bg-red-50",
      chip: "border-red-200 bg-white text-red-800",
      list: never,
      note: "Call these members first — the queue already sorts them to the top.",
    },
    {
      key: "once",
      title: "Spoken once",
      tone: "text-emerald-700 border-emerald-200 bg-emerald-50",
      chip: "border-emerald-200 bg-white text-emerald-800",
      list: once,
      note: null,
    },
    {
      key: "twice",
      title: "Spoken twice",
      tone: "text-amber-700 border-amber-200 bg-amber-50",
      chip: "border-amber-200 bg-white text-amber-800",
      list: twice,
      note: null,
    },
    {
      key: "more",
      title: "Spoken three or more times",
      tone: "text-orange-800 border-orange-300 bg-orange-50",
      chip: "border-orange-300 bg-white text-orange-900",
      list: more,
      note: "Every extra turn here is a turn somebody above never got.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Speaking record
          </p>
          <h1 className="text-2xl font-bold">Who has spoken</h1>
        </div>
        <Link
          href={`/yip/dashboard/events/${id}/control`}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to control panel
        </Link>
      </div>

      {/* Headline counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={
            res.data.countsCheckedInOnly ? "Here today" : "Eligible to speak"
          }
          value={eligible}
        />
        <Stat label="Have spoken" value={spoken} tone="text-emerald-700" />
        <Stat label="Not spoken yet" value={never.length} tone="text-red-700" />
        <Stat label="Turns taken" value={totalTurns} />
      </div>

      {/* The distribution point, in words */}
      {never.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="py-4 text-sm">
            <p>
              <strong>{never.length}</strong>{" "}
              {never.length === 1 ? "member has" : "members have"} not spoken
              once, while <strong>{surplus}</strong>{" "}
              {surplus === 1 ? "turn has" : "turns have"} gone to members who
              already had one.
            </p>
            {surplus > 0 && (
              <p className="mt-1 text-muted-foreground">
                {surplus >= never.length
                  ? "Those spare turns alone would have covered every silent member."
                  : `Those spare turns would have covered ${surplus} of them.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <Card key={g.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-bold ${g.tone}`}
                  >
                    {g.title} — {g.list.length}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {benchCount("ruling", g.list)} ruling ·{" "}
                    {benchCount("opposition", g.list)} opposition
                  </span>
                </CardTitle>
                {g.note && (
                  <p className="text-xs text-muted-foreground">{g.note}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {g.list.map((m) => (
                    <span
                      key={m.participantId}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${g.chip}`}
                    >
                      {m.constituencyNumber != null && (
                        <span className="font-mono text-[10px] opacity-70">
                          #{m.constituencyNumber}
                        </span>
                      )}
                      {m.name}
                      {m.turns > 1 && (
                        <span className="font-bold">×{m.turns}</span>
                      )}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
      )}

      <p className="pb-6 text-xs text-muted-foreground">
        Counted from the Now Speaking desk and from hand-raises marked spoken —
        one turn per occasion. Presiding officers and duty officials
        (administrators, journalists) are never counted.{" "}
        {res.data.countsCheckedInOnly ? (
          <>
            These {eligible} are the members who checked in on day 1 — the
            arrival register. Anyone on the roster who never turned up is
            neither counted here nor listed as unheard, so every name is a
            member you can actually call.
          </>
        ) : (
          <>
            No day-1 check-in was recorded for this event, so this counts the
            whole speaking-eligible House.
          </>
        )}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className={`text-2xl font-bold tabular-nums ${tone ?? ""}`}>
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
