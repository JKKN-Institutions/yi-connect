# Module 4: Financial Command Center 💰

## Purpose
Automate budgeting, expense tracking, sponsorship management, and reimbursements — reducing 25+ hours/month in financial administration.

**Problems Solved:**
- Disorganized Excel sheets  
- Manual budget calculations  
- Surprise overruns  
- Delayed reimbursements  
- Annual audit chaos

**Goal:** Create transparent, real-time financial oversight.

---

## 4.1 Real-Time Budget Dashboard

### Features
- Single-glance summary: **“₹2.4L remaining this quarter.”**
- Pie chart visualization of vertical-wise spending.
- Red/yellow/green status indicators by utilization.
- Predictive insights: *“At current rate, funds will exhaust by October.”*

Reusable Component: `<FinanceDashboard/>`

---

## 4.2 Smart Expense Tracking

### Process
- Upload receipt photo → OCR extracts details.
- Voice input: *“Masoom books, 5,000 rupees.”*
- Auto-categorized by vertical + expense type.
- Approval queue for Chair/EM.
- One-click approve/reject with instant notifications.

Reusable Components: `<ExpenseSubmit/>`, `<ExpenseList/>`, `<ApprovalWorkflow/>`

---

## 4.3 Sponsorship Pipeline

### Funnel Stages
1. **Prospect** – Not contacted  
2. **In Discussion** – Proposal sent  
3. **Committed** – Verbal agreement  
4. **Paid** – Funds received  
5. **Past Sponsor** – Completed cycle

### Dashboard Example
> Prospects: 10 companies → ₹5L potential  
> In Discussion: 5 → ₹3L  
> Committed: 2 → ₹1.5L  
> Paid: 1 → ₹50K received

**Smart Follow-ups:** reminders every 2 weeks for pending discussions.

Reusable Components: `<SponsorshipProposal/>`, `<SponsorPipeline/>`, `<SponsorOutreach/>`

---

## 4.4 Member Contribution Tracker

### Features
- Tracks membership payments and renewals.
- Sends automatic reminders before expiry.
- Displays donation drive progress: *“₹17K raised (85% of ₹20K target).”*
- Supports recurring campaigns (e.g., TV drives, charity events).

Reusable Components: `<InvoiceGenerator/>`, `<RenewalCampaign/>`

---

## 4.5 Reimbursement System

### Workflow
1. Member submits: receipt photo + purpose + bank details.  
2. EM/Chair reviews → approve/reject.  
3. Approved → payment request auto-sent to CII Finance.  
4. Member notified: *“₹2,500 reimbursement processed — expect in 3 days.”*

Reusable Components: `<ReimbursementRequest/>`, `<ReimbursementQueue/>`

---

## 4.6 Budget Allocation Planner

### Features
- Annual allocation by vertical (e.g., ₹50K → Road Safety).
- Year-start planning tool with variance suggestions: *“Last year overspent by ₹20K.”*
- Quarterly review reports with trend charts.
- Reallocation suggestions for under-utilized budgets.

Reusable Components: `<BudgetAllocation/>`, `<BudgetChart/>`, `<QuarterlyReview/>`

---

## 4.7 Sponsor Benefits Tracker

### Functionality
- Monitors promised vs delivered benefits.
- Checklist (auto-generated): Backdrop logo ✓, Social Media Shoutout ✓, Certificate ✗.
- Alerts when deliverables are pending.

Reusable Component: `<SponsorBenefitTracker/>`

---

## 4.8 Automation Triggers

| Scenario | Trigger | Action |
|-----------|----------|---------|
| Budget Alert | Vertical reaches 80% of allocation | Notify Vertical + Chapter Chair |
| Approval Bottleneck | 5+ reimbursements pending >7 days | Escalate to Chair |
| Sponsorship Follow-up | No update for 2 weeks | Reminder to responsible member |
| Quarter-End Reconciliation | End of quarter | Auto-generate summary email to leadership |
| Membership Renewal | January 1 | Generate renewal invoices and progress updates |

---

## 4.9 Reusable Components Summary
**Forms:** `<ExpenseSubmit/>`, `<ReimbursementRequest/>`, `<SponsorshipProposal/>`, `<BudgetAllocation/>`, `<InvoiceGenerator/>`  
**Displays:** `<FinanceDashboard/>`, `<ExpenseList/>`, `<BudgetChart/>`, `<SponsorPipeline/>`, `<ReimbursementQueue/>`  
**Workflows:** `<QuarterlyReview/>`, `<ApprovalWorkflow/>`, `<RenewalCampaign/>`, `<SponsorOutreach/>`

---

_End of Module 4 – Financial Command Center_

