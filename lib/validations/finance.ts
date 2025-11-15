// ================================================
// FINANCE MODULE VALIDATION SCHEMAS
// ================================================
// Comprehensive Zod validation schemas for the Financial Command Center
// Includes budgets, expenses, sponsorships, reimbursements, and related entities
// ================================================

import { z } from 'zod'

// ================================================
// SHARED VALIDATION HELPERS
// ================================================

const positiveDecimal = z.coerce
  .number()
  .positive('Must be greater than 0')

const nonNegativeDecimal = z.coerce
  .number()
  .min(0, 'Cannot be negative')

const percentageNumber = z.coerce
  .number()
  .int('Must be a whole number')
  .min(0, 'Cannot be less than 0')
  .max(100, 'Cannot be greater than 100')

const phoneRegex = /^[+]?[0-9\s()-]{7,20}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/

// ================================================
// BUDGET VALIDATION SCHEMAS
// ================================================

export const createBudgetSchema = z.object({
  name: z.string()
    .min(1, 'Budget name is required')
    .max(255, 'Budget name is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  fiscal_year: z.coerce
    .number()
    .int('Fiscal year must be a whole number')
    .min(2020, 'Fiscal year must be 2020 or later')
    .max(2100, 'Fiscal year must be before 2100'),
  period: z.enum(['quarterly', 'annual', 'custom']),
  quarter: z.coerce
    .number()
    .int()
    .min(1)
    .max(4)
    .optional(),
  total_amount: positiveDecimal,
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})
  .refine(data => new Date(data.end_date) > new Date(data.start_date), {
    message: 'End date must be after start date',
    path: ['end_date'],
  })
  .refine(
    data => data.period !== 'quarterly' || data.quarter !== undefined,
    {
      message: 'Quarter is required for quarterly budgets',
      path: ['quarter'],
    }
  )

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  total_amount: positiveDecimal.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['draft', 'approved', 'active', 'closed']).optional(),
})

export const allocateBudgetSchema = z.object({
  budget_id: z.string().uuid('Invalid budget ID'),
  allocations: z.array(
    z.object({
      vertical_name: z.string().min(1, 'Vertical name is required').max(100),
      category_name: z.string().max(100).optional(),
      allocated_amount: positiveDecimal,
      description: z.string().max(500).optional(),
    })
  ).min(1, 'At least one allocation is required'),
})

export const deleteBudgetSchema = z.object({
  budget_id: z.string().uuid('Invalid budget ID'),
})

// ================================================
// EXPENSE CATEGORY VALIDATION SCHEMAS
// ================================================

export const createExpenseCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Category name is too long'),
  description: z.string().max(500).optional(),
  parent_category_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  icon: z.string().max(50).optional(),
  chapter_id: z.string().uuid().optional(),
})

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  parent_category_id: z.string().uuid().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
})

export const deleteExpenseCategorySchema = z.object({
  category_id: z.string().uuid('Invalid category ID'),
})

// ================================================
// EXPENSE VALIDATION SCHEMAS
// ================================================

export const createExpenseSchema = z.object({
  title: z.string()
    .min(1, 'Expense title is required')
    .max(255, 'Expense title is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  amount: positiveDecimal,
  expense_date: z.string().min(1, 'Expense date is required'),
  category_id: z.string().uuid('Invalid category ID'),
  event_id: z.string().uuid('Invalid event ID').optional(),
  budget_id: z.string().uuid('Invalid budget ID').optional(),
  vendor_name: z.string().max(255).optional(),
  vendor_contact: z.string().max(100).optional(),
  invoice_number: z.string().max(100).optional(),
  tax_amount: nonNegativeDecimal.optional(),
  other_charges: nonNegativeDecimal.optional(),
  notes: z.string().max(1000).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

export const updateExpenseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  amount: positiveDecimal.optional(),
  expense_date: z.string().optional(),
  category_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional().nullable(),
  budget_id: z.string().uuid().optional().nullable(),
  vendor_name: z.string().max(255).optional(),
  vendor_contact: z.string().max(100).optional(),
  invoice_number: z.string().max(100).optional(),
  payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']).optional(),
  payment_date: z.string().optional(),
  payment_reference: z.string().max(100).optional(),
  tax_amount: nonNegativeDecimal.optional(),
  other_charges: nonNegativeDecimal.optional(),
  notes: z.string().max(1000).optional(),
})

export const submitExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
})

export const approveExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
  payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']).optional(),
  payment_date: z.string().optional(),
  payment_reference: z.string().max(100).optional(),
})

export const rejectExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
  rejection_reason: z.string()
    .min(1, 'Rejection reason is required')
    .max(500, 'Rejection reason is too long'),
})

export const deleteExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
})

export const uploadExpenseReceiptSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
  file_name: z.string().min(1, 'File name is required').max(255),
  file_path: z.string().min(1, 'File path is required'),
  file_size: z.number().positive().optional(),
  file_type: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
})

export const deleteExpenseReceiptSchema = z.object({
  receipt_id: z.string().uuid('Invalid receipt ID'),
})

// ================================================
// SPONSOR VALIDATION SCHEMAS
// ================================================

export const createSponsorSchema = z.object({
  organization_name: z.string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name is too long'),
  industry: z.string().max(100).optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  contact_person_name: z.string().max(255).optional(),
  contact_person_designation: z.string().max(100).optional(),
  contact_email: z.string()
    .regex(emailRegex, 'Invalid email format')
    .optional()
    .or(z.literal('')),
  contact_phone: z.string()
    .regex(phoneRegex, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  country: z.string().max(100).default('India'),
  relationship_status: z.string().max(50).default('prospect'),
  first_contact_date: z.string().optional(),
  next_followup_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().max(2000).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

export const updateSponsorSchema = z.object({
  organization_name: z.string().min(1).max(255).optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  contact_person_name: z.string().max(255).optional(),
  contact_person_designation: z.string().max(100).optional(),
  contact_email: z.string().regex(emailRegex).optional().or(z.literal('')),
  contact_phone: z.string().regex(phoneRegex).optional().or(z.literal('')),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  relationship_status: z.string().max(50).optional(),
  last_contact_date: z.string().optional(),
  next_followup_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
})

export const deleteSponsorSchema = z.object({
  sponsor_id: z.string().uuid('Invalid sponsor ID'),
})

// ================================================
// SPONSORSHIP TIER VALIDATION SCHEMAS
// ================================================

export const createSponsorshipTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(100),
  tier_level: z.enum(['platinum', 'gold', 'silver', 'bronze', 'supporter']),
  min_amount: positiveDecimal,
  max_amount: positiveDecimal.optional(),
  benefits: z.array(z.string()).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})
  .refine(
    data => !data.max_amount || data.max_amount > data.min_amount,
    {
      message: 'Max amount must be greater than min amount',
      path: ['max_amount'],
    }
  )

export const updateSponsorshipTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  min_amount: positiveDecimal.optional(),
  max_amount: positiveDecimal.optional().nullable(),
  benefits: z.array(z.string()).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
})

export const deleteSponsorshipTierSchema = z.object({
  tier_id: z.string().uuid('Invalid tier ID'),
})

// ================================================
// SPONSORSHIP DEAL VALIDATION SCHEMAS
// ================================================

export const createSponsorshipDealSchema = z.object({
  deal_name: z.string()
    .min(1, 'Deal name is required')
    .max(255, 'Deal name is too long'),
  sponsor_id: z.string().uuid('Invalid sponsor ID'),
  tier_id: z.string().uuid('Invalid tier ID').optional(),
  proposed_amount: positiveDecimal,
  deal_stage: z.enum([
    'prospect',
    'contacted',
    'proposal_sent',
    'negotiation',
    'committed',
    'contract_signed',
    'payment_received',
    'lost',
  ]).default('prospect'),
  proposal_date: z.string().optional(),
  expected_closure_date: z.string().optional(),
  event_id: z.string().uuid('Invalid event ID').optional(),
  fiscal_year: z.coerce.number().int().min(2020).max(2100).optional(),
  probability_percentage: percentageNumber.default(50),
  point_of_contact: z.string().uuid('Invalid user ID').optional(),
  assigned_to: z.string().uuid('Invalid user ID').optional(),
  contract_terms: z.string().max(2000).optional(),
  deliverables: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

export const updateSponsorshipDealSchema = z.object({
  deal_name: z.string().min(1).max(255).optional(),
  tier_id: z.string().uuid().optional().nullable(),
  deal_stage: z.enum([
    'prospect',
    'contacted',
    'proposal_sent',
    'negotiation',
    'committed',
    'contract_signed',
    'payment_received',
    'lost',
  ]).optional(),
  proposed_amount: positiveDecimal.optional(),
  committed_amount: positiveDecimal.optional().nullable(),
  proposal_date: z.string().optional(),
  expected_closure_date: z.string().optional(),
  commitment_date: z.string().optional(),
  contract_signed_date: z.string().optional(),
  contract_number: z.string().max(100).optional(),
  contract_terms: z.string().max(2000).optional(),
  deliverables: z.array(z.string()).optional(),
  probability_percentage: percentageNumber.optional(),
  point_of_contact: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional(),
  rejection_reason: z.string().max(500).optional(),
})

export const deleteSponsorshipDealSchema = z.object({
  deal_id: z.string().uuid('Invalid deal ID'),
})

// ================================================
// SPONSORSHIP PAYMENT VALIDATION SCHEMAS
// ================================================

export const recordSponsorshipPaymentSchema = z.object({
  deal_id: z.string().uuid('Invalid deal ID'),
  amount: positiveDecimal,
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']),
  transaction_reference: z.string().max(100).optional(),
  bank_name: z.string().max(255).optional(),
  cheque_number: z.string().max(100).optional(),
  utr_number: z.string().max(100).optional(),
  receipt_number: z.string().max(100).optional(),
  receipt_date: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const updateSponsorshipPaymentSchema = z.object({
  amount: positiveDecimal.optional(),
  payment_date: z.string().optional(),
  payment_method: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']).optional(),
  transaction_reference: z.string().max(100).optional(),
  bank_name: z.string().max(255).optional(),
  cheque_number: z.string().max(100).optional(),
  utr_number: z.string().max(100).optional(),
  receipt_number: z.string().max(100).optional(),
  receipt_date: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const deleteSponsorshipPaymentSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID'),
})

// ================================================
// REIMBURSEMENT REQUEST VALIDATION SCHEMAS
// ================================================

export const createReimbursementRequestSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title is too long'),
  description: z.string()
    .min(1, 'Description is required')
    .max(2000, 'Description is too long'),
  amount: positiveDecimal,
  expense_date: z.string().min(1, 'Expense date is required'),
  expense_id: z.string().uuid('Invalid expense ID').optional(),
  event_id: z.string().uuid('Invalid event ID').optional(),
  payment_method_preference: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_name: z.string().max(255).optional(),
  ifsc_code: z.string()
    .regex(ifscRegex, 'Invalid IFSC code format')
    .optional()
    .or(z.literal('')),
  upi_id: z.string()
    .regex(upiRegex, 'Invalid UPI ID format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(1000).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

export const updateReimbursementRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  amount: positiveDecimal.optional(),
  expense_date: z.string().optional(),
  payment_method_preference: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_name: z.string().max(255).optional(),
  ifsc_code: z.string().regex(ifscRegex).optional().or(z.literal('')),
  upi_id: z.string().regex(upiRegex).optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
})

export const submitReimbursementRequestSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
})

export const approveReimbursementSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
  comments: z.string().max(1000).optional(),
})

export const rejectReimbursementSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
  rejection_reason: z.string()
    .min(1, 'Rejection reason is required')
    .max(500, 'Rejection reason is too long'),
})

export const payReimbursementSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
  payment_reference: z.string()
    .min(1, 'Payment reference is required')
    .max(100, 'Payment reference is too long'),
})

export const deleteReimbursementRequestSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
})

// ================================================
// PAYMENT METHOD VALIDATION SCHEMAS
// ================================================

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'Payment method name is required').max(100),
  type: z.enum(['bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online']),
  account_number: z.string().max(50).optional(),
  bank_name: z.string().max(255).optional(),
  ifsc_code: z.string().regex(ifscRegex).optional().or(z.literal('')),
  upi_id: z.string().regex(upiRegex).optional().or(z.literal('')),
  is_default: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

export const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  account_number: z.string().max(50).optional(),
  bank_name: z.string().max(255).optional(),
  ifsc_code: z.string().regex(ifscRegex).optional().or(z.literal('')),
  upi_id: z.string().regex(upiRegex).optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  notes: z.string().max(500).optional(),
})

export const deletePaymentMethodSchema = z.object({
  method_id: z.string().uuid('Invalid payment method ID'),
})

// ================================================
// FILTER VALIDATION SCHEMAS
// ================================================

export const budgetFiltersSchema = z.object({
  fiscal_year: z.coerce.number().int().optional(),
  period: z.enum(['quarterly', 'annual', 'custom']).optional(),
  status: z.union([
    z.enum(['draft', 'approved', 'active', 'closed']),
    z.array(z.enum(['draft', 'approved', 'active', 'closed'])),
  ]).optional(),
  search: z.string().optional(),
  is_overbudget: z.boolean().optional(),
  is_near_limit: z.boolean().optional(),
})

export const expenseFiltersSchema = z.object({
  category_id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
  event_id: z.string().uuid().optional(),
  budget_id: z.string().uuid().optional(),
  status: z.union([
    z.enum(['draft', 'submitted', 'approved', 'rejected', 'paid']),
    z.array(z.enum(['draft', 'submitted', 'approved', 'rejected', 'paid'])),
  ]).optional(),
  submitted_by: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  has_receipts: z.boolean().optional(),
  search: z.string().optional(),
})

export const sponsorFiltersSchema = z.object({
  industry: z.union([z.string(), z.array(z.string())]).optional(),
  relationship_status: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.union([
    z.enum(['low', 'medium', 'high']),
    z.array(z.enum(['low', 'medium', 'high'])),
  ]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  is_active: z.boolean().optional(),
  search: z.string().optional(),
})

export const sponsorshipDealFiltersSchema = z.object({
  sponsor_id: z.string().uuid().optional(),
  tier_id: z.string().uuid().optional(),
  deal_stage: z.union([
    z.enum(['prospect', 'contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed', 'payment_received', 'lost']),
    z.array(z.enum(['prospect', 'contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed', 'payment_received', 'lost'])),
  ]).optional(),
  fiscal_year: z.coerce.number().int().optional(),
  event_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  expected_closure_from: z.string().optional(),
  expected_closure_to: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  search: z.string().optional(),
})

export const reimbursementFiltersSchema = z.object({
  requester_id: z.string().uuid().optional(),
  status: z.union([
    z.enum(['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid']),
    z.array(z.enum(['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid'])),
  ]).optional(),
  current_approver_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  is_overdue: z.boolean().optional(),
  search: z.string().optional(),
})

// ================================================
// EXPORT ALL SCHEMAS
// ================================================

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
export type AllocateBudgetInput = z.infer<typeof allocateBudgetSchema>

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>

export type CreateSponsorshipTierInput = z.infer<typeof createSponsorshipTierSchema>
export type UpdateSponsorshipTierInput = z.infer<typeof updateSponsorshipTierSchema>

export type CreateSponsorshipDealInput = z.infer<typeof createSponsorshipDealSchema>
export type UpdateSponsorshipDealInput = z.infer<typeof updateSponsorshipDealSchema>

export type RecordSponsorshipPaymentInput = z.infer<typeof recordSponsorshipPaymentSchema>
export type UpdateSponsorshipPaymentInput = z.infer<typeof updateSponsorshipPaymentSchema>

export type CreateReimbursementRequestInput = z.infer<typeof createReimbursementRequestSchema>
export type UpdateReimbursementRequestInput = z.infer<typeof updateReimbursementRequestSchema>
export type ApproveReimbursementInput = z.infer<typeof approveReimbursementSchema>
export type RejectReimbursementInput = z.infer<typeof rejectReimbursementSchema>
export type PayReimbursementInput = z.infer<typeof payReimbursementSchema>

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>

export type BudgetFilters = z.infer<typeof budgetFiltersSchema>
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>
export type SponsorFilters = z.infer<typeof sponsorFiltersSchema>
export type SponsorshipDealFilters = z.infer<typeof sponsorshipDealFiltersSchema>
export type ReimbursementFilters = z.infer<typeof reimbursementFiltersSchema>
