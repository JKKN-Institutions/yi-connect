/**
 * Speaker Server Actions (Stutzee Feature 1B)
 *
 * Handles FAQ CRUD for speakers.
 * All mutations gated on Co-Chair+ role.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import {
  createSpeakerFAQSchema,
  updateSpeakerFAQSchema,
  reorderSpeakerFAQsSchema,
} from '@/lib/validations/stakeholder'

type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

const CO_CHAIR_PLUS = [
  'Super Admin',
  'National Admin',
  'Chair',
  'Co-Chair',
  'Executive Member',
]

function zodFlatten(error: z.ZodError): string {
  const first = error.issues[0]
  return first?.message ?? 'Invalid input'
}

// ----------------------------------------------------------------------------
// createSpeakerFAQ
// ----------------------------------------------------------------------------
export async function createSpeakerFAQ(
  input: z.infer<typeof createSpeakerFAQSchema>
): Promise<ActionResult> {
  await requireRole(CO_CHAIR_PLUS)

  const parsed = createSpeakerFAQSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: zodFlatten(parsed.error) }
  }

  const supabase = await createClient()

  // Determine sort_order if not provided (append to end)
  let sortOrder = parsed.data.sort_order
  if (sortOrder === undefined || sortOrder === null) {
    const { data: existing } = await supabase
      .from('speaker_faqs')
      .select('sort_order')
      .eq('speaker_id', parsed.data.speaker_id)
      .order('sort_order', { ascending: false })
      .limit(1)

    sortOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0
  }

  const { data, error } = await supabase
    .from('speaker_faqs')
    .insert({
      speaker_id: parsed.data.speaker_id,
      question: parsed.data.question,
      answer: parsed.data.answer,
      is_public: parsed.data.is_public ?? true,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating speaker FAQ:', error)
    return { success: false, error: `Failed to create FAQ: ${error.message}` }
  }

  revalidatePath(`/stakeholders/speakers/${parsed.data.speaker_id}`)
  return { success: true, data }
}

// ----------------------------------------------------------------------------
// updateSpeakerFAQ
// ----------------------------------------------------------------------------
export async function updateSpeakerFAQ(
  input: z.infer<typeof updateSpeakerFAQSchema>
): Promise<ActionResult> {
  await requireRole(CO_CHAIR_PLUS)

  const parsed = updateSpeakerFAQSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: zodFlatten(parsed.error) }
  }

  const supabase = await createClient()

  const { id, ...updates } = parsed.data
  const cleanUpdates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return { success: false, error: 'No fields to update' }
  }

  const { data, error } = await supabase
    .from('speaker_faqs')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating speaker FAQ:', error)
    return { success: false, error: `Failed to update FAQ: ${error.message}` }
  }

  if (data?.speaker_id) {
    revalidatePath(`/stakeholders/speakers/${data.speaker_id}`)
  }
  return { success: true, data }
}

// ----------------------------------------------------------------------------
// deleteSpeakerFAQ
// ----------------------------------------------------------------------------
export async function deleteSpeakerFAQ(
  faqId: string,
  speakerId: string
): Promise<ActionResult> {
  await requireRole(CO_CHAIR_PLUS)

  if (!faqId || !speakerId) {
    return { success: false, error: 'FAQ ID and speaker ID required' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('speaker_faqs').delete().eq('id', faqId)

  if (error) {
    console.error('Error deleting speaker FAQ:', error)
    return { success: false, error: `Failed to delete FAQ: ${error.message}` }
  }

  revalidatePath(`/stakeholders/speakers/${speakerId}`)
  return { success: true }
}

// ----------------------------------------------------------------------------
// reorderSpeakerFAQs
// ----------------------------------------------------------------------------
export async function reorderSpeakerFAQs(
  input: z.infer<typeof reorderSpeakerFAQsSchema>
): Promise<ActionResult> {
  await requireRole(CO_CHAIR_PLUS)

  const parsed = reorderSpeakerFAQsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: zodFlatten(parsed.error) }
  }

  const supabase = await createClient()

  // Sequential updates — small list size (<50 typical)
  const { speaker_id, ordered_ids } = parsed.data
  for (let i = 0; i < ordered_ids.length; i++) {
    const { error } = await supabase
      .from('speaker_faqs')
      .update({ sort_order: i })
      .eq('id', ordered_ids[i])
      .eq('speaker_id', speaker_id)

    if (error) {
      console.error('Error reordering FAQs at index', i, ':', error)
      return { success: false, error: `Failed to reorder FAQs: ${error.message}` }
    }
  }

  revalidatePath(`/stakeholders/speakers/${speaker_id}`)
  return { success: true }
}
