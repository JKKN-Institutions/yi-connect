'use server'

import { hasAdminSession, signIn, signOut } from '@/lib/ec-eoi/server/admin-session'
import { listEntries } from '@/lib/ec-eoi/server/data'
import type { EoiExportEntry } from '@/lib/ec-eoi/workbook'

export async function adminSignIn(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return { ok: false, error: 'Enter your username and password.' }
  }
  if (username.length > 100 || password.length > 256) return { ok: false, error: 'Incorrect username or password.' }
  return signIn(username, password)
}

export async function adminSignOut(): Promise<void> {
  await signOut()
}

/** Every read re-checks the session; a signed-out caller gets nothing. */
export async function adminListEntries(): Promise<{ ok: true; entries: EoiExportEntry[] } | { ok: false; signedOut?: boolean; error: string }> {
  if (!(await hasAdminSession())) return { ok: false, signedOut: true, error: 'Your session has ended. Please sign in again.' }
  try {
    return { ok: true, entries: await listEntries() }
  } catch {
    return { ok: false, error: 'Unable to load entries. Please try again.' }
  }
}
