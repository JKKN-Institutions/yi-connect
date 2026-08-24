"use client";

/**
 * The National ladder console — Quarter-Finals, Semi-Finals, Final.
 *
 * The stages rendered here are NOT hardcoded: whatever nationalLadder()
 * derived from the entrant count is what appears, in ladder order. A field of
 * four teams shows one card; a field of sixty-five shows three.
 *
 * Built for a phone first — 390px is the working width, so nothing sits in a
 * fixed-width table and every control row wraps. Junior and Senior are
 * separate championships: the switch is a link, so the board never holds two
 * categories' data at once.
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  declareNationalChampion,
  publishStageResults,
  recordStageScore,
  seedNationalRounds,
  type NationalBoard,
  type StageBoard,
} from "@/app/yiq/actions/national";
import type { NationalStanding } from "@/lib/yiq/national";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

const STATUS_TONE: Record<string, string> = {
  entered: "#6b7794",
  quarterfinal_qualified: GREEN,
  semifinal_qualified: GREEN,
  finalist: "#4a7fd4",
  runner_up: "#b08a4a",
  national_champion: SAFFRON,
  eliminated: "#6b7794",
};

const STATUS_LABEL: Record<string, string> = {
  entered: "Entered",
  quarterfinal_qualified: "Through the quarter-final",
  semifinal_qualified: "Through the semi-final",
  finalist: "Finalist",
  runner_up: "Runner-up",
  national_champion: "National champion",
  eliminated: "Eliminated",
};

export function NationalConsole({ board }: { board: NationalBoard }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [finalField, setFinalField] = useState(String(board.finalFieldSize));

  const { category } = board;

  function run(
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) {
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

  function applyFinalField() {
    const n = Number(finalField);
    if (!Number.isInteger(n) || n < 2 || n > 50) {
      toast.error("Choose between 2 and 50 teams for the Final.");
      return;
    }
    router.push(`${pathname}?category=${category}&finalField=${n}`);
  }

  const ladderShape =
    board.stages.map((s) => `${s.label} (${s.entering}→${s.advancing})`).join("  →  ") ||
    "no stages yet";

  return (
    <>
      {/* ---- The derived ladder ------------------------------------------ */}
      <section className="mt-8 rounded-2xl border p-5" style={{ borderColor: RULE }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="yiq-display text-[1.5rem]">The ladder</h2>
          <p className="yiq-eyebrow" style={{ color: DIM }}>
            {board.entrantCount} chapter champion
            {board.entrantCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mt-2 text-[0.875rem]" style={{ color: DIM }}>
          How many national stages run depends on how many teams entered. A
          large field runs all three; a small one goes straight to the Final.
        </p>

        {board.stages.length === 0 ? (
          <p className="mt-4 text-[0.9375rem]" style={{ color: SAFFRON }}>
            No chapter has crowned a {category} champion yet. Entries arrive
            automatically the moment a chapter crowns its team.
          </p>
        ) : (
          <ol className="mt-4 flex flex-wrap items-center gap-2">
            {board.stages.map((s, i) => (
              <li key={s.stage} className="flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden style={{ color: DIM }}>
                    →
                  </span>
                ) : null}
                <span
                  className="rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold"
                  style={{
                    background: s.published
                      ? "rgba(20,121,90,0.20)"
                      : "rgba(247,244,237,0.07)",
                    color: s.published ? "#7fd4b0" : PAPER,
                  }}
                >
                  {s.label}
                  <span className="yiq-data ml-2" style={{ color: DIM }}>
                    {s.entering}
                    {s.stage === "national_final" ? "" : `→${s.advancing}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="sr-only">{ladderShape}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label
            className="yiq-eyebrow flex-none"
            style={{ color: DIM }}
            htmlFor="yiq-final-field"
          >
            Teams in the Final
          </label>
          <input
            id="yiq-final-field"
            inputMode="numeric"
            value={finalField}
            onChange={(e) => setFinalField(e.target.value)}
            className="yiq-data w-20 flex-none rounded-lg border px-3 py-2 text-[0.9375rem]"
            style={{
              borderColor: RULE,
              background: "rgba(247,244,237,0.04)",
              color: PAPER,
            }}
          />
          <button
            onClick={applyFinalField}
            disabled={pending}
            className="flex-none rounded-full border px-4 py-2 text-[0.8125rem] font-semibold disabled:opacity-50"
            style={{ borderColor: RULE, color: PAPER }}
          >
            Re-shape ladder
          </button>
        </div>
      </section>

      {/* ---- One card per derived stage ---------------------------------- */}
      {board.stages.map((stage) => (
        <StageCard
          key={stage.stage}
          board={board}
          stage={stage}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          run={run}
        />
      ))}
    </>
  );
}

function StageCard({
  board,
  stage,
  drafts,
  setDrafts,
  pending,
  run,
}: {
  board: NationalBoard;
  stage: StageBoard;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  run: (
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) => void;
}) {
  const isFinal = stage.stage === "national_final";
  const { category, finalFieldSize } = board;
  const unscored = stage.standing.length - stage.scoredCount;

  function saveScore(row: NationalStanding) {
    const raw = (drafts[`${stage.stage}:${row.entryId}`] ?? "").trim();
    if (raw === "") {
      toast.error("Enter a score first.");
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("That is not a score.");
      return;
    }
    run(
      () => recordStageScore(row.entryId, stage.stage, value, finalFieldSize),
      `${row.teamName} · ${value}`
    );
  }

  return (
    <section
      className="mt-8 rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: stage.published ? "rgba(20,121,90,0.45)" : RULE }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="yiq-display text-[1.5rem]">{stage.label}</h2>
        <p className="yiq-eyebrow" style={{ color: DIM }}>
          {isFinal
            ? `${stage.entering} on stage`
            : `${stage.entering} in · ${stage.advancing} through`}
        </p>
      </div>

      {/* Rounds */}
      {stage.rounds.length === 0 ? (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: RULE }}>
          <p className="text-[0.875rem]" style={{ color: DIM }}>
            {isFinal
              ? "Six live rounds, the same structure as the chapter finals."
              : "A written narrowing paper — one round holds it, and it carries its own question set."}
          </p>
          <button
            onClick={() =>
              run(
                () => seedNationalRounds(category, stage.stage, finalFieldSize),
                `${stage.label} rounds created`
              )
            }
            disabled={pending}
            className="mt-3 w-full rounded-full px-4 py-3 text-[0.875rem] font-bold disabled:opacity-60 sm:w-auto"
            style={{ background: SAFFRON, color: INK }}
          >
            Create the rounds
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-1.5">
          {stage.rounds.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 text-[0.875rem]"
            >
              <span className="min-w-0 truncate">
                R{r.round_number} · {r.name}
              </span>
              <span className="yiq-eyebrow flex-none" style={{ color: DIM }}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Field */}
      {stage.standing.length === 0 ? (
        <p className="mt-5 text-[0.9375rem]" style={{ color: DIM }}>
          Nobody is standing in this stage yet — publish the stage before it
          and the qualifying teams appear here.
        </p>
      ) : (
        <ol className="mt-5 grid gap-2">
          {stage.standing.map((row) => {
            const key = `${stage.stage}:${row.entryId}`;
            const isChampion = row.teamId === board.championTeamId;
            return (
              <li
                key={row.entryId}
                className="rounded-xl px-4 py-3"
                style={{
                  background: isChampion
                    ? "rgba(232,163,61,0.18)"
                    : row.qualified && !isFinal
                      ? "rgba(20,121,90,0.12)"
                      : "rgba(247,244,237,0.05)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="yiq-data grid h-8 w-8 flex-none place-items-center rounded-lg text-[0.8125rem] font-bold"
                    style={
                      row.rank === 1 && row.scored
                        ? { background: SAFFRON, color: INK }
                        : { background: "rgba(247,244,237,0.08)", color: DIM }
                    }
                  >
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1rem] font-semibold">
                      {row.teamName}
                    </p>
                    <p className="truncate text-[0.8125rem]" style={{ color: DIM }}>
                      {row.chapterName}
                    </p>
                    <p
                      className="yiq-eyebrow mt-1"
                      style={{ color: STATUS_TONE[row.status] ?? DIM }}
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                      {row.tiedAtCut ? " · tied at the cut" : ""}
                    </p>
                  </div>
                  <span
                    className="yiq-data flex-none text-[1.125rem] font-bold"
                    style={{ color: row.scored ? PAPER : DIM }}
                  >
                    {row.scored ? row.liveTotal : "—"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    inputMode="decimal"
                    aria-label={`${stage.label} score for ${row.teamName}`}
                    placeholder={row.scored ? String(row.liveTotal) : "Score"}
                    value={drafts[key] ?? ""}
                    onChange={(ev) =>
                      setDrafts((d) => ({ ...d, [key]: ev.target.value }))
                    }
                    className="yiq-data min-w-0 flex-1 rounded-lg border px-3 py-2 text-[0.9375rem]"
                    style={{
                      borderColor: RULE,
                      background: "rgba(247,244,237,0.04)",
                      color: PAPER,
                    }}
                  />
                  <button
                    onClick={() => saveScore(row)}
                    disabled={pending}
                    className="flex-none rounded-full px-4 py-2 text-[0.8125rem] font-bold disabled:opacity-50"
                    style={{ background: GREEN, color: PAPER }}
                  >
                    Save
                  </button>
                  {isFinal && !board.championTeamId ? (
                    <button
                      onClick={() =>
                        run(
                          () =>
                            declareNationalChampion(
                              category,
                              row.teamId,
                              finalFieldSize
                            ),
                          `${row.teamName} crowned national champion`
                        )
                      }
                      disabled={pending}
                      className="flex-none rounded-full border px-3 py-2 text-[0.75rem] font-bold disabled:opacity-50"
                      style={{ borderColor: RULE, color: PAPER }}
                    >
                      Crown
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Publish (narrowing stages only — the Final is crowned, not cut) */}
      {!isFinal && stage.standing.length > 0 ? (
        <div className="mt-5 rounded-xl border p-4" style={{ borderColor: RULE }}>
          <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
            Publish the {stage.label.toLowerCase()}
          </p>
          <p className="mt-2 text-[0.875rem]" style={{ color: DIM }}>
            The top {stage.advancing} go through — and so does every team level
            with the last qualifier. A genuine tie is never dropped to hit a
            round number.
          </p>
          <button
            onClick={() =>
              run(
                () => publishStageResults(category, stage.stage, finalFieldSize),
                `${stage.label} result published`
              )
            }
            disabled={pending || unscored > 0}
            className="mt-3 w-full rounded-full px-4 py-3 text-[0.875rem] font-bold disabled:opacity-45 sm:w-auto"
            style={{ background: SAFFRON, color: INK }}
          >
            {stage.published ? "Re-publish result" : "Publish result"}
          </button>
          {unscored > 0 ? (
            <p className="mt-3 text-[0.8125rem]" style={{ color: SAFFRON }}>
              {unscored} team{unscored === 1 ? "" : "s"} still unscored —
              publishing is blocked until every score is in.
            </p>
          ) : null}
        </div>
      ) : null}

      {isFinal && board.championTeamId ? (
        <p className="mt-5 text-[0.875rem]" style={{ color: DIM }}>
          {board.championTeamName} is the {category === "junior" ? "Junior" : "Senior"}{" "}
          national champion. Runners-up and finalists are recorded against
          every team that stood on the national stage.
        </p>
      ) : null}
    </section>
  );
}
