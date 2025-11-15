/**
 * Awards Module - Take Pride Award Automation
 * Module 6: Nomination system, jury scoring, weighted evaluation, and certificates
 *
 * Status: Not Started (0%)
 * Priority: MEDIUM - Phase 2
 */

import { Award, Trophy, Star, Medal, FileCheck, BarChart, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function AwardsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Take Pride Award Automation</h1>
            <p className="text-muted-foreground">
              Module 6 - Nomination System, Jury Scoring & Certificate Generation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge variant="secondary">Module 6</Badge>
          <Badge variant="outline">Phase 2 - Collaboration</Badge>
          <Badge variant="destructive">Not Started</Badge>
        </div>
      </div>

      {/* Coming Soon Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This module is currently under development. It will automate the entire award lifecycle
          including nominations, jury scoring, leaderboards, and certificate generation.
        </AlertDescription>
      </Alert>

      {/* Award Process Steps */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Nomination System</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Digital nomination forms with evidence uploads and category selection
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Jury Scoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Multi-jury evaluation with weighted criteria and blind scoring options
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Weighted Scoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Configurable scoring criteria with custom weights and automatic calculation
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Leaderboards</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Real-time rankings with category-wise leaderboards and historical comparisons
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Certificate Generation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Automated certificate creation with customizable templates and bulk download
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Award Categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Configurable award categories with eligibility criteria and submission deadlines
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>Complete award lifecycle automation</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Digital nomination forms with file attachments and rich text descriptions</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Multi-level review and approval workflow</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Jury portal with blind scoring and evaluation rubrics</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Configurable scoring criteria with weighted averages</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Real-time leaderboards with filtering by category and year</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Automated certificate generation with PDF export</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Email notifications for nominations, evaluations, and results</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Historical award data and trend analysis</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Implementation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
          <CardDescription>Module 6 - Take Pride Award Automation</CardDescription>
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
              3-4 weeks for full implementation including all features and certificate automation
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <p className="text-sm text-muted-foreground">
              Module 1 (Member Hub) for nominee data; Module 7 (Communications) for notifications
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
