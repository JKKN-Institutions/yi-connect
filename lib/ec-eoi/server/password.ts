/**
 * Yi Erode EC 2027 EOI admin password hashing (scrypt, Node built-in).
 * Format: scrypt:N:r:p:<salt base64url>:<hash base64url>. Uses ":" not "$" so
 * the value is safe in .env files. No project imports (runs under node --test).
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const N = 16384, R = 8, P = 1, KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P })
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join(':')
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = parts
  const expected = Buffer.from(hashB64, 'base64url')
  if (expected.length !== KEYLEN) return false
  try {
    const actual = scryptSync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), KEYLEN, { N: Number(n), r: Number(r), p: Number(p) })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
