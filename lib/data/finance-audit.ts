// ================================================
// FINANCE AUDIT & PAYMENT METHOD DATA LAYER
// ================================================
// Cached data fetching functions for payment methods and financial audit logs.
// Uses React cache() for request-level deduplication.
// Note: Not using Next.js 'use cache' directive because Supabase uses cookies (dynamic data source)
// ================================================

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AuditLogFilters } from '@/lib/validations/finance-audit'

// ================================================
// TYPES
// ================================================

export interface PaymentMethodRow {
  id: string
  chapter_id: string
  name: string
  type: string
  account_number: string | null
  bank_name: string | null
  ifsc_code: string | null
  upi_id: string | null
  account_details: Record<string, unknown> | null
  is_active: boolean
  is_default: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinancialAuditLogRow {
  id: string
  chapter_id: string
  entity_type: string
  entity_id: string
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[] | null
  amount_changed: number | null
  performed_by: string
  ip_address: string | null
  user_agent: string | null
  description: string | null
  created_at: string
}

export interface PaginatedAuditLogs {
  data: FinancialAuditLogRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ================================================
// PAYMENT METHOD QUERIES
// ================================================

/**
 * Get payment methods for a chapter
 * Returns active and inactive methods, sorted by default first then by name
 * If chapterId is null, fetches all payment methods (for super admins)
 */
export const getPaymentMethods = cache(async (
  chapterId?: string | null
): Promise<PaymentMethodRow[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('payment_methods')
    .select('*')

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  query = query
    .order('is_default', { ascending: false })
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching payment methods:', error)
    throw new Error('Failed to fetch payment methods')
  }

  return (data || []) as PaymentMethodRow[]
})

/**
 * Get active payment methods only
 * Useful for dropdowns and selection lists
 */
export const getActivePaymentMethods = cache(async (
  chapterId?: string | null
): Promise<PaymentMethodRow[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  query = query
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching active payment methods:', error)
    throw new Error('Failed to fetch active payment methods')
  }

  return (data || []) as PaymentMethodRow[]
})

/**
 * Get a single payment method by ID
 */
export const getPaymentMethodById = cache(async (
  methodId: string
): Promise<PaymentMethodRow | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('id', methodId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error fetching payment method:', error)
    throw new Error('Failed to fetch payment method')
  }

  return data as PaymentMethodRow
})

/**
 * Get the default payment method for a chapter
 */
export const getDefaultPaymentMethod = cache(async (
  chapterId: string
): Promise<PaymentMethodRow | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error fetching default payment method:', error)
    throw new Error('Failed to fetch default payment method')
  }

  return data as PaymentMethodRow
})

// ================================================
// FINANCIAL AUDIT LOG QUERIES
// ================================================

/**
 * Get paginated financial audit logs with optional filters
 * Used in audit log listing pages
 * If chapterId is null, fetches all logs (for super admins)
 */
export const getFinancialAuditLogs = cache(async (
  chapterId: string | null,
  filters?: AuditLogFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedAuditLogs> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('financial_audit_logs')
    .select('*', { count: 'exact' })

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.entity_type) {
    query = query.eq('entity_type', filters.entity_type)
  }

  if (filters?.action) {
    query = query.eq('action', filters.action)
  }

  if (filters?.entity_id) {
    query = query.eq('entity_id', filters.entity_id)
  }

  if (filters?.performed_by) {
    query = query.eq('performed_by', filters.performed_by)
  }

  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from)
  }

  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to)
  }

  if (filters?.search) {
    query = query.or(
      `action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    )
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting - most recent first
  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching financial audit logs:', error)
    throw new Error('Failed to fetch financial audit logs')
  }

  const total = count || 0

  return {
    data: (data || []) as FinancialAuditLogRow[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
})

/**
 * Get audit logs for a specific entity
 * Useful for showing history on detail pages
 */
export const getAuditLogsForEntity = cache(async (
  entityType: string,
  entityId: string
): Promise<FinancialAuditLogRow[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('financial_audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching entity audit logs:', error)
    throw new Error('Failed to fetch entity audit logs')
  }

  return (data || []) as FinancialAuditLogRow[]
})
