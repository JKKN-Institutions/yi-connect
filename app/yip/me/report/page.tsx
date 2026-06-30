import { redirect } from "next/navigation";

// Committee Report REMOVED 2026-06-30 — per the YIP 2026 handbook the committee's
// deliverable is the BILL, not a report ("committee reports" appear only as an
// optional Laying-of-Papers formality, p.23). This route is retired: anyone
// landing here from an old bookmark/link is sent to their Committee Room to draft
// the bill directly. The report-client + committee_reports table remain dormant
// for a follow-up cleanup PR.
export default async function CommitteeReportPage() {
  redirect("/yip/me/committee");
}
