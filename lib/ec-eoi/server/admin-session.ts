/**
 * Yi Erode EC 2027 EOI: who may open the leadership desk.
 *
 * Director's choice (19 Nov 2026, 15:4x): leaders sign in with their OWN Yi
 * Connect login; there is no shared password. Roles come from the canonical
 * yi_directory.role_assignments (getCurrentPersonRoles), never a parallel table.
 * The rule itself is in ../access-rule.ts. Fails closed.
 */
import { getCurrentPersonRoles } from '@/lib/yi/auth/yi-directory-roles'
import { eoiAccessAllowed } from '../access-rule'

export type EoiAdminAccess =
  | { allowed: true; email: string | null }
  | { allowed: false; signedIn: boolean; email: string | null }

export async function getEoiAdminAccess(): Promise<EoiAdminAccess> {
  const me = await getCurrentPersonRoles()
  if (!me) return { allowed: false, signedIn: await isSignedIn(), email: null }
  return eoiAccessAllowed(me.assignments) ? { allowed: true, email: me.email } : { allowed: false, signedIn: true, email: me.email }
}

/** A Yi Connect login with no yi_directory person row still counts as signed in (so the page says "no access", not "sign in"). */
async function isSignedIn(): Promise<boolean> {
  const { createServerSupabaseClient } = await import('@/lib/supabase/server')
  const sb = await createServerSupabaseClient()
  const { data } = await sb.auth.getUser()
  return !!data.user
}

/** True only for a signed-in Yi Connect user with Yi Erode EOI access. Every admin read and download calls this. */
export async function hasAdminSession(): Promise<boolean> {
  return (await getEoiAdminAccess()).allowed
}
