import type { MemberResult, TeamRollup } from "@/lib/yiq/scoring";

const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

function Table({
  title,
  rows,
  qualifyingCount,
  best,
}: {
  title: string;
  rows: TeamRollup[];
  qualifyingCount: number;
  best: MemberResult | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="yiq-display text-[1.375rem]">{title}</h3>
        <p className="yiq-eyebrow" style={{ color: DIM }}>
          Top {qualifyingCount} qualify
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-[0.875rem]" style={{ color: DIM }}>
          No teams registered in this category yet.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <thead>
                <tr className="yiq-eyebrow" style={{ color: DIM }}>
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Team</th>
                  <th className="py-2 pr-3 text-right font-medium">Score</th>
                  <th className="py-2 pr-3 text-right font-medium">Sat</th>
                  <th className="py-2 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.teamId}
                    style={{ borderTop: `1px solid ${RULE}` }}
                  >
                    <td className="py-2.5 pr-3">
                      <span
                        className="yiq-data inline-grid h-7 w-7 place-items-center rounded-lg text-[0.75rem] font-bold"
                        style={
                          t.qualified
                            ? { background: SAFFRON, color: "#0a1633" }
                            : { background: "rgba(247,244,237,0.08)", color: DIM }
                        }
                      >
                        {t.rank}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-[0.9375rem] font-semibold">
                      {t.teamName}
                    </td>
                    <td className="yiq-data py-2.5 pr-3 text-right text-[1rem] font-bold">
                      {t.totalScore}
                    </td>
                    <td
                      className="yiq-data py-2.5 pr-3 text-right text-[0.875rem]"
                      style={{
                        color:
                          t.membersAttempted < t.membersTotal ? SAFFRON : DIM,
                      }}
                    >
                      {t.membersAttempted}/{t.membersTotal}
                    </td>
                    <td
                      className="yiq-data py-2.5 text-right text-[0.875rem]"
                      style={{ color: DIM }}
                    >
                      {Math.round(t.totalTimeSeconds / 60)}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {best ? (
            <p
              className="mt-3 rounded-xl px-4 py-3 text-[0.875rem]"
              style={{ background: "rgba(20,121,90,0.16)", color: PAPER }}
            >
              <span className="yiq-eyebrow" style={{ color: GREEN }}>
                Best individual quizzer
              </span>
              <br />
              <strong>{best.studentName}</strong> · {best.score} points
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function Standings({
  junior,
  senior,
  bestJunior,
  bestSenior,
  qualifyingCount,
}: {
  junior: TeamRollup[];
  senior: TeamRollup[];
  bestJunior: MemberResult | null;
  bestSenior: MemberResult | null;
  qualifyingCount: number;
}) {
  return (
    <section className="mt-10 rounded-2xl border p-6" style={{ borderColor: RULE }}>
      <h2 className="yiq-display text-[1.75rem]">Online round standings</h2>
      <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
        A team&apos;s score is the total of its members&apos;. Ties are broken
        by total time, and a team level with the last qualifier on both is
        carried through rather than dropped.
      </p>
      <div className="mt-7 grid gap-9 lg:grid-cols-2">
        <Table
          title="Junior · Classes 9–10"
          rows={junior}
          qualifyingCount={qualifyingCount}
          best={bestJunior}
        />
        <Table
          title="Senior · Classes 11–12"
          rows={senior}
          qualifyingCount={qualifyingCount}
          best={bestSenior}
        />
      </div>
    </section>
  );
}
