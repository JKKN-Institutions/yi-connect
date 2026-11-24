'use server'

import { EOI_EXTRA_QUESTIONS, EOI_ROLES } from '@/lib/ec-eoi/catalog'
import { validateSubmission } from '@/lib/ec-eoi/validation'
import { isFormOpen, saveSubmission } from '@/lib/ec-eoi/server/data'
import { hasAdminSession } from '@/lib/ec-eoi/server/admin-session'

type SubmitResult =
  | { ok: true; id: string; submittedAt: string }
  | { ok: false; message: string; errors?: Record<string, string> }

/** Member submit. Re-checks every rule on the server; success only after the database confirms the save. */
export async function submitEoi(input: unknown): Promise<SubmitResult> {
  const [open, admin] = await Promise.all([isFormOpen(), hasAdminSession()])
  if (!open && !admin) {
    return { ok: false, message: 'The EC 2027 Expression of Interest is not open right now. Your answers are still here.' }
  }
  const checked = validateSubmission(input, EOI_ROLES.map(r => r.id), EOI_EXTRA_QUESTIONS)
  if (!checked.ok) {
    const first = Object.values(checked.errors)[0]
    return { ok: false, message: first || 'Please check your answers and try again.', errors: checked.errors }
  }
  const saved = await saveSubmission(checked.value)
  if (!saved.ok) {
    return {
      ok: false,
      message: 'We could not save your EOI. Your answers are still here. Please check your connection and press Submit EOI again.',
    }
  }
  return { ok: true, id: saved.id, submittedAt: saved.submittedAt }
}
