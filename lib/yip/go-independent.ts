/**
 * "Go Independent" window rule (Director, 2026-07-01).
 *
 * A plain MP may switch themselves to Independent only UP TO the end of the
 * Committee (Bill Drafting) session. Once bill drafting is completed or skipped
 * — or the event has moved to day 2 / results — the switch is CLOSED, because
 * from bill presentation & voting onward party membership is fixed.
 *
 * Pure by design: each caller fetches the two inputs and passes them in, so the
 * SAME rule drives both the student-page render and the goIndependent server
 * action (no client/server drift). Enforcement still lives on the server.
 */
export const BILL_DRAFTING_SESSION_KEY = "committee_bill_drafting";

export function isGoIndependentClosed(
  eventStatus: string | null | undefined,
  billDraftingStatuses: Array<string | null | undefined>
): boolean {
  // By day 2 (bill presentation/voting) the window is definitively over, even
  // if the drafting item's own status wasn't explicitly advanced.
  if (eventStatus === "day2_live" || eventStatus === "results_published") {
    return true;
  }
  // Otherwise the switch closes once the drafting session has ended.
  return billDraftingStatuses.some((s) => s === "completed" || s === "skipped");
}
