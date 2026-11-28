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

export const MEAL_CHOICES = ['veg', 'non_veg'] as const;
export type MealChoice = (typeof MEAL_CHOICES)[number];
export const MEAL_LABELS: Record<MealChoice, string> = { veg: 'Veg', non_veg: 'Non-veg' };

/**
 * Fixed id of the optional "Meal preference" question that the meal switch
 * adds to an event's registration_form_fields (ids there must be UUIDs).
 * Answers land in event_rsvps / guest_rsvps.custom_field_responses[MEAL_FIELD_ID].
 */
export const MEAL_FIELD_ID = 'b1c2d3e4-0000-4000-8000-0000000000a1';
export const MEAL_FIELD_OPTIONS = ['Veg', 'Non-veg'] as const;

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
  /** True when the phone was withheld from this viewer (open callers see names, not numbers) */
  phoneHidden?: boolean;
  rsvpStatus: string;
  callerId: string | null;
  callerName: string | null;
  result: CallResult;
  note: string | null;
  calledByName: string | null;
  calledAt: string | null;
  /** Asked on the call (only when the event serves a meal and result is coming) */
  meal: MealChoice | null;
  /** People coming with this invitee, including them; null unless coming */
  heads: number | null;
  /** Answer the invitee gave on the RSVP form's meal question, if any */
  formMeal: string | null;
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
  /** Plates = sum of head counts among Coming rows with that meal choice */
  vegPlates: number;
  nonVegPlates: number;
  /** Coming rows whose meal choice has not been asked yet */
  comingMealNotAsked: number;
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
    unassigned: rows.filter((r) => !r.callerId).length,
    vegPlates: plates(rows, 'veg'),
    nonVegPlates: plates(rows, 'non_veg'),
    comingMealNotAsked: rows.filter((r) => r.result === 'coming' && !r.meal).length
  };
}

function plates(rows: CallListRow[], meal: MealChoice): number {
  return rows
    .filter((r) => r.result === 'coming' && r.meal === meal)
    .reduce((sum, r) => sum + (r.heads ?? 1), 0);
}

export function isMealChoice(value: unknown): value is MealChoice {
  return typeof value === 'string' && (MEAL_CHOICES as readonly string[]).includes(value);
}

/** Does this event serve a meal? (events.custom_fields.meal_choice === true) */
export function eventServesMeal(customFields: unknown): boolean {
  return !!customFields && typeof customFields === 'object' && (customFields as Record<string, unknown>).meal_choice === true;
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
