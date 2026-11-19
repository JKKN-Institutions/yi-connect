/**
 * Yi Erode EC 2027 EOI: reading and saving entries (server only, service role).
 * Callers must check the open switch / admin session first.
 */
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { EOI_COMMITMENT_VERSION, EOI_ROLES, EOI_TEAM_YEAR, eoiRoleById } from '../catalog'
import type { EoiCleanSubmission } from '../validation'
import type { EoiExportEntry } from '../workbook'

const db = () => createAdminSupabaseClient()
const SETTINGS_KEY = 'ec-2027'

/** Fails closed: any read problem counts as "not open". */
export async function isFormOpen(): Promise<boolean> {
  const { data, error } = await db().from('ec_eoi_settings').select('is_open').eq('key', SETTINGS_KEY).maybeSingle()
  return !error && data?.is_open === true
}

export type EoiSaveResult = { ok: true; id: string; submittedAt: string } | { ok: false }

export async function saveSubmission(value: EoiCleanSubmission): Promise<EoiSaveResult> {
  const { data, error } = await db().rpc('ec_eoi_submit', {
    p: {
      requestKey: value.requestKey,
      teamYear: EOI_TEAM_YEAR,
      name: value.name,
      phone: value.phone,
      commitmentVersion: EOI_COMMITMENT_VERSION,
      selections: value.selections,
    },
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row?.id) {
    console.error('[ec-eoi] save failed', error?.message)
    return { ok: false }
  }
  return { ok: true, id: row.id, submittedAt: row.submitted_at }
}

interface AppRow {
  id: string
  submitted_at: string
  member_name: string
  phone: string
  role_ids: string[]
  ec_eoi_proposals: { role_id: string; response: string }[]
}

/**
 * All entries, newest first, with a record type that marks repeats from the
 * same phone (Director 19 Nov: keep both, mark the repeat).
 */
export async function listEntries(): Promise<EoiExportEntry[]> {
  const rows: AppRow[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await db()
      .from('ec_eoi_applications')
      .select('id, submitted_at, member_name, phone, role_ids, ec_eoi_proposals(role_id, response)')
      .eq('team_year', EOI_TEAM_YEAR)
      .order('submitted_at', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error('Unable to read entries')
    rows.push(...((data ?? []) as AppRow[]))
    if (!data || data.length < page) break
  }

  const totalByPhone = new Map<string, number>()
  rows.forEach(r => totalByPhone.set(r.phone, (totalByPhone.get(r.phone) ?? 0) + 1))
  const seenByPhone = new Map<string, number>()
  const order = EOI_ROLES.map(r => r.id)

  const entries = rows.map(r => {
    const nth = (seenByPhone.get(r.phone) ?? 0) + 1
    seenByPhone.set(r.phone, nth)
    const total = totalByPhone.get(r.phone)!
    const answers = new Map(r.ec_eoi_proposals.map(p => [p.role_id, p.response]))
    const selections = order
      .filter(id => answers.has(id))
      .map(id => {
        const role = eoiRoleById(id)!
        return { id, name: role.name, category: role.category, answer: answers.get(id)! }
      })
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      name: r.member_name,
      phone: r.phone,
      recordType: total > 1 ? `Submitted · repeat ${nth} of ${total} from this number` : 'Submitted',
      selections,
    }
  })
  return entries.reverse()
}
