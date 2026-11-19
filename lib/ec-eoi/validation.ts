/**
 * Yi Erode EC 2027 EOI: one set of checking rules, used by the member's
 * browser (instant feedback) and again by the server (the real gate).
 * Rules follow the developer handover PDF, pages 2-3 and 8.
 *
 * No imports, so it also runs under plain `node --test`.
 */

export const EOI_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  phoneInputMax: 18,
  minRoles: 1,
  maxRoles: 3,
  minSentences: 2,
  answerMax: 3000,
} as const

/** Same counter as the design: punctuation-ended segments that contain a letter or number. */
export function countSentences(text: string): number {
  const value = String(text ?? '').trim()
  if (!value) return 0
  return (value.match(/[^.!?。！？।]+(?:[.!?。！？।]+|$)/gu) || []).filter(s => /[\p{L}\p{N}]/u.test(s)).length
}

export function normaliseName(raw: string): string {
  return String(raw ?? '').trim()
}

export function isValidName(raw: string): boolean {
  const name = normaliseName(raw)
  return name.length >= EOI_LIMITS.nameMin && name.length <= EOI_LIMITS.nameMax && /\p{L}/u.test(name)
}

/** Returns the 10-digit number as text, or null if it is not a valid Indian mobile. */
export function normalisePhone(raw: string): string | null {
  const input = String(raw ?? '')
  if (input.length > EOI_LIMITS.phoneInputMax) return null
  let digits = input.replace(/[\s()-]/g, '')
  if (/^\+91\d{10}$/.test(digits)) digits = digits.slice(3)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export interface EoiSubmissionInput {
  requestKey: string
  name: string
  phone: string
  ack: boolean
  selections: { roleId: string; answer: string }[]
}

export interface EoiCleanSubmission {
  requestKey: string
  name: string
  phone: string
  selections: { roleId: string; answer: string }[]
}

export type EoiValidationResult =
  | { ok: true; value: EoiCleanSubmission }
  | { ok: false; errors: Record<string, string> }

const REQUEST_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Server-side gate. `knownRoleIds` is the catalogue's id list, in display
 * order; the cleaned selections come back in that order.
 */
export function validateSubmission(input: unknown, knownRoleIds: readonly string[]): EoiValidationResult {
  const errors: Record<string, string> = {}
  const body = (input && typeof input === 'object' ? input : {}) as Partial<EoiSubmissionInput>

  const requestKey = typeof body.requestKey === 'string' ? body.requestKey : ''
  if (!REQUEST_KEY.test(requestKey)) errors.requestKey = 'Please refresh the page and try again.'

  const name = typeof body.name === 'string' ? normaliseName(body.name) : ''
  if (!isValidName(name)) errors.name = 'Please enter your full name.'

  const phone = typeof body.phone === 'string' ? normalisePhone(body.phone) : null
  if (!phone) errors.phone = 'Please enter a valid 10-digit Indian mobile number.'

  if (body.ack !== true) errors.ack = 'Please acknowledge the mandatory programmes and recurring EC meetings to continue.'

  const raw = Array.isArray(body.selections) ? body.selections : []
  const seen = new Set<string>()
  const byId = new Map<string, string>()
  let badShape = raw.length > EOI_LIMITS.maxRoles
  for (const item of raw) {
    const roleId = item && typeof item.roleId === 'string' ? item.roleId : ''
    const answer = item && typeof item.answer === 'string' ? item.answer : null
    if (!knownRoleIds.includes(roleId) || seen.has(roleId) || answer === null) { badShape = true; continue }
    seen.add(roleId)
    byId.set(roleId, answer)
  }
  if (badShape || byId.size < EOI_LIMITS.minRoles || byId.size > EOI_LIMITS.maxRoles) {
    errors.selections = 'Choose between one and three areas where you would like to contribute.'
  }

  const selections: { roleId: string; answer: string }[] = []
  for (const roleId of knownRoleIds) {
    if (!byId.has(roleId)) continue
    const answer = byId.get(roleId)!.trim()
    if (answer.length > EOI_LIMITS.answerMax) errors['answer-' + roleId] = `Please keep this answer within ${EOI_LIMITS.answerMax} characters.`
    else if (countSentences(answer) < EOI_LIMITS.minSentences) errors['answer-' + roleId] = 'Please write at least 2 sentences about your plans for this area in Erode.'
    selections.push({ roleId, answer })
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { requestKey: requestKey.toLowerCase(), name, phone: phone!, selections } }
}
