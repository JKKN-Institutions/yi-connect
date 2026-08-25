"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  declareChampion,
  recordFinalsScore,
  seedFinalsRounds,
  setFinalsRoundStatus,
  undoLastFinalsScore,
} from "@/app/yiq/actions/finals";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const VERMILION = "#c8452f";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

type Round = {
  id: string;
  name: string;
  round_number: number;
  round_type: string;
  status: string;
  points_correct: number;
  points_pass_bonus: number;
  time_limit_seconds: number | null;
};

type Team = {
  id: string;
  name: string;
  school: string;
  onlineRank: number | null;
  total: number;
};

const OUTCOMES = [
  { key: "correct", label: "Correct", colour: GREEN },
  { key: "bonus", label: "Bonus", colour: SAFFRON },
  { key: "passed", label: "Passed", colour: "#6b7794" },
  { key: "wrong", label: "Wrong", colour: VERMILION },
] as const;

export function FinalsConsole({
  eventId,
  category,
  rounds,
  teams,
  championId,
  canManage,
}: {
  eventId: string;
  category: "junior" | "senior";
  rounds: Round[];
  teams: Team[];
  championId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const live = rounds.find((r) => r.status === "live") ?? null;
  const ranked = [...teams].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error ?? "That didn't work.");
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  // ---------------------------------------------------------------- setup
  if (rounds.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border p-6" style={{ borderColor: RULE }}>
        <h2 className="yiq-display text-[1.5rem]">No rounds yet</h2>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          Create the six standard rounds — Direct, Pass-On, Visual, Audio,
          Rapid Fire and the India Challenge — with their default points.
        </p>
        {canManage ? (
          <button
            onClick={() =>
              run(() => seedFinalsRounds(eventId, category), "Six rounds created")
            }
            disabled={pending}
            className="mt-5 rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-60"
            style={{ background: SAFFRON, color: INK }}
          >
            {pending ? "Creating…" : "Create the six rounds"}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {/* ---- Rounds strip ------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="yiq-display text-[1.5rem]">Rounds</h2>
        <ul className="mt-4 grid gap-2">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: r.status === "live" ? SAFFRON : RULE,
                background: r.status === "live" ? "rgba(232,163,61,0.10)" : undefined,
              }}
            >
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-bold">
                  R{r.round_number} · {r.name}
                </p>
                <p className="yiq-eyebrow mt-0.5" style={{ color: DIM }}>
                  {r.points_correct} pts
                  {Number(r.points_pass_bonus) > 0
                    ? ` · ${r.points_pass_bonus} bonus on pass`
                    : " · no passing"}
                  {r.time_limit_seconds ? ` · ${r.time_limit_seconds}s` : ""}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  {r.status !== "live" ? (
                    <button
                      onClick={() =>
                        run(
                          () => setFinalsRoundStatus(eventId, r.id, "live"),
                          `R${r.round_number} is live`
                        )
                      }
                      disabled={pending}
                      className="rounded-full px-4 py-2 text-[0.8125rem] font-bold disabled:opacity-60"
                      style={{ background: SAFFRON, color: INK }}
                    >
                      Go live
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        run(
                          () => setFinalsRoundStatus(eventId, r.id, "complete"),
                          `R${r.round_number} closed`
                        )
                      }
                      disabled={pending}
                      className="rounded-full px-4 py-2 text-[0.8125rem] font-bold disabled:opacity-60"
                      style={{ background: GREEN, color: PAPER }}
                    >
                      Close round
                    </button>
                  )}
                </div>
              ) : (
                <span className="yiq-eyebrow" style={{ color: DIM }}>
                  {r.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Scoring pad -------------------------------------------------- */}
      {canManage ? (
        <section className="mt-9 rounded-2xl border p-6" style={{ borderColor: RULE }}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="yiq-display text-[1.5rem]">Score</h2>
            {live ? (
              <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
                R{live.round_number} · {live.name}
              </p>
            ) : null}
          </div>

          {!live ? (
            <p className="mt-3 text-[0.9375rem]" style={{ color: DIM }}>
              Put a round live above, then tap a team and the outcome.
            </p>
          ) : (
            <>
              <p className="mt-2 text-[0.875rem]" style={{ color: DIM }}>
                Tap the team, then the outcome. Every tap is a new row — undo
                removes the last one rather than editing history.
              </p>

              <ul className="mt-4 flex flex-wrap gap-2">
                {ranked.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() =>
                        setSelectedTeam((s) => (s === t.id ? null : t.id))
                      }
                      className="rounded-xl px-4 py-3 text-left text-[0.875rem] font-semibold"
                      style={
                        selectedTeam === t.id
                          ? { background: SAFFRON, color: INK }
                          : { background: "rgba(247,244,237,0.07)", color: PAPER }
                      }
                    >
                      {t.name}
                      <span
                        className="yiq-data ml-2 font-bold"
                        style={{ color: selectedTeam === t.id ? INK : DIM }}
                      >
                        {t.total}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.key}
                    disabled={!selectedTeam || pending}
                    onClick={() =>
                      run(
                        () =>
                          recordFinalsScore({
                            chapterEventId: eventId,
                            finalsRoundId: live.id,
                            teamId: selectedTeam!,
                            outcome: o.key,
                          }),
                        `${o.label} recorded`
                      )
                    }
                    className="rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-35"
                    style={{ background: o.colour, color: o.key === "bonus" ? INK : PAPER }}
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => undoLastFinalsScore(eventId, live.id),
                      "Last score undone"
                    )
                  }
                  className="rounded-full border px-5 py-3 text-[0.875rem] font-semibold disabled:opacity-40"
                  style={{ borderColor: RULE, color: PAPER }}
                >
                  Undo last
                </button>
              </div>

              {!selectedTeam ? (
                <p className="mt-3 text-[0.8125rem]" style={{ color: DIM }}>
                  Pick a team first.
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* ---- Standing + champion ----------------------------------------- */}
      <section className="mt-9 rounded-2xl border p-6" style={{ borderColor: RULE }}>
        <h2 className="yiq-display text-[1.5rem]">Standing</h2>
        {ranked.length === 0 ? (
          <p className="mt-3 text-[0.9375rem]" style={{ color: DIM }}>
            No qualified teams yet — publish the online-round standings first,
            which marks the top teams as qualified.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2">
            {ranked.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3"
                style={{
                  background:
                    t.id === championId
                      ? "rgba(232,163,61,0.18)"
                      : "rgba(247,244,237,0.05)",
                }}
              >
                <span
                  className="yiq-data grid h-9 w-9 flex-none place-items-center rounded-lg text-[0.875rem] font-bold"
                  style={
                    i === 0
                      ? { background: SAFFRON, color: INK }
                      : { background: "rgba(247,244,237,0.08)", color: DIM }
                  }
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1rem] font-semibold">
                    {t.name}
                    {t.id === championId ? (
                      <span className="yiq-eyebrow ml-2" style={{ color: SAFFRON }}>
                        Champion
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[0.8125rem]" style={{ color: DIM }}>
                    {t.school}
                    {t.onlineRank ? ` · online #${t.onlineRank}` : ""}
                  </p>
                </div>
                <span className="yiq-data text-[1.25rem] font-bold">{t.total}</span>
                {canManage && !championId ? (
                  <button
                    onClick={() =>
                      run(
                        () => declareChampion(eventId, category, t.id),
                        `${t.name} crowned champion`
                      )
                    }
                    disabled={pending}
                    className="rounded-full border px-3 py-1.5 text-[0.75rem] font-bold disabled:opacity-50"
                    style={{ borderColor: RULE, color: PAPER }}
                  >
                    Crown
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {championId ? (
          <p className="mt-4 text-[0.875rem]" style={{ color: DIM }}>
            The champion team is entered into the National Grand Finale
            automatically. One chapter, one champion team, direct to nationals.
          </p>
        ) : null}
      </section>
    </>
  );
}
