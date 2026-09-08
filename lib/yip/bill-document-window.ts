// Private Member's Bill — the document-attach window.
//
// Director ruling, 2026-08-26: "Let them attach until you've judged it." A
// Member may attach, replace, or remove their own bill's document at any time
// BEFORE an organiser approves or rejects it — i.e. while the bill is still
// 'drafting' OR already 'submitted'. Once judged (approved / presented /
// voting / passed / rejected) the document locks, same as the bill's text.
//
// Before this ruling the upload path required status === 'drafting', which
// meant a bill could never gain a document again after hand-in — on the day
// this shipped, 32 of 37 private member's bills were already 'submitted', so
// 86% of students hit a dead end (and the old error sent them to an organiser
// who has no tool to reopen a bill or upload on a student's behalf).
//
// Defined ONCE here — never re-typed at each call site — so upload, replace
// and delete can never drift apart on which statuses allow the action.
//
// PURE + CLIENT-SAFE — no DB, no "use server". Importable from both the
// server action file (app/yip/actions/bill-documents.ts) and the client
// component (app/yip/me/private-bill/private-bill-client.tsx).

export const BILL_DOCUMENT_EDITABLE_STATUSES = new Set(["drafting", "submitted"]);

/** True while a Private Member's Bill's own document may still be attached, replaced, or removed. */
export function canEditBillDocument(status: string | null | undefined): boolean {
  return BILL_DOCUMENT_EDITABLE_STATUSES.has(status ?? "");
}

/**
 * The honest refusal once a bill has been judged: it does NOT send the
 * student to an organiser, because no organiser tool exists to reopen a bill
 * or attach a document on a student's behalf. State what is true instead.
 */
export const BILL_DOCUMENT_LOCKED_MESSAGE =
  "This bill has already been judged — approved, rejected, or already put before the House — so its document can no longer be changed.";
