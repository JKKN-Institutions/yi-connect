/**
 * Leadership Module - Succession & Leadership Pipeline
 * Module 5: Digital leadership selection with nomination tracking and evaluation
 *
 * Status: Not Started (0%)
 * Priority: MEDIUM - Phase 3
 */

import { Globe, Users, UserCheck, TrendingUp, Award, Calendar, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function LeadershipPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Succession & Leadership Pipeline</h1>
            <p className="text-muted-foreground">
              Module 5 - Digital Leadership Selection & Nomination Tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge variant="secondary">Module 5</Badge>
          <Badge variant="outline">Phase 3 - Leadership</Badge>
          <Badge variant="destructive">Not Started</Badge>
        </div>
      </div>

      {/* Coming Soon Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This module is currently under development. It will provide comprehensive leadership
          succession planning with digital nomination, evaluation, and timeline management.
        </AlertDescription>
      </Alert>

      {/* Leadership Features */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Nomination System</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Digital nomination forms for leadership positions with eligibility verification
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Evaluation Scoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Multi-criteria evaluation with weighted scoring and committee reviews
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Leadership Pipeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Track leadership readiness and potential successors for key positions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Timeline Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Automated timeline tracking for nominations, elections, and transitions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Position Mapping</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Visual organization chart with position descriptions and requirements
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">National Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Sync with national-level leadership data and succession plans
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>Comprehensive leadership succession and pipeline management</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Digital nomination submission with document uploads and statements</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Eligibility verification based on tenure, engagement, and qualifications</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Multi-stage evaluation with committee scoring and rankings</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Leadership readiness assessment linked to Member Hub analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Automated timeline management with milestone tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Position-based succession planning and talent pool identification</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Digital voting and election management</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Historical leadership data and transition archives</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Implementation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
          <CardDescription>Module 5 - Succession & Leadership Pipeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Priority</h4>
            <p className="text-sm text-muted-foreground">
              MEDIUM - Phase 3 Leadership Module (To be implemented in Q3)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Estimated Timeline</h4>
            <p className="text-sm text-muted-foreground">
              3-4 weeks for full implementation including nomination, evaluation, and timeline features
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <p className="text-sm text-muted-foreground">
              Module 1 (Member Hub) for leadership readiness data; Module 10 (National Integration) for sync
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
