/**
 * Yi Erode EC 2027 EOI: the leadership desk login (username "Yierode").
 *
 * Separate from Yi Connect member logins by the Director's choice (19 Nov 2026,
 * question box), as the developer handover PDF asks. A sign-in creates a random
 * session token; only its SHA-256 is stored, the token sits in an http-only
 * cookie scoped to /ec-2027. Sign out revokes the stored session, so a copied
 * cookie stops working too. Repeated wrong passwords lock the login for a while.
 */
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { verifyPassword } from './password'

export const EOI_ADMIN_USERNAME = 'Yierode'
const COOKIE = 'ec_eoi_admin'
const SESSION_HOURS = 8
const LOCK_WINDOW_MIN = 15
const LOCK_AFTER_FAILURES = 8

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const db = () => createAdminSupabaseClient()

async function storedPasswordHash(): Promise<string | null> {
  // Local testing only: a throwaway hash in .env.local. Production reads the
  // hash the chapter owner set with scripts/ec-eoi-set-admin-password.mjs.
  if (process.env.NODE_ENV !== 'production' && process.env.EC_EOI_ADMIN_PASSWORD_HASH) {
    return process.env.EC_EOI_ADMIN_PASSWORD_HASH
  }
  const { data } = await db()
    .from('ec_eoi_admin_credentials')
    .select('password_hash')
    .eq('username', EOI_ADMIN_USERNAME)
    .maybeSingle()
  return data?.password_hash ?? null
}

export type EoiLoginResult = { ok: true } | { ok: false; error: string }

export async function signIn(username: string, password: string): Promise<EoiLoginResult> {
  const sb = db()
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString()
  const { count } = await sb
    .from('ec_eoi_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('succeeded', false)
    .gte('attempted_at', since)
  if ((count ?? 0) >= LOCK_AFTER_FAILURES) {
    return { ok: false, error: `Too many attempts. Please wait ${LOCK_WINDOW_MIN} minutes and try again.` }
  }

  const hash = await storedPasswordHash()
  const good = username.trim() === EOI_ADMIN_USERNAME && verifyPassword(password, hash)
  await sb.from('ec_eoi_login_attempts').insert({ username: username.trim().slice(0, 100), succeeded: good })
  if (!hash) return { ok: false, error: 'Admin access has not been set up yet. Please contact the Yi Erode Chair.' }
  if (!good) return { ok: false, error: 'Incorrect username or password.' }

  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000)
  const { error } = await sb.from('ec_eoi_admin_sessions').insert({
    token_hash: sha256(token),
    username: EOI_ADMIN_USERNAME,
    expires_at: expires.toISOString(),
  })
  if (error) return { ok: false, error: 'Unable to sign in right now. Please try again.' }
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/ec-2027',
    expires,
  })
  return { ok: true }
}

/** True only for a stored, unexpired, unrevoked session. Every admin read and download calls this. */
export async function hasAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return false
  const { data } = await db()
    .from('ec_eoi_admin_sessions')
    .select('expires_at, revoked_at')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  return !!data && !data.revoked_at && new Date(data.expires_at).getTime() > Date.now()
}

export async function signOut(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) {
    await db().from('ec_eoi_admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', sha256(token))
  }
  jar.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/ec-2027', maxAge: 0 })
}
