"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface TeamInfo {
  id: string;
  team_name: string;
  problem_title: string | null;
  member_names: string[];
}

interface TeamEvalSummary {
  scoredCount: number;
  submittedCount: number;
  scores: number[];
}

interface LiveTeamDashboardProps {
  teams: TeamInfo[];
  evalByTeam: Record<string, TeamEvalSummary>;
  juryCount: number;
  eventId: string;
}

/* ─── Timer logic (inline — avoids importing from yip) ──────────────── */

function useCountdown(endTime: Date | null) {
  const compute = useCallback(() => {
    if (!endTime) return 0;
    return Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 1000));
  }, [endTime]);

  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    if (!endTime) return;
    const interval = setInterval(() => {
      const r = compute();
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [endTime, compute]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return {
    remaining,
    display: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    isExpired: endTime !== null && remaining <= 0,
    isActive: endTime !== null && remaining > 0,
  };
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function LiveTeamDashboard({
  teams,
  evalByTeam,
  juryCount,
  eventId,
}: LiveTeamDashboardProps) {
  const [currentTeamIdx, setCurrentTeamIdx] = useState<number | null>(null);
  const [timerEnd, setTimerEnd] = useState<Date | null>(null);
  const [durationMin, setDurationMin] = useState(15);
  const [showScores, setShowScores] = useState(false);

  const timer = useCountdown(timerEnd);
  const currentTeam = currentTeamIdx !== null ? teams[currentTeamIdx] : null;

  function startPresentation(idx: number) {
    setCurrentTeamIdx(idx);
    setTimerEnd(new Date(Date.now() + durationMin * 60 * 1000));
    setShowScores(false);
  }

  function stopTimer() {
    setTimerEnd(null);
  }

  function nextTeam() {
    if (currentTeamIdx === null) {
      startPresentation(0);
    } else if (currentTeamIdx < teams.length - 1) {
      startPresentation(currentTeamIdx + 1);
    } else {
      // End of all presentations
      setCurrentTeamIdx(null);
      setTimerEnd(null);
    }
  }

  return (
    <>
      {/* Timer & current presenter */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-navy">
            Team Presentations
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-navy/50">Duration (min):</label>
            <input
              type="number"
              min={1}
              max={60}
              value={durationMin}
              onChange={(e) =>
                setDurationMin(Math.max(1, parseInt(e.target.value) || 15))
              }
              className="w-16 px-2 py-1 border border-navy/20 rounded text-center font-mono text-sm"
            />
          </div>
        </div>

        {/* Current presenter card */}
        {currentTeam ? (
          <div className="bg-yi-gold/10 border-2 border-yi-gold rounded-lg p-5 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold tracking-widest uppercase text-yi-gold/80 mb-1">
                  Now presenting &middot; Team {(currentTeamIdx ?? 0) + 1} of{" "}
                  {teams.length}
                </div>
                <h4 className="text-xl font-bold text-navy">
                  {currentTeam.team_name}
                </h4>
                {currentTeam.problem_title && (
                  <p className="text-sm text-navy/60 mt-1">
                    {currentTeam.problem_title}
                  </p>
                )}
                {currentTeam.member_names.length > 0 && (
                  <p className="text-xs text-navy/40 mt-1">
                    {currentTeam.member_names.join(", ")}
                  </p>
                )}
              </div>
              {/* Timer */}
              <div className="text-right">
                <div
                  className={`text-4xl font-mono font-bold tabular-nums ${
                    timer.isExpired
                      ? "text-red-600 animate-pulse"
                      : timer.remaining <= 60
                        ? "text-yi-saffron"
                        : "text-navy"
                  }`}
                >
                  {timer.display}
                </div>
                <div className="text-[10px] text-navy/40 mt-1">
                  {timer.isExpired
                    ? "Time up"
                    : timer.isActive
                      ? "remaining"
                      : "paused"}
                </div>
              </div>
            </div>

            {/* Scoring progress for current team */}
            {(() => {
              const ev = evalByTeam[currentTeam.id];
              const scored = ev?.scoredCount ?? 0;
              const submitted = ev?.submittedCount ?? 0;
              return (
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-navy/60">Jury scored:</span>
                    <span
                      className={`text-sm font-bold ${
                        scored >= juryCount && juryCount > 0
                          ? "text-yi-green"
                          : "text-navy"
                      }`}
                    >
                      {scored}/{juryCount}
                    </span>
                    {scored > 0 && submitted < scored && (
                      <span className="text-[10px] bg-yi-gold/15 text-yi-gold px-1.5 py-0.5 rounded">
                        {scored - submitted} draft
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {juryCount > 0 && (
                    <div className="flex-1 h-2 bg-navy/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yi-green rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (scored / juryCount) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Controls */}
            <div className="mt-4 flex gap-2">
              {timer.isActive ? (
                <button
                  onClick={stopTimer}
                  className="px-3 py-1.5 rounded-md border border-navy/20 text-xs font-semibold text-navy hover:border-navy/40"
                >
                  Pause timer
                </button>
              ) : (
                <button
                  onClick={() =>
                    setTimerEnd(
                      new Date(Date.now() + durationMin * 60 * 1000)
                    )
                  }
                  className="px-3 py-1.5 rounded-md bg-yi-gold text-white text-xs font-semibold hover:bg-yi-gold/90"
                >
                  Restart timer
                </button>
              )}
              <button
                onClick={nextTeam}
                className="px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
              >
                {currentTeamIdx !== null &&
                currentTeamIdx < teams.length - 1
                  ? "Next team →"
                  : "End presentations"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-navy/5 border border-navy/10 rounded-lg p-5 text-center mb-4">
            <p className="text-sm text-navy/60 mb-3">
              No team currently presenting.
            </p>
            <button
              onClick={() => startPresentation(0)}
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Start first presentation
            </button>
          </div>
        )}

        {/* All teams list */}
        <div className="space-y-2">
          {teams.map((team, idx) => {
            const ev = evalByTeam[team.id];
            const scored = ev?.scoredCount ?? 0;
            const isCurrent = idx === currentTeamIdx;
            const isPast =
              currentTeamIdx !== null && idx < currentTeamIdx;

            return (
              <div
                key={team.id}
                className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                  isCurrent
                    ? "bg-yi-gold/10 border-2 border-yi-gold"
                    : isPast
                      ? "border-navy/10 bg-navy/[0.02] opacity-60"
                      : "border-navy/10 hover:border-navy/20"
                }`}
              >
                {/* Order number */}
                <span
                  className={`text-lg font-black w-8 text-center ${
                    isCurrent ? "text-yi-gold" : "text-navy/20"
                  }`}
                >
                  {idx + 1}
                </span>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-navy text-sm">
                    {team.team_name}
                  </span>
                  {team.problem_title && (
                    <span className="text-xs text-navy/50 ml-2 hidden sm:inline">
                      {team.problem_title}
                    </span>
                  )}
                </div>

                {/* Scoring indicator */}
                <div className="shrink-0">
                  {scored >= juryCount && juryCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yi-green/10 text-yi-green">
                      <span>&#10003;</span>
                      {scored}/{juryCount}
                    </span>
                  ) : scored > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yi-gold/10 text-yi-gold">
                      {scored}/{juryCount}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-navy/5 text-navy/50">
                      0/{juryCount}
                    </span>
                  )}
                </div>

                {/* Start button (only for non-current teams) */}
                {!isCurrent && (
                  <button
                    onClick={() => startPresentation(idx)}
                    className="shrink-0 text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Start &rarr;
                  </button>
                )}
                {isCurrent && (
                  <span className="shrink-0 text-[10px] font-semibold text-yi-gold">
                    &#9679; LIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Score reveal */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-navy">Score Summary</h3>
          <button
            onClick={() => setShowScores(!showScores)}
            className="text-xs font-semibold text-navy hover:text-yi-gold"
          >
            {showScores ? "Hide scores" : "Reveal scores"}
          </button>
        </div>

        {showScores ? (
          <div className="space-y-2">
            {teams
              .map((team) => {
                const ev = evalByTeam[team.id];
                const scores = ev?.scores ?? [];
                const avg =
                  scores.length > 0
                    ? scores.reduce((a, b) => a + b, 0) / scores.length
                    : 0;
                return { ...team, scores, avg, scored: ev?.scoredCount ?? 0 };
              })
              .sort((a, b) => b.avg - a.avg)
              .map((team, rank) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-3 p-3 rounded-md border ${
                    rank === 0 && team.avg > 0
                      ? "border-yi-gold bg-yi-gold/5"
                      : "border-navy/10"
                  }`}
                >
                  <span
                    className={`text-lg font-black w-8 text-center ${
                      rank === 0 && team.avg > 0
                        ? "text-yi-gold"
                        : "text-navy/30"
                    }`}
                  >
                    #{rank + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-navy text-sm">
                      {team.team_name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {team.scored > 0 ? (
                      <>
                        <span className="text-lg font-bold text-navy tabular-nums">
                          {team.avg.toFixed(1)}
                        </span>
                        <span className="text-xs text-navy/40 ml-1">
                          avg ({team.scored} jury)
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-navy/40">
                        No scores yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-navy/50 text-center py-4">
            Scores are hidden. Click &quot;Reveal scores&quot; when ready.
          </p>
        )}
      </section>
    </>
  );
}
