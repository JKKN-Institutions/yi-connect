/**
 * YIP Feedback Report (organizer view) — the committee-facing analysis of an
 * event's feedback. Renders the shared <FeedbackReportBody> WITH names, plus an
 * organizer-only <ShareLinkPanel> to mint a public, no-login, no-names share
 * link for people without platform accounts.
 *
 * Gate: organizer-only (canManage), explicit Forbidden403 — never a silent
 * redirect. Printing reuses the #yip-report machinery inside the body.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getFeedbackStats, listFeedback } from "@/app/yip/actions/feedback";
import { getFeedbackShareToken } from "@/app/yip/actions/feedback-share";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { FeedbackReportBody } from "../_components/FeedbackReportBody";
import { ShareLinkPanel } from "../_components/ShareLinkPanel";

export const metadata: Metadata = {
  title: "Feedback Report — YIP",
};

export default async function FeedbackReportPage({
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

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only this event's organizers can open the feedback report. If you believe you should have access, contact your chapter chair." />
    );
  }

  const event = await getEvent(id);
  if (!event) {
    return <Forbidden403 reason="Event not found or outside your scope." />;
  }

  const [stats, rows, shareToken] = await Promise.all([
    getFeedbackStats(id),
    listFeedback(id),
    getFeedbackShareToken(id),
  ]);

  return (
    <div>
      <div className="mx-auto max-w-4xl px-6 pt-4 print:hidden">
        <ShareLinkPanel
          eventId={id}
          initialToken={shareToken.success ? shareToken.data : null}
        />
      </div>
      <FeedbackReportBody
        eventName={event.name}
        day1Date={event.day1_date ?? null}
        stats={stats}
        rows={rows}
      />
    </div>
  );
}
