/**
 * Public feedback report — reached via an unguessable share token
 * (/yip/r/[token]). NO login: the token is the authorization. Names & emails
 * are stripped server-side in getPublicFeedbackReport() before rendering, so a
 * shared link never exposes a student's identity. An unknown or revoked token
 * shows a neutral "link no longer active" page.
 */
import type { Metadata } from "next";
import { getPublicFeedbackReport } from "@/app/yip/actions/feedback-share";
import { FeedbackReportBody } from "../../dashboard/events/[id]/feedback/_components/FeedbackReportBody";
import "../../dashboard/events/[id]/report/report-print.css";

export const metadata: Metadata = {
  title: "Feedback Report — Young Indians Parliament",
  robots: { index: false, follow: false }, // never index a shared PII-adjacent link
};

export default async function PublicFeedbackReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicFeedbackReport(token);

  if (!report) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "#FBF9F4", color: "#20241B" }}
      >
        <div className="flex h-1.5 w-40 overflow-hidden rounded-full">
          <span className="flex-1" style={{ background: "#E8842B" }} />
          <span className="flex-1" style={{ background: "#FFFFFF" }} />
          <span className="flex-1" style={{ background: "#2E7D46" }} />
        </div>
        <h1
          className="mt-6 text-2xl font-bold"
          style={{ fontFamily: "Georgia, serif" }}
        >
          This link is no longer active
        </h1>
        <p className="mt-2 max-w-md text-sm" style={{ color: "#57584C" }}>
          The feedback report link you opened has been revoked or is invalid.
          Please ask the event organizer for an up-to-date link.
        </p>
      </div>
    );
  }

  return (
    <main style={{ background: "#FBF9F4", minHeight: "100vh" }}>
      <FeedbackReportBody
        eventName={report.eventName}
        day1Date={report.day1Date}
        stats={report.stats}
        rows={report.rows}
      />
    </main>
  );
}
