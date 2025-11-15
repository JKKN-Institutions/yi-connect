/**
 * Finance Module - Financial Command Center
 * Module 4: Budgeting, expense tracking, sponsorships, and reimbursements
 *
 * Status: Not Started (0%)
 * Priority: HIGH - Phase 1
 */

import { Wallet, TrendingUp, DollarSign, Receipt, PieChart, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function FinancePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
            <p className="text-muted-foreground">
              Module 4 - Budgeting, Expense Tracking, Sponsorships & Reimbursements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge variant="secondary">Module 4</Badge>
          <Badge variant="outline">Phase 1 - Core Modules</Badge>
          <Badge variant="destructive">Not Started</Badge>
        </div>
      </div>

      {/* Coming Soon Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This module is currently under development. It will provide comprehensive financial management
          including budget planning, expense tracking, sponsorship pipelines, and reimbursement workflows.
        </AlertDescription>
      </Alert>

      {/* Planned Features Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Budget Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Annual and quarterly budget planning with allocation tracking and forecasting
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Expense Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Real-time expense entry with receipt uploads and automatic event linking
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Sponsorship Pipeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Sponsor prospect tracking with stage management and commitment monitoring
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Reimbursements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Multi-level approval workflow with payment tracking and history
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Financial Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Income statements, expense reports, and budget variance analysis
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Complete transaction history with approval logs and compliance tracking
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Implementation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
          <CardDescription>Module 4 - Financial Command Center</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Priority</h4>
            <p className="text-sm text-muted-foreground">
              HIGH - Phase 1 Core Module (To be implemented after Member Hub and Event Manager)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Estimated Timeline</h4>
            <p className="text-sm text-muted-foreground">
              3-4 weeks for full implementation including all features and testing
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <p className="text-sm text-muted-foreground">
              Requires Module 3 (Event Lifecycle Manager) for event expense linking
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
