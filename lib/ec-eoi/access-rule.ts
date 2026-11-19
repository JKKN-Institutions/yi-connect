/**
 * Yi Erode EC 2027 EOI: the pure access rule (no I/O, unit-tested).
 * Allowed: an active platform super admin, or an active Yi Erode chapter chair /
 * co-chair, or an active app='ec_eoi' role scoped to chapter "Erode".
 * Fails closed on a blank chapter.
 */
export const EOI_APP = 'ec_eoi'
export const EOI_CHAPTER = 'Erode'
const PLATFORM_SUPER_ROLES = ['platform_super_admin', 'super_admin']
const CHAPTER_CHAIR_ROLES = ['chapter_chair', 'chapter_co_chair']

export interface EoiRoleLike {
  app: string
  role: string
  yi_chapter: string | null
  is_active: boolean
}

export function eoiAccessAllowed(assignments: readonly EoiRoleLike[]): boolean {
  return assignments.some(a => {
    if (!a.is_active) return false
    if (PLATFORM_SUPER_ROLES.includes(a.role)) return true
    if ((a.yi_chapter ?? '').trim() !== EOI_CHAPTER) return false
    return CHAPTER_CHAIR_ROLES.includes(a.role) || a.app === EOI_APP
  })
}
