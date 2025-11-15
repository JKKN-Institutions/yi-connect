-- ================================================
-- MIGRATION: Financial Command Center (Module 4)
-- ================================================
-- Description: Comprehensive financial management system for Yi chapters
-- Features: Budget management, expense tracking, sponsorship pipeline,
--           reimbursement workflow, financial reporting, audit trail
-- Tables: 13 tables with RLS policies
-- Functions: 5 business logic functions
-- Triggers: 4 automated workflows
-- Version: 1.0
-- Created: 2025-11-15
-- ================================================

-- ================================================
-- ENUM TYPES
-- ================================================

CREATE TYPE budget_period AS ENUM ('quarterly', 'annual', 'custom');
CREATE TYPE budget_status AS ENUM ('draft', 'approved', 'active', 'closed');
CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid');
CREATE TYPE sponsorship_tier AS ENUM ('platinum', 'gold', 'silver', 'bronze', 'supporter');
CREATE TYPE deal_stage AS ENUM ('prospect', 'contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed', 'payment_received', 'lost');
CREATE TYPE reimbursement_status AS ENUM ('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid');
CREATE TYPE approval_action AS ENUM ('approve', 'reject', 'request_changes');
CREATE TYPE payment_method_type AS ENUM ('bank_transfer', 'cash', 'cheque', 'upi', 'credit_card', 'online');

-- ================================================
-- TABLE: budgets
-- ================================================
-- Annual and quarterly budget planning
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Budget identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fiscal_year INTEGER NOT NULL,
    period budget_period NOT NULL DEFAULT 'annual',
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),

    -- Budget details
    total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount > 0),
    allocated_amount DECIMAL(15, 2) DEFAULT 0 CHECK (allocated_amount >= 0),
    spent_amount DECIMAL(15, 2) DEFAULT 0 CHECK (spent_amount >= 0),
    committed_amount DECIMAL(15, 2) DEFAULT 0 CHECK (committed_amount >= 0),

    -- Status tracking
    status budget_status DEFAULT 'draft',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,

    -- Date range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date > start_date),
    CONSTRAINT valid_quarter CHECK (
        (period != 'quarterly') OR
        (period = 'quarterly' AND quarter IS NOT NULL)
    ),
    CONSTRAINT valid_amounts CHECK (
        allocated_amount <= total_amount AND
        spent_amount <= total_amount
    ),
    UNIQUE (chapter_id, fiscal_year, period, quarter)
);

-- Indexes
CREATE INDEX idx_budgets_chapter ON budgets(chapter_id);
CREATE INDEX idx_budgets_fiscal_year ON budgets(fiscal_year);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budgets_dates ON budgets(start_date, end_date);

-- ================================================
-- TABLE: budget_allocations
-- ================================================
-- Budget allocation by vertical/category
CREATE TABLE budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,

    -- Allocation details
    vertical_name VARCHAR(100) NOT NULL,
    category_name VARCHAR(100),
    allocated_amount DECIMAL(15, 2) NOT NULL CHECK (allocated_amount > 0),
    spent_amount DECIMAL(15, 2) DEFAULT 0 CHECK (spent_amount >= 0),

    -- Notes
    description TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (budget_id, vertical_name, category_name)
);

-- Indexes
CREATE INDEX idx_budget_allocations_budget ON budget_allocations(budget_id);
CREATE INDEX idx_budget_allocations_vertical ON budget_allocations(vertical_name);

-- ================================================
-- TABLE: expense_categories
-- ================================================
-- Master expense categories
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,

    -- Category details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,

    -- Display properties
    color VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (chapter_id, name)
);

-- Indexes
CREATE INDEX idx_expense_categories_chapter ON expense_categories(chapter_id);
CREATE INDEX idx_expense_categories_parent ON expense_categories(parent_category_id);
CREATE INDEX idx_expense_categories_active ON expense_categories(is_active);

-- ================================================
-- TABLE: expenses
-- ================================================
-- Expense transactions
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Related entities
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES expense_categories(id),

    -- Expense details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Vendor information
    vendor_name VARCHAR(255),
    vendor_contact VARCHAR(100),
    invoice_number VARCHAR(100),

    -- Payment details
    payment_method payment_method_type,
    payment_date DATE,
    payment_reference VARCHAR(100),

    -- Status tracking
    status expense_status DEFAULT 'draft',
    submitted_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Tax and additional charges
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    other_charges DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0) + COALESCE(other_charges, 0)) STORED,

    -- Notes
    notes TEXT,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_expenses_chapter ON expenses(chapter_id);
CREATE INDEX idx_expenses_event ON expenses(event_id);
CREATE INDEX idx_expenses_budget ON expenses(budget_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_submitted_by ON expenses(submitted_by);

-- ================================================
-- TABLE: expense_receipts
-- ================================================
-- Receipt file uploads for expenses
CREATE TABLE expense_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,

    -- File details
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),

    -- Metadata
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Notes
    description TEXT
);

-- Indexes
CREATE INDEX idx_expense_receipts_expense ON expense_receipts(expense_id);

-- ================================================
-- TABLE: sponsors
-- ================================================
-- Sponsor master data
CREATE TABLE sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Organization details
    organization_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(255),

    -- Primary contact
    contact_person_name VARCHAR(255),
    contact_person_designation VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',

    -- Relationship tracking
    relationship_status VARCHAR(50) DEFAULT 'prospect',
    first_contact_date DATE,
    last_contact_date DATE,
    next_followup_date DATE,

    -- Financial summary
    total_sponsored_amount DECIMAL(15, 2) DEFAULT 0,
    current_year_amount DECIMAL(15, 2) DEFAULT 0,

    -- Classification
    tags TEXT[], -- e.g., ['education', 'recurring', 'corporate']
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high

    -- Notes
    notes TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sponsors_chapter ON sponsors(chapter_id);
CREATE INDEX idx_sponsors_status ON sponsors(relationship_status);
CREATE INDEX idx_sponsors_active ON sponsors(is_active);
CREATE INDEX idx_sponsors_priority ON sponsors(priority);
CREATE INDEX idx_sponsors_followup ON sponsors(next_followup_date);

-- ================================================
-- TABLE: sponsorship_tiers
-- ================================================
-- Sponsorship tier definitions
CREATE TABLE sponsorship_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Tier details
    name VARCHAR(100) NOT NULL,
    tier_level sponsorship_tier NOT NULL,
    min_amount DECIMAL(15, 2) NOT NULL CHECK (min_amount > 0),
    max_amount DECIMAL(15, 2) CHECK (max_amount > min_amount),

    -- Benefits
    benefits TEXT[], -- Array of benefits
    description TEXT,

    -- Display
    color VARCHAR(7),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (chapter_id, tier_level)
);

-- Indexes
CREATE INDEX idx_sponsorship_tiers_chapter ON sponsorship_tiers(chapter_id);
CREATE INDEX idx_sponsorship_tiers_active ON sponsorship_tiers(is_active);

-- ================================================
-- TABLE: sponsorship_deals
-- ================================================
-- Sponsorship commitments and pipeline
CREATE TABLE sponsorship_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,

    -- Deal details
    deal_name VARCHAR(255) NOT NULL,
    tier_id UUID REFERENCES sponsorship_tiers(id),
    deal_stage deal_stage DEFAULT 'prospect',

    -- Financial details
    proposed_amount DECIMAL(15, 2) NOT NULL CHECK (proposed_amount > 0),
    committed_amount DECIMAL(15, 2),
    received_amount DECIMAL(15, 2) DEFAULT 0,

    -- Timeline
    proposal_date DATE,
    expected_closure_date DATE,
    commitment_date DATE,
    contract_signed_date DATE,

    -- Event association
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    fiscal_year INTEGER,

    -- Contract details
    contract_number VARCHAR(100),
    contract_terms TEXT,
    deliverables TEXT[],

    -- Probability and value
    probability_percentage INTEGER DEFAULT 50 CHECK (probability_percentage BETWEEN 0 AND 100),
    weighted_value DECIMAL(15, 2) GENERATED ALWAYS AS (proposed_amount * probability_percentage / 100.0) STORED,

    -- Contacts and ownership
    point_of_contact UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),

    -- Notes
    notes TEXT,
    rejection_reason TEXT,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sponsorship_deals_chapter ON sponsorship_deals(chapter_id);
CREATE INDEX idx_sponsorship_deals_sponsor ON sponsorship_deals(sponsor_id);
CREATE INDEX idx_sponsorship_deals_stage ON sponsorship_deals(deal_stage);
CREATE INDEX idx_sponsorship_deals_event ON sponsorship_deals(event_id);
CREATE INDEX idx_sponsorship_deals_assigned ON sponsorship_deals(assigned_to);
CREATE INDEX idx_sponsorship_deals_fiscal ON sponsorship_deals(fiscal_year);

-- ================================================
-- TABLE: sponsorship_payments
-- ================================================
-- Sponsorship payment tracking
CREATE TABLE sponsorship_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES sponsorship_deals(id) ON DELETE CASCADE,

    -- Payment details
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method payment_method_type NOT NULL,

    -- Transaction details
    transaction_reference VARCHAR(100),
    bank_name VARCHAR(255),
    cheque_number VARCHAR(100),
    utr_number VARCHAR(100),

    -- Receipt
    receipt_number VARCHAR(100),
    receipt_date DATE,

    -- Notes
    notes TEXT,

    -- Audit fields
    recorded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sponsorship_payments_deal ON sponsorship_payments(deal_id);
CREATE INDEX idx_sponsorship_payments_date ON sponsorship_payments(payment_date);

-- ================================================
-- TABLE: reimbursement_requests
-- ================================================
-- Reimbursement submissions
CREATE TABLE reimbursement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Related entities
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,

    -- Requester details
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    requester_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(255),
    requester_phone VARCHAR(20),

    -- Reimbursement details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,

    -- Payment details
    payment_method_preference payment_method_type,
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(255),
    ifsc_code VARCHAR(20),
    upi_id VARCHAR(100),

    -- Status tracking
    status reimbursement_status DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,

    -- Approval tracking
    current_approver_id UUID REFERENCES auth.users(id),
    final_approved_by UUID REFERENCES auth.users(id),
    final_approved_at TIMESTAMPTZ,

    -- Payment tracking
    paid_by UUID REFERENCES auth.users(id),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),

    -- Rejection
    rejection_reason TEXT,
    rejected_by UUID REFERENCES auth.users(id),
    rejected_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reimbursement_requests_chapter ON reimbursement_requests(chapter_id);
CREATE INDEX idx_reimbursement_requests_requester ON reimbursement_requests(requester_id);
CREATE INDEX idx_reimbursement_requests_status ON reimbursement_requests(status);
CREATE INDEX idx_reimbursement_requests_approver ON reimbursement_requests(current_approver_id);
CREATE INDEX idx_reimbursement_requests_event ON reimbursement_requests(event_id);

-- ================================================
-- TABLE: reimbursement_approvals
-- ================================================
-- Approval workflow tracking
CREATE TABLE reimbursement_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES reimbursement_requests(id) ON DELETE CASCADE,

    -- Approver details
    approver_id UUID NOT NULL REFERENCES auth.users(id),
    approver_level INTEGER NOT NULL DEFAULT 1,

    -- Approval action
    action approval_action,
    comments TEXT,
    action_date TIMESTAMPTZ,

    -- Workflow
    is_required BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reimbursement_approvals_request ON reimbursement_approvals(request_id);
CREATE INDEX idx_reimbursement_approvals_approver ON reimbursement_approvals(approver_id);
CREATE INDEX idx_reimbursement_approvals_completed ON reimbursement_approvals(is_completed);

-- ================================================
-- TABLE: payment_methods
-- ================================================
-- Payment method master data
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Method details
    name VARCHAR(100) NOT NULL,
    type payment_method_type NOT NULL,

    -- Account details
    account_number VARCHAR(50),
    bank_name VARCHAR(255),
    ifsc_code VARCHAR(20),
    upi_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,

    -- Notes
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (chapter_id, name)
);

-- Indexes
CREATE INDEX idx_payment_methods_chapter ON payment_methods(chapter_id);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

-- ================================================
-- TABLE: financial_audit_logs
-- ================================================
-- Complete audit trail for all financial transactions
CREATE TABLE financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

    -- Transaction details
    entity_type VARCHAR(50) NOT NULL, -- 'expense', 'budget', 'sponsorship', etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject'

    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- Financial impact
    amount_changed DECIMAL(15, 2),

    -- User tracking
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,

    -- Context
    description TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_chapter ON financial_audit_logs(chapter_id);
CREATE INDEX idx_audit_logs_entity ON financial_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_performed_by ON financial_audit_logs(performed_by);
CREATE INDEX idx_audit_logs_created ON financial_audit_logs(created_at);

-- ================================================
-- DATABASE FUNCTIONS
-- ================================================

-- Function: Calculate budget utilization percentage
CREATE OR REPLACE FUNCTION calculate_budget_utilization(p_budget_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result JSONB;
    v_budget RECORD;
BEGIN
    SELECT
        total_amount,
        allocated_amount,
        spent_amount,
        committed_amount
    INTO v_budget
    FROM budgets
    WHERE id = p_budget_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Budget not found');
    END IF;

    v_result := jsonb_build_object(
        'budget_id', p_budget_id,
        'total_amount', v_budget.total_amount,
        'allocated_amount', v_budget.allocated_amount,
        'spent_amount', v_budget.spent_amount,
        'committed_amount', v_budget.committed_amount,
        'available_amount', v_budget.total_amount - v_budget.spent_amount - v_budget.committed_amount,
        'utilization_percentage', ROUND((v_budget.spent_amount / NULLIF(v_budget.total_amount, 0) * 100)::numeric, 2),
        'allocation_percentage', ROUND((v_budget.allocated_amount / NULLIF(v_budget.total_amount, 0) * 100)::numeric, 2),
        'is_overbudget', v_budget.spent_amount > v_budget.total_amount,
        'is_near_limit', (v_budget.spent_amount / NULLIF(v_budget.total_amount, 0)) > 0.8
    );

    RETURN v_result;
END;
$$;

-- Function: Calculate sponsorship pipeline value
CREATE OR REPLACE FUNCTION calculate_sponsorship_pipeline_value(p_chapter_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH pipeline_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE deal_stage = 'prospect') as prospect_count,
            COUNT(*) FILTER (WHERE deal_stage IN ('contacted', 'proposal_sent', 'negotiation')) as active_count,
            COUNT(*) FILTER (WHERE deal_stage IN ('committed', 'contract_signed')) as committed_count,
            COUNT(*) FILTER (WHERE deal_stage = 'payment_received') as closed_count,
            COUNT(*) FILTER (WHERE deal_stage = 'lost') as lost_count,
            SUM(proposed_amount) FILTER (WHERE deal_stage IN ('contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed')) as total_pipeline_value,
            SUM(weighted_value) FILTER (WHERE deal_stage IN ('contacted', 'proposal_sent', 'negotiation', 'committed', 'contract_signed')) as weighted_pipeline_value,
            SUM(committed_amount) FILTER (WHERE deal_stage IN ('committed', 'contract_signed', 'payment_received')) as total_committed,
            SUM(received_amount) as total_received
        FROM sponsorship_deals
        WHERE (p_chapter_id IS NULL OR chapter_id = p_chapter_id)
    )
    SELECT jsonb_build_object(
        'prospect_count', COALESCE(prospect_count, 0),
        'active_count', COALESCE(active_count, 0),
        'committed_count', COALESCE(committed_count, 0),
        'closed_count', COALESCE(closed_count, 0),
        'lost_count', COALESCE(lost_count, 0),
        'total_pipeline_value', COALESCE(total_pipeline_value, 0),
        'weighted_pipeline_value', COALESCE(weighted_pipeline_value, 0),
        'total_committed', COALESCE(total_committed, 0),
        'total_received', COALESCE(total_received, 0),
        'win_rate', CASE
            WHEN (COALESCE(closed_count, 0) + COALESCE(lost_count, 0)) > 0
            THEN ROUND((COALESCE(closed_count, 0)::numeric / (COALESCE(closed_count, 0) + COALESCE(lost_count, 0))) * 100, 2)
            ELSE 0
        END
    ) INTO v_result
    FROM pipeline_stats;

    RETURN v_result;
END;
$$;

-- Function: Get pending approvals for an approver
CREATE OR REPLACE FUNCTION get_pending_approvals(p_approver_id UUID)
RETURNS TABLE (
    request_id UUID,
    request_title VARCHAR,
    requester_name VARCHAR,
    amount DECIMAL,
    submitted_at TIMESTAMPTZ,
    approver_level INTEGER,
    days_pending INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rr.id,
        rr.title,
        rr.requester_name,
        rr.amount,
        rr.submitted_at,
        ra.approver_level,
        EXTRACT(DAY FROM NOW() - rr.submitted_at)::INTEGER
    FROM reimbursement_requests rr
    INNER JOIN reimbursement_approvals ra ON rr.id = ra.request_id
    WHERE ra.approver_id = p_approver_id
      AND ra.is_completed = false
      AND rr.status = 'pending_approval'
    ORDER BY rr.submitted_at ASC;
END;
$$;

-- Function: Update budget spent amount
CREATE OR REPLACE FUNCTION update_budget_spent_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update budget spent amount when expense is approved
    IF NEW.status = 'approved' AND NEW.budget_id IS NOT NULL THEN
        UPDATE budgets
        SET
            spent_amount = spent_amount + NEW.total_amount,
            updated_at = NOW()
        WHERE id = NEW.budget_id;
    END IF;

    -- Revert budget spent amount if expense is rejected after approval
    IF OLD.status = 'approved' AND NEW.status IN ('rejected', 'draft') AND NEW.budget_id IS NOT NULL THEN
        UPDATE budgets
        SET
            spent_amount = spent_amount - OLD.total_amount,
            updated_at = NOW()
        WHERE id = NEW.budget_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Function: Update sponsor financial summary
CREATE OR REPLACE FUNCTION update_sponsor_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update sponsor total and current year amounts
    UPDATE sponsors s
    SET
        total_sponsored_amount = (
            SELECT COALESCE(SUM(received_amount), 0)
            FROM sponsorship_deals
            WHERE sponsor_id = s.id
        ),
        current_year_amount = (
            SELECT COALESCE(SUM(received_amount), 0)
            FROM sponsorship_deals
            WHERE sponsor_id = s.id
              AND fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)
        ),
        last_contact_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE s.id = NEW.sponsor_id;

    RETURN NEW;
END;
$$;

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger: Update budget utilization on expense changes
CREATE TRIGGER trigger_update_budget_on_expense
    AFTER INSERT OR UPDATE OF status, total_amount, budget_id ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_spent_amount();

-- Trigger: Update sponsor financials on payment
CREATE TRIGGER trigger_update_sponsor_on_payment
    AFTER INSERT OR UPDATE OF amount ON sponsorship_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sponsor_financials();

-- Trigger: Auto-update updated_at timestamp for budgets
CREATE TRIGGER trigger_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at timestamp for expenses
CREATE TRIGGER trigger_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at timestamp for sponsors
CREATE TRIGGER trigger_sponsors_updated_at
    BEFORE UPDATE ON sponsors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at timestamp for sponsorship_deals
CREATE TRIGGER trigger_sponsorship_deals_updated_at
    BEFORE UPDATE ON sponsorship_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at timestamp for reimbursement_requests
CREATE TRIGGER trigger_reimbursement_requests_updated_at
    BEFORE UPDATE ON reimbursement_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursement_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for budgets
CREATE POLICY "Users can view budgets in their chapter"
    ON budgets FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage budgets"
    ON budgets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for budget_allocations
CREATE POLICY "Users can view budget allocations"
    ON budget_allocations FOR SELECT
    USING (
        budget_id IN (
            SELECT id FROM budgets
            WHERE chapter_id IN (
                SELECT chapter_id FROM members WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Finance admins can manage budget allocations"
    ON budget_allocations FOR ALL
    USING (
        budget_id IN (
            SELECT id FROM budgets
            WHERE EXISTS (
                SELECT 1 FROM user_roles ur
                INNER JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid()
                  AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
            )
        )
    );

-- Policies for expense_categories
CREATE POLICY "Users can view expense categories"
    ON expense_categories FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        ) OR chapter_id IS NULL
    );

CREATE POLICY "Finance admins can manage expense categories"
    ON expense_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for expenses
CREATE POLICY "Users can view expenses in their chapter"
    ON expenses FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create their own expenses"
    ON expenses FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own draft expenses"
    ON expenses FOR UPDATE
    USING (
        created_by = auth.uid() AND status = 'draft'
    );

CREATE POLICY "Finance admins can manage all expenses"
    ON expenses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for expense_receipts
CREATE POLICY "Users can view receipts for expenses they can see"
    ON expense_receipts FOR SELECT
    USING (
        expense_id IN (
            SELECT id FROM expenses
            WHERE chapter_id IN (
                SELECT chapter_id FROM members WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can upload receipts for their expenses"
    ON expense_receipts FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid() AND
        expense_id IN (
            SELECT id FROM expenses WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage all receipts"
    ON expense_receipts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for sponsors
CREATE POLICY "Users can view sponsors in their chapter"
    ON sponsors FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage sponsors"
    ON sponsors FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for sponsorship_tiers
CREATE POLICY "Users can view sponsorship tiers"
    ON sponsorship_tiers FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage sponsorship tiers"
    ON sponsorship_tiers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for sponsorship_deals
CREATE POLICY "Users can view deals in their chapter"
    ON sponsorship_deals FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage deals"
    ON sponsorship_deals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for sponsorship_payments
CREATE POLICY "Users can view payments for deals they can see"
    ON sponsorship_payments FOR SELECT
    USING (
        deal_id IN (
            SELECT id FROM sponsorship_deals
            WHERE chapter_id IN (
                SELECT chapter_id FROM members WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Finance admins can manage payments"
    ON sponsorship_payments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for reimbursement_requests
CREATE POLICY "Users can view their own reimbursement requests"
    ON reimbursement_requests FOR SELECT
    USING (
        requester_id = auth.uid()
    );

CREATE POLICY "Approvers can view pending requests"
    ON reimbursement_requests FOR SELECT
    USING (
        id IN (
            SELECT request_id FROM reimbursement_approvals
            WHERE approver_id = auth.uid() AND is_completed = false
        )
    );

CREATE POLICY "Users can create reimbursement requests"
    ON reimbursement_requests FOR INSERT
    WITH CHECK (
        requester_id = auth.uid()
    );

CREATE POLICY "Users can update their own draft requests"
    ON reimbursement_requests FOR UPDATE
    USING (
        requester_id = auth.uid() AND status = 'draft'
    );

CREATE POLICY "Finance admins can manage all requests"
    ON reimbursement_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for reimbursement_approvals
CREATE POLICY "Approvers can view their approval tasks"
    ON reimbursement_approvals FOR SELECT
    USING (
        approver_id = auth.uid()
    );

CREATE POLICY "Finance admins can manage approvals"
    ON reimbursement_approvals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for payment_methods
CREATE POLICY "Users can view payment methods in their chapter"
    ON payment_methods FOR SELECT
    USING (
        chapter_id IN (
            SELECT chapter_id FROM members WHERE id = auth.uid()
        )
    );

CREATE POLICY "Finance admins can manage payment methods"
    ON payment_methods FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- Policies for financial_audit_logs
CREATE POLICY "Finance admins can view audit logs"
    ON financial_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('Finance Admin', 'Executive Member', 'Chair', 'Co-Chair')
        )
    );

-- ================================================
-- SEED DATA
-- ================================================

-- Seed expense categories (global)
INSERT INTO expense_categories (id, name, description, color, icon, sort_order, chapter_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Event Expenses', 'Costs related to events and programs', '#3B82F6', 'calendar', 1, NULL),
    ('22222222-2222-2222-2222-222222222222', 'Marketing & Promotion', 'Advertising, banners, promotional materials', '#8B5CF6', 'megaphone', 2, NULL),
    ('33333333-3333-3333-3333-333333333333', 'Administrative', 'Office supplies, printing, stationery', '#6B7280', 'briefcase', 3, NULL),
    ('44444444-4444-4444-4444-444444444444', 'Travel & Transportation', 'Travel expenses, fuel, vehicle rental', '#10B981', 'car', 4, NULL),
    ('55555555-5555-5555-5555-555555555555', 'Food & Beverages', 'Catering, refreshments, meals', '#F59E0B', 'utensils', 5, NULL),
    ('66666666-6666-6666-6666-666666666666', 'Venue & Equipment', 'Hall rental, equipment hire, AV systems', '#EF4444', 'home', 6, NULL),
    ('77777777-7777-7777-7777-777777777777', 'Professional Services', 'Consultancy, training, speaker fees', '#06B6D4', 'users', 7, NULL),
    ('88888888-8888-8888-8888-888888888888', 'Membership & Subscriptions', 'Platform fees, software subscriptions', '#EC4899', 'credit-card', 8, NULL),
    ('99999999-9999-9999-9999-999999999999', 'Miscellaneous', 'Other expenses not categorized above', '#64748B', 'more-horizontal', 9, NULL)
ON CONFLICT (id) DO NOTHING;

-- Seed default sponsorship tiers (these will need chapter_id to be set)
-- Note: These are templates and should be created per chapter in the application

COMMENT ON TABLE budgets IS 'Annual and quarterly budget planning with allocation tracking';
COMMENT ON TABLE budget_allocations IS 'Budget allocation by vertical/category with spend tracking';
COMMENT ON TABLE expense_categories IS 'Master expense categories for classification';
COMMENT ON TABLE expenses IS 'Expense transactions with approval workflow';
COMMENT ON TABLE expense_receipts IS 'Receipt file uploads for expense verification';
COMMENT ON TABLE sponsors IS 'Sponsor organization master data with relationship tracking';
COMMENT ON TABLE sponsorship_tiers IS 'Sponsorship tier definitions with benefits';
COMMENT ON TABLE sponsorship_deals IS 'Sponsorship pipeline and commitment tracking';
COMMENT ON TABLE sponsorship_payments IS 'Sponsorship payment tracking and reconciliation';
COMMENT ON TABLE reimbursement_requests IS 'Reimbursement submissions with approval workflow';
COMMENT ON TABLE reimbursement_approvals IS 'Multi-level approval workflow tracking';
COMMENT ON TABLE payment_methods IS 'Payment method master data';
COMMENT ON TABLE financial_audit_logs IS 'Complete audit trail for financial transactions';

-- ================================================
-- END OF MIGRATION
-- ================================================
