// ================================================
// FINANCE MODULE SERVER ACTIONS
// ================================================
// Comprehensive Server Actions for the Financial Command Center
// Includes all CRUD operations with Zod validation and cache invalidation
// ================================================

'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createBudgetSchema,
  updateBudgetSchema,
  allocateBudgetSchema,
  deleteBudgetSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  deleteExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  submitExpenseSchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  deleteExpenseSchema,
  uploadExpenseReceiptSchema,
  deleteExpenseReceiptSchema,
  createSponsorSchema,
  updateSponsorSchema,
  deleteSponsorSchema,
  createSponsorshipTierSchema,
  updateSponsorshipTierSchema,
  deleteSponsorshipTierSchema,
  createSponsorshipDealSchema,
  updateSponsorshipDealSchema,
  deleteSponsorshipDealSchema,
  recordSponsorshipPaymentSchema,
  updateSponsorshipPaymentSchema,
  deleteSponsorshipPaymentSchema,
  createReimbursementRequestSchema,
  updateReimbursementRequestSchema,
  submitReimbursementRequestSchema,
  approveReimbursementSchema,
  rejectReimbursementSchema,
  payReimbursementSchema,
  deleteReimbursementRequestSchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  deletePaymentMethodSchema,
} from '@/lib/validations/finance'

// ================================================
// SHARED TYPES
// ================================================

export type FormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

// ================================================
// BUDGET ACTIONS
// ================================================

/**
 * Create a new budget
 */
export async function createBudget(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    // Validate input
    const validation = createBudgetSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      calendar_year: formData.get('calendar_year'),
      period: formData.get('period'),
      quarter: formData.get('quarter') || undefined,
      total_amount: formData.get('total_amount'),
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date'),
      chapter_id: formData.get('chapter_id'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('budgets')
      .insert([{
        ...validation.data,
        created_by: user.id,
        status: 'draft',
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating budget:', error)
      return { message: 'Database error: Failed to create budget.' }
    }

    // Invalidate cache
    updateTag('budgets')
    updateTag(`chapter-${validation.data.chapter_id}-budgets`)

    redirect(`/finance/budgets/${data.id}`)
  } catch (error) {
    console.error('Error in createBudget:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update an existing budget
 */
export async function updateBudget(
  budgetId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = updateBudgetSchema.safeParse({
      name: formData.get('name') || undefined,
      description: formData.get('description') || undefined,
      total_amount: formData.get('total_amount') || undefined,
      start_date: formData.get('start_date') || undefined,
      end_date: formData.get('end_date') || undefined,
      status: formData.get('status') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('budgets')
      .update(validation.data)
      .eq('id', budgetId)

    if (error) {
      console.error('Error updating budget:', error)
      return { message: 'Database error: Failed to update budget.' }
    }

    updateTag('budgets')
    updateTag(`budget-${budgetId}`)

    return { success: true, message: 'Budget updated successfully.' }
  } catch (error) {
    console.error('Error in updateBudget:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Allocate budget to verticals/categories
 */
export async function allocateBudget(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const allocationsJson = formData.get('allocations')
    if (!allocationsJson) {
      return { message: 'Allocations data is required.' }
    }

    const allocations = JSON.parse(allocationsJson as string)

    const validation = allocateBudgetSchema.safeParse({
      budget_id: formData.get('budget_id'),
      allocations,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Delete existing allocations
    await supabase
      .from('budget_allocations')
      .delete()
      .eq('budget_id', validation.data.budget_id)

    // Insert new allocations
    const { error } = await supabase
      .from('budget_allocations')
      .insert(
        validation.data.allocations.map(alloc => ({
          budget_id: validation.data.budget_id,
          ...alloc,
        }))
      )

    if (error) {
      console.error('Error allocating budget:', error)
      return { message: 'Database error: Failed to allocate budget.' }
    }

    // Update budget allocated_amount
    const totalAllocated = validation.data.allocations.reduce(
      (sum, alloc) => sum + alloc.allocated_amount,
      0
    )

    await supabase
      .from('budgets')
      .update({ allocated_amount: totalAllocated })
      .eq('id', validation.data.budget_id)

    updateTag('budgets')
    updateTag(`budget-${validation.data.budget_id}`)

    return { success: true, message: 'Budget allocated successfully.' }
  } catch (error) {
    console.error('Error in allocateBudget:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete a budget
 */
export async function deleteBudget(budgetId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId)

    if (error) {
      console.error('Error deleting budget:', error)
      return { message: 'Database error: Failed to delete budget.' }
    }

    updateTag('budgets')
    updateTag(`budget-${budgetId}`)

    return { success: true, message: 'Budget deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteBudget:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// EXPENSE CATEGORY ACTIONS
// ================================================

/**
 * Create expense category
 */
export async function createExpenseCategory(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = createExpenseCategorySchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      parent_category_id: formData.get('parent_category_id') || undefined,
      color: formData.get('color') || undefined,
      icon: formData.get('icon') || undefined,
      chapter_id: formData.get('chapter_id') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expense_categories')
      .insert([validation.data])

    if (error) {
      console.error('Error creating expense category:', error)
      return { message: 'Database error: Failed to create category.' }
    }

    updateTag('expense-categories')

    return { success: true, message: 'Category created successfully.' }
  } catch (error) {
    console.error('Error in createExpenseCategory:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update expense category
 */
export async function updateExpenseCategory(
  categoryId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = updateExpenseCategorySchema.safeParse({
      name: formData.get('name') || undefined,
      description: formData.get('description') || undefined,
      parent_category_id: formData.get('parent_category_id') || undefined,
      color: formData.get('color') || undefined,
      icon: formData.get('icon') || undefined,
      is_active: formData.get('is_active') === 'true' ? true : formData.get('is_active') === 'false' ? false : undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expense_categories')
      .update(validation.data)
      .eq('id', categoryId)

    if (error) {
      console.error('Error updating expense category:', error)
      return { message: 'Database error: Failed to update category.' }
    }

    updateTag('expense-categories')
    updateTag(`expense-category-${categoryId}`)

    return { success: true, message: 'Category updated successfully.' }
  } catch (error) {
    console.error('Error in updateExpenseCategory:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete expense category
 */
export async function deleteExpenseCategory(categoryId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      console.error('Error deleting expense category:', error)
      return { message: 'Database error: Failed to delete category.' }
    }

    updateTag('expense-categories')

    return { success: true, message: 'Category deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteExpenseCategory:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// EXPENSE ACTIONS
// ================================================

/**
 * Create expense
 */
export async function createExpense(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = createExpenseSchema.safeParse({
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      amount: formData.get('amount'),
      expense_date: formData.get('expense_date'),
      category_id: formData.get('category_id'),
      event_id: formData.get('event_id') || undefined,
      budget_id: formData.get('budget_id') || undefined,
      vendor_name: formData.get('vendor_name') || undefined,
      vendor_contact: formData.get('vendor_contact') || undefined,
      invoice_number: formData.get('invoice_number') || undefined,
      tax_amount: formData.get('tax_amount') || undefined,
      other_charges: formData.get('other_charges') || undefined,
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

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        ...validation.data,
        created_by: user.id,
        status: 'draft',
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating expense:', error)
      return { message: 'Database error: Failed to create expense.' }
    }

    updateTag('expenses')
    updateTag(`chapter-${validation.data.chapter_id}-expenses`)

    redirect(`/finance/expenses/${data.id}`)
  } catch (error) {
    console.error('Error in createExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update expense
 */
export async function updateExpense(
  expenseId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = updateExpenseSchema.safeParse({
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      amount: formData.get('amount') || undefined,
      expense_date: formData.get('expense_date') || undefined,
      category_id: formData.get('category_id') || undefined,
      event_id: formData.get('event_id') || undefined,
      budget_id: formData.get('budget_id') || undefined,
      vendor_name: formData.get('vendor_name') || undefined,
      vendor_contact: formData.get('vendor_contact') || undefined,
      invoice_number: formData.get('invoice_number') || undefined,
      payment_method: formData.get('payment_method') || undefined,
      payment_date: formData.get('payment_date') || undefined,
      payment_reference: formData.get('payment_reference') || undefined,
      tax_amount: formData.get('tax_amount') || undefined,
      other_charges: formData.get('other_charges') || undefined,
      notes: formData.get('notes') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expenses')
      .update(validation.data)
      .eq('id', expenseId)

    if (error) {
      console.error('Error updating expense:', error)
      return { message: 'Database error: Failed to update expense.' }
    }

    updateTag('expenses')
    updateTag(`expense-${expenseId}`)

    return { success: true, message: 'Expense updated successfully.' }
  } catch (error) {
    console.error('Error in updateExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Submit expense for approval
 */
export async function submitExpense(expenseId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'submitted',
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', expenseId)

    if (error) {
      console.error('Error submitting expense:', error)
      return { message: 'Database error: Failed to submit expense.' }
    }

    updateTag('expenses')
    updateTag(`expense-${expenseId}`)

    return { success: true, message: 'Expense submitted for approval.' }
  } catch (error) {
    console.error('Error in submitExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Approve expense
 */
export async function approveExpense(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = approveExpenseSchema.safeParse({
      expense_id: formData.get('expense_id'),
      payment_method: formData.get('payment_method') || undefined,
      payment_date: formData.get('payment_date') || undefined,
      payment_reference: formData.get('payment_reference') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        payment_method: validation.data.payment_method,
        payment_date: validation.data.payment_date,
        payment_reference: validation.data.payment_reference,
      })
      .eq('id', validation.data.expense_id)

    if (error) {
      console.error('Error approving expense:', error)
      return { message: 'Database error: Failed to approve expense.' }
    }

    updateTag('expenses')
    updateTag(`expense-${validation.data.expense_id}`)
    updateTag('budgets') // Budget utilization will update via trigger

    return { success: true, message: 'Expense approved successfully.' }
  } catch (error) {
    console.error('Error in approveExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Reject expense
 */
export async function rejectExpense(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = rejectExpenseSchema.safeParse({
      expense_id: formData.get('expense_id'),
      rejection_reason: formData.get('rejection_reason'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'rejected',
        rejection_reason: validation.data.rejection_reason,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', validation.data.expense_id)

    if (error) {
      console.error('Error rejecting expense:', error)
      return { message: 'Database error: Failed to reject expense.' }
    }

    updateTag('expenses')
    updateTag(`expense-${validation.data.expense_id}`)

    return { success: true, message: 'Expense rejected.' }
  } catch (error) {
    console.error('Error in rejectExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete expense
 */
export async function deleteExpense(expenseId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) {
      console.error('Error deleting expense:', error)
      return { message: 'Database error: Failed to delete expense.' }
    }

    updateTag('expenses')
    updateTag(`expense-${expenseId}`)

    return { success: true, message: 'Expense deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteExpense:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// SPONSOR ACTIONS
// ================================================

/**
 * Create sponsor
 */
export async function createSponsor(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const tagsJson = formData.get('tags')
    const tags = tagsJson ? JSON.parse(tagsJson as string) : undefined

    const validation = createSponsorSchema.safeParse({
      organization_name: formData.get('organization_name'),
      industry: formData.get('industry') || undefined,
      website: formData.get('website') || undefined,
      contact_person_name: formData.get('contact_person_name') || undefined,
      contact_person_designation: formData.get('contact_person_designation') || undefined,
      contact_email: formData.get('contact_email') || undefined,
      contact_phone: formData.get('contact_phone') || undefined,
      address_line1: formData.get('address_line1') || undefined,
      address_line2: formData.get('address_line2') || undefined,
      city: formData.get('city') || undefined,
      state: formData.get('state') || undefined,
      pincode: formData.get('pincode') || undefined,
      country: formData.get('country') || 'India',
      relationship_status: formData.get('relationship_status') || 'prospect',
      first_contact_date: formData.get('first_contact_date') || undefined,
      next_followup_date: formData.get('next_followup_date') || undefined,
      tags,
      priority: formData.get('priority') || 'medium',
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

    const { data, error } = await supabase
      .from('sponsors')
      .insert([{
        ...validation.data,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating sponsor:', error)
      return { message: 'Database error: Failed to create sponsor.' }
    }

    updateTag('sponsors')
    updateTag(`chapter-${validation.data.chapter_id}-sponsors`)

    redirect(`/finance/sponsors/${data.id}`)
  } catch (error) {
    console.error('Error in createSponsor:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update sponsor
 */
export async function updateSponsor(
  sponsorId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const tagsJson = formData.get('tags')
    const tags = tagsJson ? JSON.parse(tagsJson as string) : undefined

    const validation = updateSponsorSchema.safeParse({
      organization_name: formData.get('organization_name') || undefined,
      industry: formData.get('industry') || undefined,
      website: formData.get('website') || undefined,
      contact_person_name: formData.get('contact_person_name') || undefined,
      contact_person_designation: formData.get('contact_person_designation') || undefined,
      contact_email: formData.get('contact_email') || undefined,
      contact_phone: formData.get('contact_phone') || undefined,
      address_line1: formData.get('address_line1') || undefined,
      address_line2: formData.get('address_line2') || undefined,
      city: formData.get('city') || undefined,
      state: formData.get('state') || undefined,
      pincode: formData.get('pincode') || undefined,
      country: formData.get('country') || undefined,
      relationship_status: formData.get('relationship_status') || undefined,
      last_contact_date: formData.get('last_contact_date') || undefined,
      next_followup_date: formData.get('next_followup_date') || undefined,
      tags,
      priority: formData.get('priority') || undefined,
      notes: formData.get('notes') || undefined,
      is_active: formData.get('is_active') === 'true' ? true : formData.get('is_active') === 'false' ? false : undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('sponsors')
      .update(validation.data)
      .eq('id', sponsorId)

    if (error) {
      console.error('Error updating sponsor:', error)
      return { message: 'Database error: Failed to update sponsor.' }
    }

    updateTag('sponsors')
    updateTag(`sponsor-${sponsorId}`)

    return { success: true, message: 'Sponsor updated successfully.' }
  } catch (error) {
    console.error('Error in updateSponsor:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete sponsor
 */
export async function deleteSponsor(sponsorId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', sponsorId)

    if (error) {
      console.error('Error deleting sponsor:', error)
      return { message: 'Database error: Failed to delete sponsor.' }
    }

    updateTag('sponsors')
    updateTag(`sponsor-${sponsorId}`)

    return { success: true, message: 'Sponsor deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteSponsor:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// SPONSORSHIP DEAL ACTIONS
// ================================================

/**
 * Create sponsorship deal
 */
export async function createSponsorshipDeal(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const deliverablesJson = formData.get('deliverables')
    const deliverables = deliverablesJson ? JSON.parse(deliverablesJson as string) : undefined

    const validation = createSponsorshipDealSchema.safeParse({
      deal_name: formData.get('deal_name'),
      sponsor_id: formData.get('sponsor_id'),
      tier_id: formData.get('tier_id') || undefined,
      proposed_amount: formData.get('proposed_amount'),
      deal_stage: formData.get('deal_stage') || 'prospect',
      proposal_date: formData.get('proposal_date') || undefined,
      expected_closure_date: formData.get('expected_closure_date') || undefined,
      event_id: formData.get('event_id') || undefined,
      calendar_year: formData.get('calendar_year') || undefined,
      probability_percentage: formData.get('probability_percentage') || 50,
      point_of_contact: formData.get('point_of_contact') || undefined,
      assigned_to: formData.get('assigned_to') || undefined,
      contract_terms: formData.get('contract_terms') || undefined,
      deliverables,
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

    const { data, error } = await supabase
      .from('sponsorship_deals')
      .insert([{
        ...validation.data,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating sponsorship deal:', error)
      return { message: 'Database error: Failed to create deal.' }
    }

    updateTag('sponsorship-deals')
    updateTag(`chapter-${validation.data.chapter_id}-deals`)
    updateTag(`sponsor-${validation.data.sponsor_id}`)

    redirect(`/finance/sponsorships/${data.id}`)
  } catch (error) {
    console.error('Error in createSponsorshipDeal:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update sponsorship deal
 */
export async function updateSponsorshipDeal(
  dealId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const deliverablesJson = formData.get('deliverables')
    const deliverables = deliverablesJson ? JSON.parse(deliverablesJson as string) : undefined

    const validation = updateSponsorshipDealSchema.safeParse({
      deal_name: formData.get('deal_name') || undefined,
      tier_id: formData.get('tier_id') || undefined,
      deal_stage: formData.get('deal_stage') || undefined,
      proposed_amount: formData.get('proposed_amount') || undefined,
      committed_amount: formData.get('committed_amount') || undefined,
      proposal_date: formData.get('proposal_date') || undefined,
      expected_closure_date: formData.get('expected_closure_date') || undefined,
      commitment_date: formData.get('commitment_date') || undefined,
      contract_signed_date: formData.get('contract_signed_date') || undefined,
      contract_number: formData.get('contract_number') || undefined,
      contract_terms: formData.get('contract_terms') || undefined,
      deliverables,
      probability_percentage: formData.get('probability_percentage') || undefined,
      point_of_contact: formData.get('point_of_contact') || undefined,
      assigned_to: formData.get('assigned_to') || undefined,
      notes: formData.get('notes') || undefined,
      rejection_reason: formData.get('rejection_reason') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('sponsorship_deals')
      .update(validation.data)
      .eq('id', dealId)

    if (error) {
      console.error('Error updating sponsorship deal:', error)
      return { message: 'Database error: Failed to update deal.' }
    }

    updateTag('sponsorship-deals')
    updateTag(`deal-${dealId}`)

    return { success: true, message: 'Deal updated successfully.' }
  } catch (error) {
    console.error('Error in updateSponsorshipDeal:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete sponsorship deal
 */
export async function deleteSponsorshipDeal(dealId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('sponsorship_deals')
      .delete()
      .eq('id', dealId)

    if (error) {
      console.error('Error deleting sponsorship deal:', error)
      return { message: 'Database error: Failed to delete deal.' }
    }

    updateTag('sponsorship-deals')
    updateTag(`deal-${dealId}`)

    return { success: true, message: 'Deal deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteSponsorshipDeal:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Record sponsorship payment
 */
export async function recordSponsorshipPayment(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = recordSponsorshipPaymentSchema.safeParse({
      deal_id: formData.get('deal_id'),
      amount: formData.get('amount'),
      payment_date: formData.get('payment_date'),
      payment_method: formData.get('payment_method'),
      transaction_reference: formData.get('transaction_reference') || undefined,
      bank_name: formData.get('bank_name') || undefined,
      cheque_number: formData.get('cheque_number') || undefined,
      utr_number: formData.get('utr_number') || undefined,
      receipt_number: formData.get('receipt_number') || undefined,
      receipt_date: formData.get('receipt_date') || undefined,
      notes: formData.get('notes') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Insert payment record
    const { error: paymentError } = await supabase
      .from('sponsorship_payments')
      .insert([{
        ...validation.data,
        recorded_by: user.id,
      }])

    if (paymentError) {
      console.error('Error recording payment:', paymentError)
      return { message: 'Database error: Failed to record payment.' }
    }

    // Update deal received_amount (will be done by trigger)
    updateTag('sponsorship-deals')
    updateTag('sponsorship-payments')
    updateTag(`deal-${validation.data.deal_id}`)

    return { success: true, message: 'Payment recorded successfully.' }
  } catch (error) {
    console.error('Error in recordSponsorshipPayment:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

// ================================================
// REIMBURSEMENT REQUEST ACTIONS
// ================================================

/**
 * Create reimbursement request
 */
export async function createReimbursementRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    // Get user profile for requester details
    const supabase = await createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single()

    const validation = createReimbursementRequestSchema.safeParse({
      title: formData.get('title'),
      description: formData.get('description'),
      amount: formData.get('amount'),
      expense_date: formData.get('expense_date'),
      expense_id: formData.get('expense_id') || undefined,
      event_id: formData.get('event_id') || undefined,
      payment_method_preference: formData.get('payment_method_preference') || undefined,
      bank_account_number: formData.get('bank_account_number') || undefined,
      bank_name: formData.get('bank_name') || undefined,
      ifsc_code: formData.get('ifsc_code') || undefined,
      upi_id: formData.get('upi_id') || undefined,
      notes: formData.get('notes') || undefined,
      chapter_id: formData.get('chapter_id'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const { data, error } = await supabase
      .from('reimbursement_requests')
      .insert([{
        ...validation.data,
        requester_id: user.id,
        requester_name: profile?.full_name || 'Unknown',
        requester_email: profile?.email,
        requester_phone: profile?.phone,
        status: 'draft',
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating reimbursement request:', error)
      return { message: 'Database error: Failed to create request.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`chapter-${validation.data.chapter_id}-reimbursements`)

    redirect(`/finance/reimbursements/${data.id}`)
  } catch (error) {
    console.error('Error in createReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Update reimbursement request
 */
export async function updateReimbursementRequest(
  requestId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = updateReimbursementRequestSchema.safeParse({
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      amount: formData.get('amount') || undefined,
      expense_date: formData.get('expense_date') || undefined,
      payment_method_preference: formData.get('payment_method_preference') || undefined,
      bank_account_number: formData.get('bank_account_number') || undefined,
      bank_name: formData.get('bank_name') || undefined,
      ifsc_code: formData.get('ifsc_code') || undefined,
      upi_id: formData.get('upi_id') || undefined,
      notes: formData.get('notes') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .update(validation.data)
      .eq('id', requestId)

    if (error) {
      console.error('Error updating reimbursement request:', error)
      return { message: 'Database error: Failed to update request.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${requestId}`)

    return { success: true, message: 'Request updated successfully.' }
  } catch (error) {
    console.error('Error in updateReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Submit reimbursement request for approval
 */
export async function submitReimbursementRequest(requestId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) {
      console.error('Error submitting reimbursement request:', error)
      return { message: 'Database error: Failed to submit request.' }
    }

    // Note: Approval workflow is handled via status transitions (submitted -> approved/rejected)
    // Approvers are notified through the reimbursement dashboard

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${requestId}`)

    return { success: true, message: 'Request submitted for approval.' }
  } catch (error) {
    console.error('Error in submitReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Approve reimbursement request
 */
export async function approveReimbursementRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = approveReimbursementSchema.safeParse({
      request_id: formData.get('request_id'),
      comments: formData.get('comments') || undefined,
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .update({
        status: 'approved',
        final_approved_by: user.id,
        final_approved_at: new Date().toISOString(),
      })
      .eq('id', validation.data.request_id)

    if (error) {
      console.error('Error approving reimbursement request:', error)
      return { message: 'Database error: Failed to approve request.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${validation.data.request_id}`)

    return { success: true, message: 'Request approved successfully.' }
  } catch (error) {
    console.error('Error in approveReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Reject reimbursement request
 */
export async function rejectReimbursementRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = rejectReimbursementSchema.safeParse({
      request_id: formData.get('request_id'),
      rejection_reason: formData.get('rejection_reason'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .update({
        status: 'rejected',
        rejection_reason: validation.data.rejection_reason,
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', validation.data.request_id)

    if (error) {
      console.error('Error rejecting reimbursement request:', error)
      return { message: 'Database error: Failed to reject request.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${validation.data.request_id}`)

    return { success: true, message: 'Request rejected.' }
  } catch (error) {
    console.error('Error in rejectReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Mark reimbursement as paid
 */
export async function payReimbursement(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const validation = payReimbursementSchema.safeParse({
      request_id: formData.get('request_id'),
      payment_reference: formData.get('payment_reference'),
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .update({
        status: 'paid',
        payment_reference: validation.data.payment_reference,
        paid_by: user.id,
        paid_at: new Date().toISOString(),
      })
      .eq('id', validation.data.request_id)

    if (error) {
      console.error('Error marking reimbursement as paid:', error)
      return { message: 'Database error: Failed to mark as paid.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${validation.data.request_id}`)

    return { success: true, message: 'Reimbursement marked as paid.' }
  } catch (error) {
    console.error('Error in payReimbursement:', error)
    return { message: 'An unexpected error occurred.' }
  }
}

/**
 * Delete reimbursement request
 */
export async function deleteReimbursementRequest(requestId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { message: 'Unauthorized. Please log in.' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('reimbursement_requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      console.error('Error deleting reimbursement request:', error)
      return { message: 'Database error: Failed to delete request.' }
    }

    updateTag('reimbursement-requests')
    updateTag(`reimbursement-${requestId}`)

    return { success: true, message: 'Request deleted successfully.' }
  } catch (error) {
    console.error('Error in deleteReimbursementRequest:', error)
    return { message: 'An unexpected error occurred.' }
  }
}
