/**
 * Session time utilities.
 *
 * All Yi chapters are in India for now — hardcode Asia/Kolkata for display.
 * When we need multi-timezone support, replace these helpers with
 * chapter.timezone lookups.
 */

const TIMEZONE = 'Asia/Kolkata'

export function formatSessionTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: TIMEZONE,
    })
  } catch {
    return iso
  }
}

export function formatSessionDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: TIMEZONE,
    })
  } catch {
    return iso
  }
}

export function formatSessionRange(startIso: string, endIso: string): string {
  return `${formatSessionTime(startIso)} – ${formatSessionTime(endIso)}`
}

/**
 * Returns duration in minutes (integer, rounded).
 */
export function sessionDurationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return Math.max(0, Math.round((end - start) / 60000))
}

/**
 * Convert an ISO datetime into the HTML `<input type="datetime-local">` format
 * in the Asia/Kolkata timezone (YYYY-MM-DDTHH:mm).
 */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // en-CA gives yyyy-mm-dd, combined with time pieces
    const datePart = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TIMEZONE,
    })
    return `${datePart}T${timePart}`
  } catch {
    return ''
  }
}

/**
 * Interpret a datetime-local value as Asia/Kolkata time and return ISO.
 * datetime-local has no timezone — we treat it as IST and return a proper
 * timestamptz ISO string.
 */
export function fromDateTimeLocalValue(value: string): string {
  if (!value) return ''
  // Asia/Kolkata is UTC+5:30 (no DST) — safe to hardcode.
  // If the input is "2026-04-18T09:30" we return "2026-04-18T09:30:00+05:30".
  return `${value}:00+05:30`
}
