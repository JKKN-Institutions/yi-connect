import { Award, EyeOff, Info, Users } from "lucide-react";
import { getEvent } from "@/app/yip/actions/events";
import { getChapterRecognition } from "@/app/yip/actions/chapter-recognition";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import type {
  ChapterPerformerStanding,
  ChapterRecognition,
} from "@/lib/yip/chapter-recognition";

/**
 * Best Chapter Performer — the organiser's verification screen.
 *
 * ORGANISER-ONLY (Director ruling, 2026-08-29). The ranked five exists so the
 * people running the round can check the designation before it is read out.
 * Students and the room see the single name and nothing else — publishing a
 * ranked list of minors would break the platform's no-ranking rule — so this
 * page is gated on canManage and says plainly what must not leave it.
 */

const INK = "#1a1a3e";
const SAFFRON = "#FF9933";
const GREEN = "#138808";

/** An empty state that explains itself and says what to do next. */
function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#1a1a3e]/15 bg-white p-8 text-center">
      <Info className="mx-auto mb-3 size-6 text-[#1a1a3e]/30" />
      <p className="text-sm font-semibold text-[#1a1a3e]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#1a1a3e]/60">{body}</p>
    </div>
  );
}

function StandingRow({ standing }: { standing: ChapterPerformerStanding }) {
  const { isBestChapterPerformer: isWinner, holdsExistingAward } = standing;

  return (
    <tr
      className={
        isWinner ? "bg-[#138808]/5" : "border-t border-[#1a1a3e]/5"
      }
    >
      <td className="px-3 py-2 text-sm tabular-nums text-[#1a1a3e]/50">
        {standing.position}
      </td>
      <td className="px-3 py-2 text-sm text-[#1a1a3e]">
        <span className={isWinner ? "font-semibold" : undefined}>
          {standing.participantName ?? "Unnamed participant"}
        </span>
        {isWinner ? (
          <span className="ml-2 rounded bg-[#138808]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#138808]">
            Best Chapter Performer
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-sm text-[#1a1a3e]/60">
        {holdsExistingAward ? (
          // Say WHY a higher-placed name was passed over, so the designation
          // never looks arbitrary to the organiser checking it.
          <span title={standing.awardLabels.join(", ")}>
            Already awarded
            {standing.awardLabels.length > 0
              ? ` — ${standing.awardLabels.join(", ")}`
              : ""}
          </span>
        ) : (
          <span className="text-[#1a1a3e]/30">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-[#1a1a3e]/70">
        {standing.score === null ? "—" : standing.score.toFixed(2)}
      </td>
    </tr>
  );
}

function ChapterCard({ chapter }: { chapter: ChapterRecognition }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#1a1a3e]/10 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1a1a3e]/5 px-4 py-3">
        <h2 className="text-base font-semibold text-[#1a1a3e]">
          {chapter.chapterName ?? `Chapter ${chapter.chapterId}`}
        </h2>
        <span className="text-xs text-[#1a1a3e]/50">
          {chapter.eligibleMemberCount} ranked member
          {chapter.eligibleMemberCount === 1 ? "" : "s"}
        </span>
      </header>

      {chapter.winner ? (
        <div className="flex items-center gap-3 border-b border-[#1a1a3e]/5 bg-[#138808]/5 px-4 py-3">
          <Award className="size-5 shrink-0" style={{ color: GREEN }} />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#138808]">
              Best Chapter Performer
            </p>
            <p className="text-sm font-semibold text-[#1a1a3e]">
              {chapter.winner.participantName ?? "Unnamed participant"}
            </p>
          </div>
        </div>
      ) : (
        <div className="border-b border-[#1a1a3e]/5 bg-[#FF9933]/5 px-4 py-3 text-sm text-[#1a1a3e]/70">
          {chapter.noWinnerReason === "all-eligible-members-already-awarded"
            ? "No Best Chapter Performer — every ranked member of this chapter already holds one of the awards. This recognition exists to reach someone new, so it is left unassigned."
            : "No Best Chapter Performer — this chapter has no ranked, marked members."}
        </div>
      )}

      {chapter.topFive.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[#1a1a3e]/40">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Existing award</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {chapter.topFive.map((standing) => (
              <StandingRow key={standing.participantId} standing={standing} />
            ))}
          </tbody>
        </table>
      ) : null}

      {/* The designation can fall past fifth place when every leader already
          holds an award. Show it rather than letting the table contradict the
          banner above. */}
      {chapter.winner &&
      !chapter.topFive.some((s) => s.isBestChapterPerformer) ? (
        <p className="border-t border-[#1a1a3e]/5 px-4 py-2 text-xs text-[#1a1a3e]/50">
          The designated performer places {chapter.winner.position} in this
          chapter — everyone above already holds an award.
        </p>
      ) : null}
    </section>
  );
}

export default async function ChapterRecognitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or your role may not cover this event's chapter or region." />
    );
  }

  // Organiser-and-above only: this screen shows a ranked shortlist of minors.
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="The chapter recognition shortlist is visible to the organising team for this event only." />
    );
  }

  const view = await getChapterRecognition(id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: INK }}>
          Best Chapter Performer
        </h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">
          One member recognised per chapter, alongside the awards — not instead
          of them. A member who already holds an award stands aside so the
          recognition reaches someone new.
        </p>
      </div>

      {/* Stated on the page itself, not just in the docs: the ranked five is a
          working list for the organising team and must not be shown to the room. */}
      <div
        className="flex items-start gap-3 rounded-xl border-l-[3px] bg-white p-4"
        style={{ borderLeftColor: SAFFRON }}
      >
        <EyeOff className="mt-0.5 size-4 shrink-0" style={{ color: SAFFRON }} />
        <p className="text-sm text-[#1a1a3e]/75">
          <span className="font-semibold text-[#1a1a3e]">
            Organising team only.
          </span>{" "}
          The ranked five is here so you can check the designation before it is
          announced. Do not show it to participants, project it, or share it —
          students see the single name for their chapter and nothing else.
        </p>
      </div>

      {view.state === "forbidden" ? (
        <EmptyState
          title="Not available for your role"
          body="Your role does not include this event's results."
        />
      ) : null}

      {view.state === "no-results" ? (
        <EmptyState
          title="No results computed yet"
          body="Run scoring for this event first. The recognition reads the computed results — it does not score anyone itself."
        />
      ) : null}

      {view.state === "chapters-not-assigned" ? (
        <EmptyState
          title="Assign chapters first"
          body="No participant in this event carries a Yi chapter yet, so there is nothing to group by. This is not the same as nobody qualifying — once chapters are assigned, the recognition appears here."
        />
      ) : null}

      {view.state === "ok" ? (
        <>
          {!view.scoresVisible ? (
            <p className="text-xs text-[#1a1a3e]/50">
              Marks are hidden for your role — the order and the designated name
              are shown, the numbers are not.
            </p>
          ) : null}

          <div className="space-y-4">
            {view.result.chapters.map((chapter) => (
              <ChapterCard key={chapter.chapterId} chapter={chapter} />
            ))}
          </div>

          {/* Counts of what was left out, so a short page is never mistaken for
              a complete one. */}
          {view.result.unassignedMemberCount > 0 ||
          view.result.ineligibleMemberCount > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-[#1a1a3e]/10 bg-white p-4">
              <Users className="mt-0.5 size-4 shrink-0 text-[#1a1a3e]/40" />
              <div className="text-sm text-[#1a1a3e]/60">
                {view.result.unassignedMemberCount > 0 ? (
                  <p>
                    {view.result.unassignedMemberCount} member
                    {view.result.unassignedMemberCount === 1 ? "" : "s"} carry no
                    chapter and were not grouped.
                  </p>
                ) : null}
                {view.result.ineligibleMemberCount > 0 ? (
                  <p>
                    {view.result.ineligibleMemberCount} member
                    {view.result.ineligibleMemberCount === 1 ? "" : "s"} were not
                    ranked by the House (no marks, or incomplete attendance) and
                    cannot be recognised.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
