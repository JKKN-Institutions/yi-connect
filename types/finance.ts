// ================================================
// FINANCE MODULE TYPE DEFINITIONS
// ================================================
// Comprehensive type definitions for the Financial Command Center
// Includes budgets, expenses, sponsorships, reimbursements, and audit logs
// ================================================

import { Database } from './database';

// ================================================
// DATABASE TABLE TYPES
// ================================================

export type Budget = Database['public']['Tables']['budgets']['Row'];
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];
export type BudgetUpdate = Database['public']['Tables']['budgets']['Update'];

export type BudgetAllocation =
  Database['public']['Tables']['budget_allocations']['Row'];
export type BudgetAllocationInsert =
  Database['public']['Tables']['budget_allocations']['Insert'];
export type BudgetAllocationUpdate =
  Database['public']['Tables']['budget_allocations']['Update'];

export type ExpenseCategory =
  Database['public']['Tables']['expense_categories']['Row'];
export type ExpenseCategoryInsert =
  Database['public']['Tables']['expense_categories']['Insert'];
export type ExpenseCategoryUpdate =
  Database['public']['Tables']['expense_categories']['Update'];

export type Expense = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

export type ExpenseReceipt =
  Database['public']['Tables']['expense_receipts']['Row'];
export type ExpenseReceiptInsert =
  Database['public']['Tables']['expense_receipts']['Insert'];
export type ExpenseReceiptUpdate =
  Database['public']['Tables']['expense_receipts']['Update'];

export type Sponsor = Database['public']['Tables']['sponsors']['Row'];
export type SponsorInsert = Database['public']['Tables']['sponsors']['Insert'];
export type SponsorUpdate = Database['public']['Tables']['sponsors']['Update'];

export type SponsorshipTier =
  Database['public']['Tables']['sponsorship_tiers']['Row'];
export type SponsorshipTierInsert =
  Database['public']['Tables']['sponsorship_tiers']['Insert'];
export type SponsorshipTierUpdate =
  Database['public']['Tables']['sponsorship_tiers']['Update'];

export type SponsorshipDeal =
  Database['public']['Tables']['sponsorship_deals']['Row'];
export type SponsorshipDealInsert =
  Database['public']['Tables']['sponsorship_deals']['Insert'];
export type SponsorshipDealUpdate =
  Database['public']['Tables']['sponsorship_deals']['Update'];

export type SponsorshipPayment =
  Database['public']['Tables']['sponsorship_payments']['Row'];
export type SponsorshipPaymentInsert =
  Database['public']['Tables']['sponsorship_payments']['Insert'];
export type SponsorshipPaymentUpdate =
  Database['public']['Tables']['sponsorship_payments']['Update'];

export type ReimbursementRequest =
  Database['public']['Tables']['reimbursement_requests']['Row'];
export type ReimbursementRequestInsert =
  Database['public']['Tables']['reimbursement_requests']['Insert'];
export type ReimbursementRequestUpdate =
  Database['public']['Tables']['reimbursement_requests']['Update'];

export type ReimbursementApproval =
  Database['public']['Tables']['reimbursement_approvals']['Row'];
export type ReimbursementApprovalInsert =
  Database['public']['Tables']['reimbursement_approvals']['Insert'];
export type ReimbursementApprovalUpdate =
  Database['public']['Tables']['reimbursement_approvals']['Update'];

// NOTE: payment_methods and financial_audit_logs tables not yet implemented
// Uncomment when tables are added to the database
// export type PaymentMethod = Database['public']['Tables']['payment_methods']['Row']
// export type PaymentMethodInsert = Database['public']['Tables']['payment_methods']['Insert']
// export type PaymentMethodUpdate = Database['public']['Tables']['payment_methods']['Update']

// export type FinancialAuditLog = Database['public']['Tables']['financial_audit_logs']['Row']
// export type FinancialAuditLogInsert = Database['public']['Tables']['financial_audit_logs']['Insert']

// ================================================
// ENUM TYPES
// ================================================

export type BudgetPeriod = 'quarterly' | 'annual' | 'custom';
export type BudgetStatus = 'draft' | 'approved' | 'active' | 'closed';
export type ExpenseStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid';
export type SponsorshipTierLevel =
  | 'platinum'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'supporter';
export type DealStage =
  | 'prospect'
  | 'contacted'
  | 'proposal_sent'
  | 'negotiation'
  | 'committed'
  | 'contract_signed'
  | 'payment_received'
  | 'lost';
export type ReimbursementStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid';
export type ApprovalAction = 'approve' | 'reject' | 'request_changes';
export type PaymentMethodType =
  | 'bank_transfer'
  | 'cash'
  | 'cheque'
  | 'upi'
  | 'credit_card'
  | 'online';

// ================================================
// EXTENDED TYPES WITH RELATIONSHIPS
// ================================================

export interface BudgetWithAllocations
  extends Omit<Budget, 'status' | 'period'> {
  status: BudgetStatus;
  period: BudgetPeriod;
  allocations: BudgetAllocation[];
}

export interface BudgetWithUtilization extends Budget {
  utilization: BudgetUtilization;
  allocations?: BudgetAllocation[];
}

export interface ExpenseWithCategory extends Expense {
  category: ExpenseCategory;
  receipts?: ExpenseReceipt[];
}

export interface ExpenseWithDetails
  extends Omit<Expense, 'status' | 'payment_method'> {
  status: ExpenseStatus;
  payment_method: PaymentMethodType | null;
  category: ExpenseCategory;
  receipts: ExpenseReceipt[];
  event?: {
    id: string;
    title: string;
  };
  budget?: {
    id: string;
    name: string;
  };
  submitted_by_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
  approved_by_profile?: {
    id: string;
    full_name: string;
  };
}

export interface SponsorWithDeals extends Sponsor {
  deals: SponsorshipDeal[];
  active_deals_count: number;
  total_pipeline_value: number;
}

export interface SponsorshipDealWithSponsor extends SponsorshipDeal {
  sponsor: Sponsor;
  tier?: SponsorshipTier;
  payments?: SponsorshipPayment[];
  event?: {
    id: string;
    title: string;
  };
}

export interface SponsorshipDealFull
  extends Omit<SponsorshipDeal, 'deal_stage'> {
  deal_stage: DealStage;
  sponsor: Sponsor;
  tier?: SponsorshipTier;
  payments: SponsorshipPayment[];
  event?: {
    id: string;
    title: string;
  };
  point_of_contact_profile?: {
    id: string;
    full_name: string;
  };
  assigned_to_profile?: {
    id: string;
    full_name: string;
  };
}

export interface ReimbursementRequestWithApprovals
  extends ReimbursementRequest {
  approvals: ReimbursementApproval[];
  expense?: Expense;
  event?: {
    id: string;
    title: string;
  };
}

export interface ReimbursementRequestFull
  extends Omit<
    ReimbursementRequest,
    'status' | 'payment_method' | 'payment_method_preference'
  > {
  status: ReimbursementStatus;
  payment_method: PaymentMethodType | null;
  payment_method_preference: PaymentMethodType | null;
  approvals: (ReimbursementApproval & {
    approver: {
      id: string;
      full_name: string;
      email: string;
    };
  })[];
  expense?: ExpenseWithCategory;
  event?: {
    id: string;
    title: string;
  };
  requester_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ================================================
// DISPLAY & LIST TYPES
// ================================================

export interface BudgetListItem {
  id: string;
  name: string;
  fiscal_year: number;
  period: BudgetPeriod;
  quarter?: number;
  total_amount: number;
  spent_amount: number;
  allocated_amount: number;
  utilization_percentage: number;
  status: BudgetStatus;
  start_date: string;
  end_date: string;
  is_overbudget: boolean;
  is_near_limit: boolean;
}

export interface ExpenseListItem {
  id: string;
  title: string;
  amount: number;
  total_amount: number;
  expense_date: string;
  category: {
    id: string;
    name: string;
    color: string;
  };
  event?: {
    id: string;
    title: string;
  };
  budget?: {
    id: string;
    name: string;
  };
  vendor_name?: string | null;
  status: ExpenseStatus;
  submitted_by: {
    id: string;
    full_name: string;
  };
  has_receipts: boolean;
  created_at: string;
}

export interface SponsorListItem {
  id: string;
  organization_name: string;
  industry?: string;
  contact_person_name?: string;
  contact_email?: string;
  contact_phone?: string;
  relationship_status: string;
  total_sponsored_amount: number;
  current_year_amount: number;
  active_deals_count: number;
  next_followup_date?: string;
  priority: string;
  tags?: string[];
  is_active: boolean;
}

export interface SponsorshipDealListItem {
  id: string;
  deal_name: string;
  sponsor: {
    id: string;
    organization_name: string;
  };
  tier?: {
    id: string;
    name: string;
    tier_level: SponsorshipTierLevel;
  };
  deal_stage: DealStage;
  proposed_amount: number;
  committed_amount?: number;
  received_amount: number;
  probability_percentage: number;
  weighted_value: number;
  expected_closure_date?: string;
  assigned_to?: {
    id: string;
    full_name: string;
  };
  fiscal_year?: number;
}

export interface ReimbursementRequestListItem {
  id: string;
  title: string;
  requester_name: string;
  amount: number;
  expense_date: string;
  status: ReimbursementStatus;
  submitted_at?: string;
  current_approver?: {
    id: string;
    full_name: string;
  };
  pending_days?: number;
  event?: {
    id: string;
    title: string;
  };
}

// ================================================
// ANALYTICS & REPORTING TYPES
// ================================================

export interface BudgetUtilization {
  budget_id: string;
  total_amount: number;
  allocated_amount: number;
  spent_amount: number;
  committed_amount: number;
  available_amount: number;
  utilization_percentage: number;
  allocation_percentage: number;
  is_overbudget: boolean;
  is_near_limit: boolean;
}

export interface BudgetAnalytics {
  total_budget: number;
  total_allocated: number;
  total_spent: number;
  total_committed: number;
  total_available: number;
  overall_utilization_percentage: number;
  budgets_by_status: Record<BudgetStatus, number>;
  top_spending_categories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  monthly_spend_trend: {
    month: string;
    amount: number;
  }[];
  budget_alerts: {
    budget_id: string;
    budget_name: string;
    alert_type: 'overbudget' | 'near_limit';
    utilization_percentage: number;
  }[];
}

export interface ExpenseAnalytics {
  total_expenses: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  rejected_amount: number;
  expenses_by_status: Record<ExpenseStatus, number>;
  expenses_by_category: {
    category_id: string;
    category_name: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  monthly_trend: {
    month: string;
    count: number;
    amount: number;
  }[];
  top_events_by_expense: {
    event_id: string;
    event_title: string;
    total_amount: number;
    expense_count: number;
  }[];
}

export interface SponsorshipPipelineValue {
  prospect_count: number;
  active_count: number;
  committed_count: number;
  closed_count: number;
  lost_count: number;
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  total_committed: number;
  total_received: number;
  win_rate: number;
}

export interface SponsorshipAnalytics extends SponsorshipPipelineValue {
  deals_by_stage: Record<DealStage, number>;
  deals_by_tier: {
    tier: SponsorshipTierLevel;
    count: number;
    total_value: number;
  }[];
  top_sponsors: {
    sponsor_id: string;
    organization_name: string;
    total_amount: number;
    deal_count: number;
  }[];
  monthly_revenue: {
    month: string;
    amount: number;
  }[];
}

export interface ReimbursementAnalytics {
  total_requests: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  rejected_amount: number;
  paid_amount: number;
  requests_by_status: Record<ReimbursementStatus, number>;
  average_approval_time_days: number;
  pending_requests: ReimbursementRequestListItem[];
  overdue_requests: ReimbursementRequestListItem[];
}

export interface FinancialDashboardSummary {
  budget: BudgetAnalytics;
  expenses: ExpenseAnalytics;
  sponsorships: SponsorshipAnalytics;
  reimbursements: ReimbursementAnalytics;
  cash_flow: {
    total_income: number;
    total_expenses: number;
    net_cash_flow: number;
  };
}

// ================================================
// FILTER & QUERY PARAMETER TYPES
// ================================================

export interface BudgetFilters {
  fiscal_year?: number;
  period?: BudgetPeriod;
  status?: BudgetStatus | BudgetStatus[];
  search?: string;
  is_overbudget?: boolean;
  is_near_limit?: boolean;
}

export interface ExpenseFilters {
  category_id?: string | string[];
  event_id?: string;
  budget_id?: string;
  status?: ExpenseStatus | ExpenseStatus[];
  submitted_by?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  has_receipts?: boolean;
  search?: string;
}

export interface SponsorFilters {
  industry?: string | string[];
  relationship_status?: string | string[];
  priority?: string | string[];
  tags?: string | string[];
  is_active?: boolean;
  search?: string;
}

export interface SponsorshipDealFilters {
  sponsor_id?: string;
  tier_id?: string;
  deal_stage?: DealStage | DealStage[];
  fiscal_year?: number;
  event_id?: string;
  assigned_to?: string;
  expected_closure_from?: string;
  expected_closure_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
}

export interface ReimbursementFilters {
  requester_id?: string;
  status?: ReimbursementStatus | ReimbursementStatus[];
  current_approver_id?: string;
  event_id?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  is_overdue?: boolean;
  search?: string;
}

export interface PaginatedBudgets {
  data: BudgetListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedExpenses {
  data: ExpenseListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedSponsors {
  data: SponsorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedSponsorshipDeals {
  data: SponsorshipDealListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedReimbursements {
  data: ReimbursementRequestListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ================================================
// FORM INPUT TYPES
// ================================================

export interface CreateBudgetInput {
  name: string;
  description?: string;
  fiscal_year: number;
  period: BudgetPeriod;
  quarter?: number;
  total_amount: number;
  start_date: string;
  end_date: string;
  chapter_id: string;
}

export interface UpdateBudgetInput {
  name?: string;
  description?: string;
  total_amount?: number;
  start_date?: string;
  end_date?: string;
  status?: BudgetStatus;
}

export interface AllocateBudgetInput {
  budget_id: string;
  allocations: {
    vertical_name: string;
    category_name?: string;
    allocated_amount: number;
    description?: string;
  }[];
}

export interface CreateExpenseInput {
  title: string;
  description?: string;
  amount: number;
  expense_date: string;
  category_id: string;
  event_id?: string;
  budget_id?: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  tax_amount?: number;
  other_charges?: number;
  notes?: string;
  chapter_id: string;
}

export interface UpdateExpenseInput {
  title?: string;
  description?: string;
  amount?: number;
  expense_date?: string;
  category_id?: string;
  event_id?: string;
  budget_id?: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  payment_method?: PaymentMethodType;
  payment_date?: string;
  payment_reference?: string;
  tax_amount?: number;
  other_charges?: number;
  notes?: string;
}

export interface ApproveExpenseInput {
  expense_id: string;
  payment_method?: PaymentMethodType;
  payment_date?: string;
  payment_reference?: string;
}

export interface RejectExpenseInput {
  expense_id: string;
  rejection_reason: string;
}

export interface CreateExpenseCategoryInput {
  name: string;
  description?: string;
  parent_category_id?: string;
  color?: string;
  icon?: string;
  chapter_id?: string;
}

export interface CreateSponsorInput {
  organization_name: string;
  industry?: string;
  website?: string;
  contact_person_name?: string;
  contact_person_designation?: string;
  contact_email?: string;
  contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  relationship_status?: string;
  first_contact_date?: string;
  next_followup_date?: string;
  tags?: string[];
  priority?: string;
  notes?: string;
  chapter_id: string;
}

export interface UpdateSponsorInput {
  organization_name?: string;
  industry?: string;
  website?: string;
  contact_person_name?: string;
  contact_person_designation?: string;
  contact_email?: string;
  contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  relationship_status?: string;
  last_contact_date?: string;
  next_followup_date?: string;
  tags?: string[];
  priority?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CreateSponsorshipDealInput {
  deal_name: string;
  sponsor_id: string;
  tier_id?: string;
  proposed_amount: number;
  deal_stage?: DealStage;
  proposal_date?: string;
  expected_closure_date?: string;
  event_id?: string;
  fiscal_year?: number;
  probability_percentage?: number;
  point_of_contact?: string;
  assigned_to?: string;
  contract_terms?: string;
  deliverables?: string[];
  notes?: string;
  chapter_id: string;
}

export interface UpdateSponsorshipDealInput {
  deal_name?: string;
  tier_id?: string;
  deal_stage?: DealStage;
  proposed_amount?: number;
  committed_amount?: number;
  proposal_date?: string;
  expected_closure_date?: string;
  commitment_date?: string;
  contract_signed_date?: string;
  contract_number?: string;
  contract_terms?: string;
  deliverables?: string[];
  probability_percentage?: number;
  point_of_contact?: string;
  assigned_to?: string;
  notes?: string;
  rejection_reason?: string;
}

export interface RecordSponsorshipPaymentInput {
  deal_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethodType;
  transaction_reference?: string;
  bank_name?: string;
  cheque_number?: string;
  utr_number?: string;
  receipt_number?: string;
  receipt_date?: string;
  notes?: string;
}

export interface CreateReimbursementRequestInput {
  title: string;
  description: string;
  amount: number;
  expense_date: string;
  expense_id?: string;
  event_id?: string;
  payment_method_preference?: PaymentMethodType;
  bank_account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  upi_id?: string;
  notes?: string;
  chapter_id: string;
}

export interface UpdateReimbursementRequestInput {
  title?: string;
  description?: string;
  amount?: number;
  expense_date?: string;
  payment_method_preference?: PaymentMethodType;
  bank_account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  upi_id?: string;
  notes?: string;
}

export interface ApproveReimbursementInput {
  request_id: string;
  comments?: string;
}

export interface RejectReimbursementInput {
  request_id: string;
  rejection_reason: string;
}

export interface PayReimbursementInput {
  request_id: string;
  payment_reference: string;
}

// ================================================
// UTILITY TYPES
// ================================================

export interface PendingApproval {
  request_id: string;
  request_title: string;
  requester_name: string;
  amount: number;
  submitted_at: string;
  approver_level: number;
  days_pending: number;
}

export interface FinancialReport {
  report_type:
    | 'budget_variance'
    | 'expense_summary'
    | 'sponsorship_pipeline'
    | 'cash_flow'
    | 'income_statement';
  date_from: string;
  date_to: string;
  generated_at: string;
  data: Record<string, unknown>;
}

// ================================================
// CONSTANTS
// ================================================

export const BUDGET_PERIODS: Record<BudgetPeriod, string> = {
  quarterly: 'Quarterly',
  annual: 'Annual',
  custom: 'Custom Period'
};

export const BUDGET_STATUSES: Record<
  BudgetStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'gray' },
  approved: { label: 'Approved', color: 'blue' },
  active: { label: 'Active', color: 'green' },
  closed: { label: 'Closed', color: 'slate' }
};

export const EXPENSE_STATUSES: Record<
  ExpenseStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'gray' },
  submitted: { label: 'Submitted', color: 'blue' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  paid: { label: 'Paid', color: 'emerald' }
};

export const SPONSORSHIP_TIER_LEVELS: Record<
  SponsorshipTierLevel,
  { label: string; color: string }
> = {
  platinum: { label: 'Platinum', color: 'slate' },
  gold: { label: 'Gold', color: 'yellow' },
  silver: { label: 'Silver', color: 'gray' },
  bronze: { label: 'Bronze', color: 'orange' },
  supporter: { label: 'Supporter', color: 'blue' }
};

export const DEAL_STAGES: Record<DealStage, { label: string; color: string }> =
  {
    prospect: { label: 'Prospect', color: 'gray' },
    contacted: { label: 'Contacted', color: 'blue' },
    proposal_sent: { label: 'Proposal Sent', color: 'indigo' },
    negotiation: { label: 'Negotiation', color: 'purple' },
    committed: { label: 'Committed', color: 'orange' },
    contract_signed: { label: 'Contract Signed', color: 'amber' },
    payment_received: { label: 'Payment Received', color: 'green' },
    lost: { label: 'Lost', color: 'red' }
  };

export const REIMBURSEMENT_STATUSES: Record<
  ReimbursementStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'gray' },
  submitted: { label: 'Submitted', color: 'blue' },
  pending_approval: { label: 'Pending Approval', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  paid: { label: 'Paid', color: 'emerald' }
};

export const PAYMENT_METHOD_TYPES: Record<PaymentMethodType, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  credit_card: 'Credit Card',
  online: 'Online Payment'
};

// ================================================
// HELPER FUNCTIONS
// ================================================

export function getBudgetStatusBadge(status: BudgetStatus) {
  return BUDGET_STATUSES[status];
}

export function getExpenseStatusBadge(status: ExpenseStatus) {
  return EXPENSE_STATUSES[status];
}

export function getSponsorshipTierBadge(tier: SponsorshipTierLevel) {
  return SPONSORSHIP_TIER_LEVELS[tier];
}

export function getDealStageBadge(stage: DealStage) {
  return DEAL_STAGES[stage];
}

export function getReimbursementStatusBadge(status: ReimbursementStatus) {
  return REIMBURSEMENT_STATUSES[status];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculateUtilizationPercentage(
  spent: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((spent / total) * 100);
}

export function isOverBudget(spent: number, total: number): boolean {
  return spent > total;
}

export function isNearBudgetLimit(
  spent: number,
  total: number,
  threshold: number = 0.8
): boolean {
  if (total === 0) return false;
  return spent / total >= threshold;
}
