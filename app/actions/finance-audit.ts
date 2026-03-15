// ================================================
// FINANCE AUDIT & PAYMENT METHOD SERVER ACTIONS
// ================================================
// Server Actions for payment method CRUD and financial audit logging.
// Follows the same patterns as app/actions/finance.ts.
// ================================================

'use server'

import { updateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  deletePaymentMethodSchema,
} from '@/lib/validations/finance'
import {
  logFinancialActionSchema,
  togglePaymentMethodSchema,
} from '@/lib/validations/finance-audit'

// ================================================
// SHARED TYPES
// ================================================

export type FormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

// ================================================
// PAYMENT METHOD ACTIONS
// ================================================

/**
 * Create a new payment method for a chapter
 */
export async function createPaymentMethod(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = createPaymentMethodSchema.safeParse({
      name: formData.get('name'),
      type: formData.get('type'),
      account_number: formData.get('account_number') || undefined,
      bank_name: formData.get('bank_name') || undefined,
      ifsc_code: formData.get('ifsc_code') || undefined,
      upi_id: formData.get('upi_id') || undefined,
      is_default: formData.get('is_default') === 'true',
      notes: formData.get('notes') || undefined,
      chapter_id: formData.get('chapter_id'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Build account_details JSONB from individual fields
    const accountDetails: Record<string, string> = {}
    if (validation.data.account_number) accountDetails.account_number = validation.data.account_number
    if (validation.data.bank_name) accountDetails.bank_name = validation.data.bank_name
    if (validation.data.ifsc_code) accountDetails.ifsc_code = validation.data.ifsc_code
    if (validation.data.upi_id) accountDetails.upi_id = validation.data.upi_id

    // Destructure non-DB fields before spreading into insert
    const { account_number: _an, bank_name: _bn, ifsc_code: _ic, upi_id: _ui, ...createDbFields } = validation.data
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{
        ...createDbFields,
        account_details: accountDetails,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating payment method:', error)
      if (error.code === '23505') {
        return { message: 'A payment method with this name already exists for this chapter.' }
      }
      return { message: 'Database error: Failed to create payment method.' }
    }

    // If this is set as default, atomically update via DB function (prevents race conditions)
    if (data && validation.data.is_default) {
      const { error: rpcError } = await supabase.rpc('set_default_payment_method', {
        p_method_id: data.id,
        p_chapter_id: validation.data.chapter_id,
      })
      if (rpcError) {
        console.error('Error setting default payment method:', rpcError)
        // Payment method was created but default not set - inform user
        return { success: true, message: 'Payment method created but could not be set as default. Please try setting it as default manually.' }
      }
    }

    // Log the action
    await logFinancialActionInternal({
      chapterId: validation.data.chapter_id,
      action: 'create',
      entityType: 'payment_method',
      entityId: data.id,
      oldValues: null,
      newValues: validation.data,
      performedBy: user.id,
    })

    updateTag('payment-methods')
    updateTag(`chapter-${validation.data.chapter_id}-payment-methods`)

    return { success: true, message: 'Payment method created successfully.' }
  } catch (error) {
    console.error('Error in createPaymentMethod:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update an existing payment method
 */
export async function updatePaymentMethod(
  methodId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = updatePaymentMethodSchema.safeParse({
      name: formData.get('name') || undefined,
      account_number: formData.get('account_number') || undefined,
      bank_name: formData.get('bank_name') || undefined,
      ifsc_code: formData.get('ifsc_code') || undefined,
      upi_id: formData.get('upi_id') || undefined,
      is_active: formData.has('is_active') ? formData.get('is_active') === 'true' : undefined,
      is_default: formData.has('is_default') ? formData.get('is_default') === 'true' : undefined,
      notes: formData.get('notes') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Fetch existing record for audit log
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', methodId)
      .single()

    if (!existing) {
      return { message: 'Payment method not found.' }
    }

    // Build updated account_details (read existing values from JSONB column, not individual columns)
    const existingDetails = (existing.account_details as Record<string, string> | null) ?? {}
    const accountDetails: Record<string, string> = {}
    const accountNumber = validation.data.account_number ?? existingDetails.account_number ?? existing.account_number
    const bankName = validation.data.bank_name ?? existingDetails.bank_name ?? existing.bank_name
    const ifscCode = validation.data.ifsc_code ?? existingDetails.ifsc_code ?? existing.ifsc_code
    const upiId = validation.data.upi_id ?? existingDetails.upi_id ?? existing.upi_id
    if (accountNumber) accountDetails.account_number = accountNumber
    if (bankName) accountDetails.bank_name = bankName
    if (ifscCode) accountDetails.ifsc_code = ifscCode
    if (upiId) accountDetails.upi_id = upiId

    // Destructure non-DB fields before spreading into update
    const { account_number, bank_name, ifsc_code, upi_id, ...dbFields } = validation.data
    const { error } = await supabase
      .from('payment_methods')
      .update({
        ...dbFields,
        account_details: accountDetails,
      })
      .eq('id', methodId)

    if (error) {
      console.error('Error updating payment method:', error)
      return { message: 'Database error: Failed to update payment method.' }
    }

    // If setting as default, atomically update via DB function (prevents race conditions)
    if (validation.data.is_default) {
      const { error: rpcError } = await supabase.rpc('set_default_payment_method', {
        p_method_id: methodId,
        p_chapter_id: existing.chapter_id,
      })
      if (rpcError) {
        console.error('Error setting default payment method:', rpcError)
        return { success: true, message: 'Payment method updated but could not be set as default.' }
      }
    }

    // Log the action
    await logFinancialActionInternal({
      chapterId: existing.chapter_id,
      action: 'update',
      entityType: 'payment_method',
      entityId: methodId,
      oldValues: existing,
      newValues: validation.data,
      performedBy: user.id,
    })

    updateTag('payment-methods')
    updateTag(`payment-method-${methodId}`)

    return { success: true, message: 'Payment method updated successfully.' }
  } catch (error) {
    console.error('Error in updatePaymentMethod:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Toggle a payment method's active status
 */
export async function togglePaymentMethod(
  methodId: string
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = togglePaymentMethodSchema.safeParse({ method_id: methodId })
    if (!validation.success) {
      return { message: 'Invalid payment method ID.' }
    }

    const supabase = await createServerSupabaseClient()

    // Fetch current state
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', methodId)
      .single()

    if (!existing) {
      return { message: 'Payment method not found.' }
    }

    const newIsActive = !existing.is_active

    // If deactivating a default method, unset default
    const updates: Record<string, unknown> = { is_active: newIsActive }
    if (!newIsActive && existing.is_default) {
      updates.is_default = false
    }

    const { error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', methodId)

    if (error) {
      console.error('Error toggling payment method:', error)
      return { message: 'Database error: Failed to toggle payment method.' }
    }

    // Log the action
    await logFinancialActionInternal({
      chapterId: existing.chapter_id,
      action: newIsActive ? 'activate' : 'deactivate',
      entityType: 'payment_method',
      entityId: methodId,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: newIsActive },
      performedBy: user.id,
    })

    updateTag('payment-methods')
    updateTag(`payment-method-${methodId}`)

    return {
      success: true,
      message: `Payment method ${newIsActive ? 'activated' : 'deactivated'} successfully.`,
    }
  } catch (error) {
    console.error('Error in togglePaymentMethod:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(
  methodId: string
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = deletePaymentMethodSchema.safeParse({ method_id: methodId })
    if (!validation.success) {
      return { message: 'Invalid payment method ID.' }
    }

    const supabase = await createServerSupabaseClient()

    // Fetch for audit log
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', methodId)
      .single()

    if (!existing) {
      return { message: 'Payment method not found.' }
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId)

    if (error) {
      console.error('Error deleting payment method:', error)
      return { message: 'Database error: Failed to delete payment method.' }
    }

    // Log the action
    await logFinancialActionInternal({
      chapterId: existing.chapter_id,
      action: 'delete',
      entityType: 'payment_method',
      entityId: methodId,
      oldValues: existing,
      newValues: null,
      performedBy: user.id,
    })

    updateTag('payment-methods')
    updateTag(`payment-method-${methodId}`)

    return { success: true, message: 'Payment method deleted successfully.' }
  } catch (error) {
    console.error('Error in deletePaymentMethod:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// FINANCIAL AUDIT LOG ACTIONS
// ================================================

/**
 * Create a financial audit log entry.
 *
 * This is a public server action that can be called from other server actions
 * or components to log financial operations. It validates input with Zod.
 */
export async function logFinancialAction(
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = logFinancialActionSchema.safeParse({
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid audit log data.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Determine chapter_id from the entity
    const chapterId = await resolveChapterId(supabase, entityType, entityId)

    if (!chapterId) {
      console.error('Could not resolve chapter_id for audit log', { entityType, entityId })
      return { message: 'Could not determine chapter for audit log.' }
    }

    // Compute changed fields
    const changedFields = computeChangedFields(oldValues, newValues)

    const { error } = await supabase
      .from('financial_audit_logs')
      .insert([{
        chapter_id: chapterId,
        action: validation.data.action,
        entity_type: validation.data.entity_type,
        entity_id: validation.data.entity_id,
        old_values: validation.data.old_values || null,
        new_values: validation.data.new_values || null,
        changed_fields: changedFields,
        performed_by: user.id,
      }])

    if (error) {
      console.error('Error creating audit log:', error)
      return { message: 'Database error: Failed to create audit log.' }
    }

    updateTag('financial-audit-logs')

    return { success: true, message: 'Audit log entry created.' }
  } catch (error) {
    console.error('Error in logFinancialAction:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// INTERNAL HELPERS
// ================================================

/**
 * Internal helper to log financial actions without Zod validation overhead.
 * Used by other actions in this file that have already validated their inputs.
 */
async function logFinancialActionInternal(params: {
  chapterId: string
  action: string
  entityType: string
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  performedBy: string
  description?: string
  amountChanged?: number
}): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()

    const changedFields = computeChangedFields(params.oldValues, params.newValues)

    await supabase
      .from('financial_audit_logs')
      .insert([{
        chapter_id: params.chapterId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        old_values: params.oldValues,
        new_values: params.newValues,
        changed_fields: changedFields,
        amount_changed: params.amountChanged ?? null,
        performed_by: params.performedBy,
        description: params.description || null,
      }])
  } catch (error) {
    // Audit logging should not break the main operation
    console.error('Error writing audit log:', error)
  }
}

/**
 * Compute the list of fields that changed between old and new values
 */
function computeChangedFields(
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null
): string[] {
  if (!oldValues || !newValues) return []

  const changed: string[] = []
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)])

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key)
    }
  }

  return changed
}

/**
 * Resolve the chapter_id for an entity by looking it up in the appropriate table
 */
async function resolveChapterId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const tableMap: Record<string, string> = {
    budget: 'budgets',
    expense: 'expenses',
    sponsor: 'sponsors',
    sponsorship_deal: 'sponsorship_deals',
    sponsorship_payment: 'sponsorship_payments',
    reimbursement_request: 'reimbursement_requests',
    payment_method: 'payment_methods',
    expense_category: 'expense_categories',
  }

  const tableName = tableMap[entityType]
  if (!tableName) return null

  // sponsorship_payments don't have chapter_id directly, look up via deal
  if (entityType === 'sponsorship_payment') {
    const { data } = await supabase
      .from('sponsorship_payments')
      .select('deal_id')
      .eq('id', entityId)
      .single()

    if (!data?.deal_id) return null

    const { data: deal } = await supabase
      .from('sponsorship_deals')
      .select('chapter_id')
      .eq('id', data.deal_id)
      .single()

    return deal?.chapter_id || null
  }

  const { data } = await supabase
    .from(tableName)
    .select('chapter_id')
    .eq('id', entityId)
    .single()

  return data?.chapter_id || null
}
