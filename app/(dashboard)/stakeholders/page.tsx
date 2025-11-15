/**
 * Stakeholders Module - Stakeholder Relationship CRM
 * Module 2: Track schools, colleges, industries, government, NGOs, and vendors
 *
 * Status: Not Started (0%)
 * Priority: MEDIUM - Phase 2
 */

import { Building2, School, Building, Briefcase, Landmark, Users2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function StakeholdersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stakeholder Relationship CRM</h1>
            <p className="text-muted-foreground">
              Module 2 - Manage Schools, Colleges, Industries, Government, NGOs & Vendors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge variant="secondary">Module 2</Badge>
          <Badge variant="outline">Phase 2 - Collaboration</Badge>
          <Badge variant="destructive">Not Started</Badge>
        </div>
      </div>

      {/* Coming Soon Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This module is currently under development. It will provide comprehensive stakeholder relationship
          management with contact tracking, health scores, and MoU management.
        </AlertDescription>
      </Alert>

      {/* Stakeholder Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <School className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Schools & Colleges</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Educational institutions with student outreach programs and partnership opportunities
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Industries</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Corporate partners for sponsorships, CSR activities, and business collaborations
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Government Bodies</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Government agencies and departments for regulatory compliance and partnerships
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">NGOs & Social Groups</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Non-profit organizations for community service and social impact initiatives
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Vendors & Suppliers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Service providers and suppliers for events, logistics, and chapter operations
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">MoU Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Track memorandums of understanding with renewal alerts and compliance monitoring
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>Comprehensive stakeholder relationship management</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Contact database with detailed profiles and interaction history</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Relationship health scores with engagement tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>MoU tracking with document storage and renewal alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Communication logs and scheduled follow-ups</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Categorization and tagging for easy filtering</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Analytics dashboard showing stakeholder engagement trends</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Implementation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
          <CardDescription>Module 2 - Stakeholder Relationship CRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Priority</h4>
            <p className="text-sm text-muted-foreground">
              MEDIUM - Phase 2 Collaboration Module (To be implemented in Q2)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Estimated Timeline</h4>
            <p className="text-sm text-muted-foreground">
              3-4 weeks for full implementation including all stakeholder types and features
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <p className="text-sm text-muted-foreground">
              None - Can be developed independently of other modules
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
