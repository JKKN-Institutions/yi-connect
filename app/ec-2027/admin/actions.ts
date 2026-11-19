'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hasAdminSession } from '@/lib/ec-eoi/server/admin-session'
import { listEntries } from '@/lib/ec-eoi/server/data'
import type { EoiExportEntry } from '@/lib/ec-eoi/workbook'

/** Signs out of Yi Connect on this browser (the desk uses the Yi Connect login). */
export async function adminSignOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
}

/** Every read re-checks the login and the Yi Erode role; anyone else gets nothing. */
export async function adminListEntries(): Promise<{ ok: true; entries: EoiExportEntry[] } | { ok: false; signedOut?: boolean; error: string }> {
  if (!(await hasAdminSession())) return { ok: false, signedOut: true, error: 'Your session has ended. Please sign in again.' }
  try {
    return { ok: true, entries: await listEntries() }
  } catch {
    return { ok: false, error: 'Unable to load entries. Please try again.' }
  }
}
