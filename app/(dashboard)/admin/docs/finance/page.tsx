/**
 * Financial Command Center Documentation
 *
 * Module 4: Budget management, expense tracking, sponsorships, and reimbursements.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Lightbulb } from 'lucide-react';

const budgetCreationChart = `flowchart TD
    A["New fiscal year<br/>or event"] --> B["Finance > Budgets ><br/>New Budget"]
    B --> C["Set budget name<br/>and period"]
    C --> D["Allocate amount<br/>by category"]
    D --> E["Assign to<br/>vertical/event"]
    E --> F["Submit for<br/>approval"]
    F --> G{"Chair approves?"}
    G -->|Yes| H["Budget active"]
    G -->|No| I["Revision needed"]
    I --> C

    style A fill:#f0f9ff
    style H fill:#dcfce7
    style G fill:#fef3c7`;

const expenseSubmissionChart = `flowchart TD
    A["Incur expense"] --> B["Finance > Expenses ><br/>New Expense"]
    B --> C["Upload receipt<br/>photo"]
    C --> D["System extracts<br/>details via OCR"]
    D --> E["Select budget<br/>and category"]
    E --> F["Add description"]
    F --> G["Submit for<br/>approval"]
    G --> H{"Approved?"}
    H -->|Yes| I["Deducted from<br/>budget"]
    H -->|No| J["Return with<br/>comments"]

    style A fill:#f0f9ff
    style I fill:#dcfce7
    style H fill:#fef3c7`;

const reimbursementChart = `flowchart TD
    A["Personal expense<br/>for chapter"] --> B["Finance ><br/>Reimbursements > New"]
    B --> C["Upload receipt"]
    C --> D["Enter bank details"]
    D --> E["Add purpose<br/>description"]
    E --> F["Submit request"]
    F --> G{"EM/Chair Review"}
    G -->|Approve| H["Process payment"]
    G -->|Reject| I["Notify with reason"]
    H --> J["Member notified:<br/>Payment processed"]

    style A fill:#f0f9ff
    style J fill:#dcfce7
    style G fill:#fef3c7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full financial control', 'Cross-chapter visibility', 'Budget allocation']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Create budgets', 'Approve all expenses', 'Manage sponsorships', 'Process reimbursements']
  },
  {
    role: 'Chair',
    access: 'full' as const,
    permissions: ['Approve expenses', 'View all budgets', 'Manage sponsorships']
  },
  {
    role: 'Co-Chair',
    access: 'view' as const,
    permissions: ['View budgets and expenses', 'Approve small expenses']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Submit expenses', 'View own submissions', 'Request reimbursements']
  },
  {
    role: 'Yi Member',
    access: 'none' as const,
    permissions: ['No access to finance module']
  }
];

export default function FinanceDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Financial Command Center"
        description="Comprehensive financial management including budgeting, expense tracking, sponsorship pipelines, and reimbursement workflows."
        icon={Wallet}
        moduleNumber={4}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Financial Command Center automates budgeting, expense tracking, and reimbursement
              workflows. It reduces 25+ hours/month in financial administration and creates
              transparent, real-time financial oversight.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Budgets</h4>
                <p className="text-sm text-muted-foreground">Vertical & event allocation</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Expenses</h4>
                <p className="text-sm text-muted-foreground">OCR receipts & approvals</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Sponsorships</h4>
                <p className="text-sm text-muted-foreground">Pipeline management</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Reimbursements</h4>
                <p className="text-sm text-muted-foreground">Quick claim processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Key Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Annual and quarterly budgets</li>
                <li>- Allocation by vertical/event</li>
                <li>- Real-time utilization tracking</li>
                <li>- Alert at 80% utilization</li>
                <li>- Variance analysis vs. last year</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sponsorship Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">5-stage funnel:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>1. Prospect - Not contacted</li>
                <li>2. In Discussion - Proposal sent</li>
                <li>3. Committed - Verbal agreement</li>
                <li>4. Paid - Funds received</li>
                <li>5. Past Sponsor - For renewal tracking</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Role Access */}
      <RoleAccessTable accesses={roleAccesses} title="Role-Based Access" />

      {/* Workflows */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Workflows</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 1: Budget Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={budgetCreationChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Finance &gt; Budgets &gt; New Budget</code></li>
                  <li>Enter budget name and select the time period (quarter/year)</li>
                  <li>Allocate amounts to expense categories</li>
                  <li>Assign to specific vertical or event</li>
                  <li>Submit for Chair/EM approval</li>
                  <li>Once approved, budget becomes active and trackable</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Expense Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={expenseSubmissionChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Finance &gt; Expenses &gt; New Expense</code></li>
                  <li>Upload receipt photo - OCR auto-extracts details</li>
                  <li>Verify/edit extracted amount and date</li>
                  <li>Select the budget category</li>
                  <li>Add description and submit</li>
                  <li>Track approval status in your expense list</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Reimbursement Request</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={reimbursementChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Finance &gt; Reimbursements &gt; New</code></li>
                  <li>Upload receipt for personal expense made for chapter</li>
                  <li>Enter your bank account details</li>
                  <li>Add purpose description explaining the expense</li>
                  <li>Submit request for review</li>
                  <li>Once approved, you&apos;ll receive payment notification</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Dashboard Indicators */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Dashboard Indicators</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">Green</p>
                <p className="text-sm text-muted-foreground">Under 60% utilized</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">Yellow</p>
                <p className="text-sm text-muted-foreground">60-80% utilized</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">Orange</p>
                <p className="text-sm text-muted-foreground">80-100% utilized</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600">Red</p>
                <p className="text-sm text-muted-foreground">Over budget</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Tips & Best Practices</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Submit Expenses Promptly</h4>
                <p className="text-sm text-muted-foreground">
                  Upload receipts within 48 hours of purchase for accurate budget tracking
                  and easier approval processing.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Sponsorship Follow-ups</h4>
                <p className="text-sm text-muted-foreground">
                  System sends automatic reminders every 2 weeks for sponsors in
                  &quot;In Discussion&quot; stage. Act on these promptly.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Quarterly Reviews</h4>
                <p className="text-sm text-muted-foreground">
                  Review budget utilization at the end of each quarter. Reallocate
                  from under-utilized budgets to those in need.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
