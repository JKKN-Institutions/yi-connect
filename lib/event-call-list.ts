/**
 * Event call list: shared constants and types (safe for client and server).
 *
 * Kept OUT of the 'use server' actions file on purpose: a 'use server' file
 * may only export async functions, and a const exported there breaks every
 * server action on the page.
 */

export const CALL_RESULTS = [
  'not_called',
  'coming',
  'not_coming',
  'no_answer',
  'call_back'
] as const;

export type CallResult = (typeof CALL_RESULTS)[number];

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  not_called: 'Not called',
  coming: 'Coming',
  not_coming: 'Not coming',
  no_answer: 'No answer',
  call_back: 'Call back'
};

export type InviteeKind = 'member' | 'guest';

export interface InviteeRef {
  kind: InviteeKind;
  /** event_rsvps.id for members, guest_rsvps.id for guests */
  id: string;
}

export interface CallListRow {
  kind: InviteeKind;
  id: string;
  name: string;
  phone: string | null;
  rsvpStatus: string;
  callerId: string | null;
  callerName: string | null;
  result: CallResult;
  note: string | null;
  calledByName: string | null;
  calledAt: string | null;
}

export interface CallerOption {
  id: string;
  name: string;
}

export interface CallTotals {
  invited: number;
  called: number;
  coming: number;
  notComing: number;
  noAnswer: number;
  callBack: number;
  unassigned: number;
}

export function isCallResult(value: unknown): value is CallResult {
  return typeof value === 'string' && (CALL_RESULTS as readonly string[]).includes(value);
}

export function computeCallTotals(rows: CallListRow[]): CallTotals {
  return {
    invited: rows.length,
    called: rows.filter((r) => r.result !== 'not_called').length,
    coming: rows.filter((r) => r.result === 'coming').length,
    notComing: rows.filter((r) => r.result === 'not_coming').length,
    noAnswer: rows.filter((r) => r.result === 'no_answer').length,
    callBack: rows.filter((r) => r.result === 'call_back').length,
    unassigned: rows.filter((r) => !r.callerId).length
  };
}

/** tel: link for an Indian mobile number; 10 bare digits get +91. */
export function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `tel:+${digits}`;
  return `tel:${digits}`;
}
