/**
 * The rules for a chapter admin's decision on a Yi-Future submission, and the
 * words of the notice a team gets when a phase is sent back.
 *
 * Kept free of imports so it can be run and checked on its own, without the
 * app around it.
 *
 * Why a reason is required: on production, five of the six rejected
 * submissions carried no feedback at all. The team saw "rejected" and nothing
 * it could act on.
 */

export type ReviewDecision = "approved" | "rejected";

/** Shortest reason accepted for sending work back. "no" or "redo" is not
 *  something a team can act on. */
export const MIN_REJECTION_REASON_LENGTH = 10;

export type ReviewFeedbackCheck =
  | { ok: true; feedback: string | null }
  | { ok: false; error: string };

/**
 * Checks the note that goes with a review decision.
 *  - Reject: the trimmed reason must be at least MIN_REJECTION_REASON_LENGTH
 *    characters, otherwise a plain sentence saying what is missing.
 *  - Approve: the note stays optional.
 * On success returns the trimmed note to store (null when there is none).
 */
export function checkReviewFeedback(
  decision: ReviewDecision,
  feedback: string | null | undefined
): ReviewFeedbackCheck {
  // A server action can be called with anything, so never assume a string.
  const text = typeof feedback === "string" ? feedback.trim() : "";

  if (decision === "rejected") {
    if (text.length === 0) {
      return {
        ok: false,
        error:
          "Write a reason before sending this back. The team needs to know what to fix.",
      };
    }
    if (text.length < MIN_REJECTION_REASON_LENGTH) {
      return {
        ok: false,
        error: `That reason is too short. Write at least ${MIN_REJECTION_REASON_LENGTH} characters so the team knows what to fix.`,
      };
    }
  }

  return { ok: true, feedback: text.length > 0 ? text : null };
}

const PHASE_NAMES: Record<string, string> = {
  phase_a: "Phase A",
  phase_b: "Phase B",
  phase_c: "Phase C",
};

/** Where the notice sends the team: the page where they upload and resubmit. */
export const REJECTION_NOTICE_URL = "/yi-future/me/submissions";

export type RejectionNotice = { title: string; body: string; url: string };

/** The in-app notice a team gets when one of its phases is sent back. */
export function buildRejectionNotice(
  phase: string,
  reason: string
): RejectionNotice {
  const name = PHASE_NAMES[phase] ?? "Your submission";
  return {
    title: `${name} was sent back`,
    body: `${reason.trim()}\n\nUpload a revised file and resubmit.`,
    url: REJECTION_NOTICE_URL,
  };
}
