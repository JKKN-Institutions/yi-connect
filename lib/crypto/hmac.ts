/**
 * HMAC utilities for verifying member identity in public RSVP flows.
 * Prevents IDOR by ensuring member_id cannot be spoofed.
 */

import * as crypto from 'crypto'

const HMAC_SECRET = process.env.RSVP_HMAC_SECRET || process.env.NEXTAUTH_SECRET || 'yi-connect-rsvp-hmac-fallback-key'

/**
 * Generate an HMAC for a member_id scoped to a specific event token.
 * Used to verify that the member_id was served by the server, not guessed by the client.
 */
export function generateMemberHMAC(memberId: string, eventToken: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${eventToken}:${memberId}`)
    .digest('hex')
    .substring(0, 16) // Short enough for URL params, long enough to be secure
}

/**
 * Verify a member HMAC.
 * Returns true if the HMAC matches, false otherwise.
 */
export function verifyMemberHMAC(memberId: string, eventToken: string, hmac: string): boolean {
  const expected = generateMemberHMAC(memberId, eventToken)
  // Timing-safe comparison to prevent timing attacks
  if (hmac.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))
}

/**
 * Generate HMACs for a list of member IDs.
 * Returns a map of member_id -> hmac.
 */
export function generateMemberHMACs(memberIds: string[], eventToken: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const id of memberIds) {
    result[id] = generateMemberHMAC(id, eventToken)
  }
  return result
}
