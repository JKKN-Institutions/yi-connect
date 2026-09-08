import Link from "next/link";
import { ChevronRight, HelpCircle } from "lucide-react";
import { getMyQuestionStatus } from "@/app/yip/actions/questions";
import { timeLeftLabel } from "@/lib/yip/question-window";
import { SectionShell, INK, SAFFRON, inkA } from "./credential-ui";

/**
 * QuestionNudgeCard — "you haven't tabled a question yet" on My Desk.
 *
 * Question Hour opens and closes on the event row and nothing on the member's
 * home said so. On the SRTN regional round the window was one 5.5-hour weekday
 * slot; 137 of 196 members never tabled a question, and the platform never once
 * told them there was a window at all, let alone that it was running out.
 *
 * Self-hiding, like LiveNowCard and SpeakCard: renders ONLY while the window is
 * genuinely open and this member still has questions left to table. Silent for
 * anyone who has used all three, and silent before the window opens or after it
 * shuts — a closed window needs no nudge, it needs the organiser to widen it.
 *
 * In-app only. Sends nothing.
 */
export async function QuestionNudgeCard() {
  const status = await getMyQuestionStatus();

  // Not a participant, or the read failed → say nothing at all. Never fall
  // through to "the window is open".
  if (!status) return null;
  if (status.state !== "open") return null;
  if (status.remaining <= 0) return null;

  const untabled = status.submittedCount === 0;
  const left = timeLeftLabel(status.closeAt);

  return (
    <Link href="/yip/me/questions" className="block">
      <SectionShell
        accent={SAFFRON}
        className="transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${SAFFRON}1f`, color: "#b56a1f" }}
          >
            <HelpCircle className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "#b56a1f" }}
            >
              Question Hour is open
            </p>
            <p className="text-base font-bold" style={{ color: INK }}>
              {untabled
                ? "You haven't asked a question yet"
                : `You can still ask ${status.remaining} more`}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: inkA(0.6) }}>
              {untabled
                ? "Put a question to a Cabinet Minister — every member may table up to three."
                : `${status.submittedCount} of ${status.maxPerParticipant} tabled.`}
              {left ? ` ${left}.` : ""}
            </p>
          </div>

          <ChevronRight
            className="size-5 shrink-0"
            style={{ color: inkA(0.35) }}
          />
        </div>
      </SectionShell>
    </Link>
  );
}
