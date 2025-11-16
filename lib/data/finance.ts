// ================================================
// FINANCE DATA LAYER
// ================================================
// Cached data fetching functions for the Financial Command Center
// Uses React cache() for request-level deduplication
// Note: Not using Next.js 'use cache' directive because Supabase uses cookies (dynamic data source)
// ================================================

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  Budget,
  BudgetListItem,
  BudgetWithAllocations,
  BudgetWithUtilization,
  BudgetUtilization,
  BudgetAnalytics,
  BudgetFilters,
  PaginatedBudgets,
  Expense,
  ExpenseListItem,
  ExpenseWithCategory,
  ExpenseWithDetails,
  ExpenseAnalytics,
  ExpenseFilters,
  PaginatedExpenses,
  ExpenseCategory,
  Sponsor,
  SponsorListItem,
  SponsorWithDeals,
  SponsorFilters,
  PaginatedSponsors,
  SponsorshipDeal,
  SponsorshipDealListItem,
  SponsorshipDealWithSponsor,
  SponsorshipDealFull,
  SponsorshipPipelineValue,
  SponsorshipAnalytics,
  SponsorshipDealFilters,
  PaginatedSponsorshipDeals,
  ReimbursementRequest,
  ReimbursementRequestListItem,
  ReimbursementRequestWithApprovals,
  ReimbursementRequestFull,
  ReimbursementAnalytics,
  ReimbursementFilters,
  PaginatedReimbursements,
  PendingApproval,
  FinancialDashboardSummary,
} from '@/types/finance'

// ================================================
// BUDGET QUERIES
// ================================================

/**
 * Get paginated list of budgets with filters
 * Used in budget listing pages
 * If chapterId is null, fetches all budgets (for super admins)
 */
export const getBudgets = cache(async (
  chapterId: string | null,
  filters?: BudgetFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedBudgets> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('budgets')
    .select('*', { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all budgets
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year)
  }

  if (filters?.period) {
    query = query.eq('period', filters.period)
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query.order('fiscal_year', { ascending: false })
    .order('start_date', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching budgets:', error)
    throw new Error('Failed to fetch budgets')
  }

  // Transform to list items with calculated fields
  const listItems: BudgetListItem[] = (data || []).map((budget) => ({
    id: budget.id,
    name: budget.name,
    fiscal_year: budget.fiscal_year,
    period: budget.period as any,
    quarter: budget.quarter || undefined,
    total_amount: Number(budget.total_amount),
    spent_amount: Number(budget.spent_amount || 0),
    allocated_amount: Number(budget.allocated_amount || 0),
    utilization_percentage: budget.total_amount > 0
      ? Math.round((Number(budget.spent_amount || 0) / Number(budget.total_amount)) * 100)
      : 0,
    status: budget.status as any,
    start_date: budget.start_date,
    end_date: budget.end_date,
    is_overbudget: Number(budget.spent_amount || 0) > Number(budget.total_amount),
    is_near_limit: (Number(budget.spent_amount || 0) / Number(budget.total_amount)) >= 0.8,
  }))

  // Apply post-query filters
  let filteredItems = listItems

  if (filters?.is_overbudget !== undefined) {
    filteredItems = filteredItems.filter(b => b.is_overbudget === filters.is_overbudget)
  }

  if (filters?.is_near_limit !== undefined) {
    filteredItems = filteredItems.filter(b => b.is_near_limit === filters.is_near_limit)
  }

  return {
    data: filteredItems,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get single budget by ID with allocations
 */
export const getBudgetById = cache(async (budgetId: string): Promise<BudgetWithAllocations | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', budgetId)
    .single()

  if (budgetError || !budget) {
    return null
  }

  const { data: allocations, error: allocationsError } = await supabase
    .from('budget_allocations')
    .select('*')
    .eq('budget_id', budgetId)
    .order('vertical_name')

  if (allocationsError) {
    console.error('Error fetching budget allocations:', allocationsError)
  }

  return {
    ...budget,
    allocations: allocations || [],
  }
})

/**
 * Get budget utilization details
 */
export const getBudgetUtilization = cache(async (budgetId: string): Promise<BudgetUtilization | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('calculate_budget_utilization', { p_budget_id: budgetId })

  if (error || !data) {
    console.error('Error calculating budget utilization:', error)
    return null
  }

  return data as BudgetUtilization
})

/**
 * Get budget analytics for chapter
 */
export const getBudgetAnalytics = cache(async (chapterId: string, fiscalYear?: number): Promise<BudgetAnalytics> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('budgets')
    .select('*')
    .eq('chapter_id', chapterId)

  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear)
  }

  const { data: budgets, error } = await query

  if (error) {
    console.error('Error fetching budget analytics:', error)
    throw new Error('Failed to fetch budget analytics')
  }

  const totalBudget = budgets?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0
  const totalAllocated = budgets?.reduce((sum, b) => sum + Number(b.allocated_amount || 0), 0) || 0
  const totalSpent = budgets?.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0) || 0
  const totalCommitted = budgets?.reduce((sum, b) => sum + Number(b.committed_amount || 0), 0) || 0

  // Count budgets by status
  const budgetsByStatus = budgets?.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return {
    total_budget: totalBudget,
    total_allocated: totalAllocated,
    total_spent: totalSpent,
    total_committed: totalCommitted,
    total_available: totalBudget - totalSpent - totalCommitted,
    overall_utilization_percentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    budgets_by_status: budgetsByStatus as any,
    top_spending_categories: [],
    monthly_spend_trend: [],
    budget_alerts: budgets
      ?.filter(b => {
        const utilization = Number(b.spent_amount || 0) / Number(b.total_amount)
        return utilization > 1 || utilization >= 0.8
      })
      .map(b => ({
        budget_id: b.id,
        budget_name: b.name,
        alert_type: (Number(b.spent_amount || 0) > Number(b.total_amount) ? 'overbudget' : 'near_limit') as any,
        utilization_percentage: Math.round((Number(b.spent_amount || 0) / Number(b.total_amount)) * 100),
      })) || [],
  }
})

// ================================================
// EXPENSE CATEGORY QUERIES
// ================================================

/**
 * Get all expense categories for a chapter (including global ones)
 */
export const getExpenseCategories = cache(async (chapterId: string): Promise<ExpenseCategory[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .or(`chapter_id.eq.${chapterId},chapter_id.is.null`)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Error fetching expense categories:', error)
    throw new Error('Failed to fetch expense categories')
  }

  return data || []
})

/**
 * Get expense category by ID
 */
export const getExpenseCategoryById = cache(async (categoryId: string): Promise<ExpenseCategory | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('id', categoryId)
    .single()

  if (error) {
    return null
  }

  return data
})

// ================================================
// EXPENSE QUERIES
// ================================================

/**
 * Get paginated list of expenses with filters
 * If chapterId is null, fetches all expenses (for super admins)
 */
export const getExpenses = cache(async (
  chapterId: string | null,
  filters?: ExpenseFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedExpenses> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:expense_categories(*),
      event:events(id, title),
      budget:budgets(id, name),
      receipts:expense_receipts(count)
    `, { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all expenses
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.category_id) {
    if (Array.isArray(filters.category_id)) {
      query = query.in('category_id', filters.category_id)
    } else {
      query = query.eq('category_id', filters.category_id)
    }
  }

  if (filters?.event_id) {
    query = query.eq('event_id', filters.event_id)
  }

  if (filters?.budget_id) {
    query = query.eq('budget_id', filters.budget_id)
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  if (filters?.submitted_by) {
    query = query.eq('submitted_by', filters.submitted_by)
  }

  if (filters?.date_from) {
    query = query.gte('expense_date', filters.date_from)
  }

  if (filters?.date_to) {
    query = query.lte('expense_date', filters.date_to)
  }

  if (filters?.min_amount !== undefined) {
    query = query.gte('amount', filters.min_amount)
  }

  if (filters?.max_amount !== undefined) {
    query = query.lte('amount', filters.max_amount)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query.order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching expenses:', error)
    throw new Error('Failed to fetch expenses')
  }

  // Transform to list items
  const listItems: ExpenseListItem[] = (data || []).map((expense: any) => ({
    id: expense.id,
    title: expense.title,
    amount: Number(expense.amount),
    total_amount: Number(expense.total_amount),
    expense_date: expense.expense_date,
    category: expense.category ? {
      id: expense.category.id,
      name: expense.category.name,
      color: expense.category.color || '#6B7280',
    } : { id: '', name: 'Uncategorized', color: '#6B7280' },
    event: expense.event || undefined,
    budget: expense.budget || undefined,
    vendor_name: expense.vendor_name,
    status: expense.status,
    submitted_by: {
      id: expense.submitted_by || expense.created_by,
      full_name: 'User', // Will be enriched by join
    },
    has_receipts: (expense.receipts?.[0]?.count || 0) > 0,
    created_at: expense.created_at,
  }))

  return {
    data: listItems,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get single expense by ID with full details
 */
export const getExpenseById = cache(async (expenseId: string): Promise<ExpenseWithDetails | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:expense_categories(*),
      receipts:expense_receipts(*),
      event:events(id, title),
      budget:budgets(id, name)
    `)
    .eq('id', expenseId)
    .single()

  if (error || !data) {
    return null
  }

  return data as any
})

/**
 * Get expense analytics for chapter
 */
export const getExpenseAnalytics = cache(async (chapterId: string, dateFrom?: string, dateTo?: string): Promise<ExpenseAnalytics> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('expenses')
    .select('*, category:expense_categories(id, name)')
    .eq('chapter_id', chapterId)

  if (dateFrom) {
    query = query.gte('expense_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('expense_date', dateTo)
  }

  const { data: expenses, error } = await query

  if (error) {
    console.error('Error fetching expense analytics:', error)
    throw new Error('Failed to fetch expense analytics')
  }

  const totalExpenses = expenses?.length || 0
  const totalAmount = expenses?.reduce((sum, e) => sum + Number(e.total_amount || e.amount), 0) || 0
  const approvedAmount = expenses?.filter(e => e.status === 'approved' || e.status === 'paid')
    .reduce((sum, e) => sum + Number(e.total_amount || e.amount), 0) || 0
  const pendingAmount = expenses?.filter(e => e.status === 'submitted')
    .reduce((sum, e) => sum + Number(e.total_amount || e.amount), 0) || 0
  const rejectedAmount = expenses?.filter(e => e.status === 'rejected')
    .reduce((sum, e) => sum + Number(e.total_amount || e.amount), 0) || 0

  const expensesByStatus = expenses?.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const expensesByCategory = Object.values(
    expenses?.reduce((acc: any, e: any) => {
      const catId = e.category?.id || 'uncategorized'
      if (!acc[catId]) {
        acc[catId] = {
          category_id: catId,
          category_name: e.category?.name || 'Uncategorized',
          count: 0,
          amount: 0,
        }
      }
      acc[catId].count++
      acc[catId].amount += Number(e.total_amount || e.amount)
      return acc
    }, {}) || {}
  ).map((cat: any) => ({
    ...cat,
    percentage: totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0,
  }))

  return {
    total_expenses: totalExpenses,
    total_amount: totalAmount,
    approved_amount: approvedAmount,
    pending_amount: pendingAmount,
    rejected_amount: rejectedAmount,
    expenses_by_status: expensesByStatus as any,
    expenses_by_category: expensesByCategory,
    monthly_trend: [],
    top_events_by_expense: [],
  }
})

// ================================================
// SPONSOR QUERIES
// ================================================

/**
 * Get paginated list of sponsors with filters
 * If chapterId is null, fetches all sponsors (for super admins)
 */
export const getSponsors = cache(async (
  chapterId: string | null,
  filters?: SponsorFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedSponsors> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('sponsors')
    .select(`
      *,
      deals:sponsorship_deals(count)
    `, { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all sponsors
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.industry) {
    if (Array.isArray(filters.industry)) {
      query = query.in('industry', filters.industry)
    } else {
      query = query.eq('industry', filters.industry)
    }
  }

  if (filters?.relationship_status) {
    if (Array.isArray(filters.relationship_status)) {
      query = query.in('relationship_status', filters.relationship_status)
    } else {
      query = query.eq('relationship_status', filters.relationship_status)
    }
  }

  if (filters?.priority) {
    if (Array.isArray(filters.priority)) {
      query = query.in('priority', filters.priority)
    } else {
      query = query.eq('priority', filters.priority)
    }
  }

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  if (filters?.search) {
    query = query.or(`organization_name.ilike.%${filters.search}%,contact_person_name.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query.order('organization_name')

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching sponsors:', error)
    throw new Error('Failed to fetch sponsors')
  }

  // Transform to list items
  const listItems: SponsorListItem[] = (data || []).map((sponsor: any) => ({
    id: sponsor.id,
    organization_name: sponsor.organization_name,
    industry: sponsor.industry,
    contact_person_name: sponsor.contact_person_name,
    contact_email: sponsor.contact_email,
    contact_phone: sponsor.contact_phone,
    relationship_status: sponsor.relationship_status,
    total_sponsored_amount: Number(sponsor.total_sponsored_amount || 0),
    current_year_amount: Number(sponsor.current_year_amount || 0),
    active_deals_count: sponsor.deals?.[0]?.count || 0,
    next_followup_date: sponsor.next_followup_date,
    priority: sponsor.priority,
    tags: sponsor.tags || [],
    is_active: sponsor.is_active,
  }))

  return {
    data: listItems,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get single sponsor by ID with deals
 */
export const getSponsorById = cache(async (sponsorId: string): Promise<SponsorWithDeals | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: sponsor, error: sponsorError } = await supabase
    .from('sponsors')
    .select('*')
    .eq('id', sponsorId)
    .single()

  if (sponsorError || !sponsor) {
    return null
  }

  const { data: deals, error: dealsError } = await supabase
    .from('sponsorship_deals')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('created_at', { ascending: false })

  if (dealsError) {
    console.error('Error fetching sponsor deals:', dealsError)
  }

  const activeDeals = deals?.filter(d =>
    ['contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed'].includes(d.deal_stage)
  ) || []

  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.proposed_amount || 0), 0)

  return {
    ...sponsor,
    deals: deals || [],
    active_deals_count: activeDeals.length,
    total_pipeline_value: totalPipelineValue,
  }
})

// ================================================
// SPONSORSHIP DEAL QUERIES
// ================================================

/**
 * Get paginated list of sponsorship deals with filters
 * If chapterId is null, fetches all sponsorship deals (for super admins)
 */
export const getSponsorshipDeals = cache(async (
  chapterId: string | null,
  filters?: SponsorshipDealFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedSponsorshipDeals> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('sponsorship_deals')
    .select(`
      *,
      sponsor:sponsors(id, organization_name),
      tier:sponsorship_tiers(id, name, tier_level)
    `, { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all sponsorship deals
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.sponsor_id) {
    query = query.eq('sponsor_id', filters.sponsor_id)
  }

  if (filters?.tier_id) {
    query = query.eq('tier_id', filters.tier_id)
  }

  if (filters?.deal_stage) {
    if (Array.isArray(filters.deal_stage)) {
      query = query.in('deal_stage', filters.deal_stage)
    } else {
      query = query.eq('deal_stage', filters.deal_stage)
    }
  }

  if (filters?.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year)
  }

  if (filters?.event_id) {
    query = query.eq('event_id', filters.event_id)
  }

  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to)
  }

  if (filters?.min_amount !== undefined) {
    query = query.gte('proposed_amount', filters.min_amount)
  }

  if (filters?.max_amount !== undefined) {
    query = query.lte('proposed_amount', filters.max_amount)
  }

  if (filters?.search) {
    query = query.or(`deal_name.ilike.%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching sponsorship deals:', error)
    throw new Error('Failed to fetch sponsorship deals')
  }

  // Transform to list items
  const listItems: SponsorshipDealListItem[] = (data || []).map((deal: any) => ({
    id: deal.id,
    deal_name: deal.deal_name,
    sponsor: deal.sponsor || { id: '', organization_name: 'Unknown' },
    tier: deal.tier || undefined,
    deal_stage: deal.deal_stage,
    proposed_amount: Number(deal.proposed_amount),
    committed_amount: deal.committed_amount ? Number(deal.committed_amount) : undefined,
    received_amount: Number(deal.received_amount || 0),
    probability_percentage: deal.probability_percentage,
    weighted_value: Number(deal.weighted_value || 0),
    expected_closure_date: deal.expected_closure_date,
    assigned_to: deal.assigned_to ? { id: deal.assigned_to, full_name: 'User' } : undefined,
    fiscal_year: deal.fiscal_year,
  }))

  return {
    data: listItems,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get single sponsorship deal by ID with full details
 */
export const getSponsorshipDealById = cache(async (dealId: string): Promise<SponsorshipDealFull | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('sponsorship_deals')
    .select(`
      *,
      sponsor:sponsors(*),
      tier:sponsorship_tiers(*),
      payments:sponsorship_payments(*),
      event:events(id, title)
    `)
    .eq('id', dealId)
    .single()

  if (error || !data) {
    return null
  }

  return data as any
})

/**
 * Get sponsorship pipeline value
 * If chapterId is null, calculates for all chapters (super admins)
 */
export const getSponsorshipPipelineValue = cache(async (chapterId: string | null): Promise<SponsorshipPipelineValue> => {
  const supabase = await createServerSupabaseClient()

  // For super admins without chapter, aggregate manually instead of using RPC
  if (!chapterId) {
    const { data: deals, error } = await supabase
      .from('sponsorship_deals')
      .select('*')

    if (error || !deals) {
      console.error('Error fetching sponsorship deals:', error)
      return {
        prospect_count: 0,
        active_count: 0,
        committed_count: 0,
        closed_count: 0,
        lost_count: 0,
        total_pipeline_value: 0,
        weighted_pipeline_value: 0,
        total_committed: 0,
        total_received: 0,
        win_rate: 0,
      }
    }

    const prospect_count = deals.filter(d => d.deal_stage === 'prospect').length
    const active_count = deals.filter(d => ['contacted', 'proposal_sent', 'negotiation'].includes(d.deal_stage)).length
    const committed_count = deals.filter(d => ['committed', 'contract_signed'].includes(d.deal_stage)).length
    const closed_count = deals.filter(d => d.deal_stage === 'payment_received').length
    const lost_count = deals.filter(d => d.deal_stage === 'lost').length

    const total_pipeline_value = deals
      .filter(d => !['lost', 'payment_received'].includes(d.deal_stage))
      .reduce((sum, d) => sum + Number(d.proposed_amount || 0), 0)

    const weighted_pipeline_value = deals
      .filter(d => !['lost', 'payment_received'].includes(d.deal_stage))
      .reduce((sum, d) => sum + Number(d.weighted_value || 0), 0)

    const total_committed = deals
      .filter(d => d.committed_amount)
      .reduce((sum, d) => sum + Number(d.committed_amount || 0), 0)

    const total_received = deals.reduce((sum, d) => sum + Number(d.received_amount || 0), 0)

    const win_rate = (closed_count + lost_count) > 0
      ? (closed_count / (closed_count + lost_count)) * 100
      : 0

    return {
      prospect_count,
      active_count,
      committed_count,
      closed_count,
      lost_count,
      total_pipeline_value,
      weighted_pipeline_value,
      total_committed,
      total_received,
      win_rate,
    }
  }

  const { data, error } = await supabase
    .rpc('calculate_sponsorship_pipeline_value', { p_chapter_id: chapterId })

  if (error || !data) {
    console.error('Error calculating pipeline value:', error)
    return {
      prospect_count: 0,
      active_count: 0,
      committed_count: 0,
      closed_count: 0,
      lost_count: 0,
      total_pipeline_value: 0,
      weighted_pipeline_value: 0,
      total_committed: 0,
      total_received: 0,
      win_rate: 0,
    }
  }

  return data as SponsorshipPipelineValue
})

// ================================================
// REIMBURSEMENT QUERIES
// ================================================

/**
 * Get paginated list of reimbursement requests with filters
 * If chapterId is null, fetches all reimbursement requests (for super admins)
 */
export const getReimbursementRequests = cache(async (
  chapterId: string | null,
  filters?: ReimbursementFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedReimbursements> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('reimbursement_requests')
    .select(`
      *,
      event:events(id, title)
    `, { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all reimbursement requests
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  // Apply filters
  if (filters?.requester_id) {
    query = query.eq('requester_id', filters.requester_id)
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  if (filters?.current_approver_id) {
    query = query.eq('current_approver_id', filters.current_approver_id)
  }

  if (filters?.event_id) {
    query = query.eq('event_id', filters.event_id)
  }

  if (filters?.date_from) {
    query = query.gte('expense_date', filters.date_from)
  }

  if (filters?.date_to) {
    query = query.lte('expense_date', filters.date_to)
  }

  if (filters?.min_amount !== undefined) {
    query = query.gte('amount', filters.min_amount)
  }

  if (filters?.max_amount !== undefined) {
    query = query.lte('amount', filters.max_amount)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,requester_name.ilike.%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching reimbursement requests:', error)
    throw new Error('Failed to fetch reimbursement requests')
  }

  // Transform to list items
  const listItems: ReimbursementRequestListItem[] = (data || []).map((request: any) => {
    const daysPending = request.submitted_at
      ? Math.floor((Date.now() - new Date(request.submitted_at).getTime()) / (1000 * 60 * 60 * 24))
      : undefined

    return {
      id: request.id,
      title: request.title,
      requester_name: request.requester_name,
      amount: Number(request.amount),
      expense_date: request.expense_date,
      status: request.status,
      submitted_at: request.submitted_at,
      current_approver: request.current_approver_id ? {
        id: request.current_approver_id,
        full_name: 'Approver',
      } : undefined,
      pending_days: daysPending,
      event: request.event || undefined,
    }
  })

  return {
    data: listItems,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get single reimbursement request by ID with approvals
 */
export const getReimbursementRequestById = cache(async (requestId: string): Promise<ReimbursementRequestFull | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('reimbursement_requests')
    .select(`
      *,
      approvals:reimbursement_approvals(*),
      expense:expenses(*),
      event:events(id, title)
    `)
    .eq('id', requestId)
    .single()

  if (error || !data) {
    return null
  }

  return data as any
})

/**
 * Get pending approvals for a user
 */
export const getPendingApprovals = cache(async (approverId: string): Promise<PendingApproval[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('get_pending_approvals', { p_approver_id: approverId })

  if (error) {
    console.error('Error fetching pending approvals:', error)
    return []
  }

  return data || []
})

/**
 * Get reimbursement analytics
 * If chapterId is null, calculates for all chapters (super admins)
 */
export const getReimbursementAnalytics = cache(async (chapterId: string | null): Promise<ReimbursementAnalytics> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('reimbursement_requests')
    .select('*')

  // Filter by chapter only if chapterId is provided
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  const { data: requests, error } = await query

  if (error) {
    console.error('Error fetching reimbursement analytics:', error)
    throw new Error('Failed to fetch reimbursement analytics')
  }

  const totalRequests = requests?.length || 0
  const totalAmount = requests?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
  const approvedAmount = requests?.filter(r => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0
  const pendingAmount = requests?.filter(r => r.status === 'pending_approval')
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0
  const rejectedAmount = requests?.filter(r => r.status === 'rejected')
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0
  const paidAmount = requests?.filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0

  const requestsByStatus = requests?.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return {
    total_requests: totalRequests,
    total_amount: totalAmount,
    approved_amount: approvedAmount,
    pending_amount: pendingAmount,
    rejected_amount: rejectedAmount,
    paid_amount: paidAmount,
    requests_by_status: requestsByStatus as any,
    average_approval_time_days: 0,
    pending_requests: [],
    overdue_requests: [],
  }
})

// ================================================
// FINANCIAL DASHBOARD
// ================================================

/**
 * Get comprehensive financial dashboard summary
 */
export const getFinancialDashboard = cache(async (chapterId: string, fiscalYear?: number): Promise<FinancialDashboardSummary> => {
  const [budget, expenses, sponsorships, reimbursements] = await Promise.all([
    getBudgetAnalytics(chapterId, fiscalYear),
    getExpenseAnalytics(chapterId),
    getSponsorshipPipelineValue(chapterId),
    getReimbursementAnalytics(chapterId),
  ])

  return {
    budget,
    expenses,
    sponsorships: {
      ...sponsorships,
      deals_by_stage: {
        prospect: 0,
        contacted: 0,
        proposal_sent: 0,
        negotiation: 0,
        committed: 0,
        contract_signed: 0,
        payment_received: 0,
        lost: 0,
      },
      deals_by_tier: [],
      top_sponsors: [],
      monthly_revenue: [],
    },
    reimbursements,
    cash_flow: {
      total_income: sponsorships.total_received,
      total_expenses: expenses.total_amount,
      net_cash_flow: sponsorships.total_received - expenses.total_amount,
    },
  }
})
