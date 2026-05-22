/**
 * Engagement Metrics Tab Component
 *
 * Displays detailed engagement and leadership readiness metrics for a member.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Award,
  Calendar,
  Clock,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Users,
  Target,
  Star,
  CheckCircle2,
  Hand,
} from 'lucide-react'
import type { EngagementBreakdown } from '@/lib/data/members'

interface EngagementMetricsTabProps {
  breakdown: EngagementBreakdown
}

// Helper function to get score color
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// Helper function to get score background color
function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

// Helper function to get score label
function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Average'
  return 'Needs Improvement'
}

// Helper function to get readiness level label
function getReadinessLabel(score: number): string {
  if (score >= 75) return 'Highly Ready'
  if (score >= 50) return 'Ready'
  if (score >= 25) return 'Developing'
  return 'Not Ready'
}

// Helper function to get activity icon
function getActivityIcon(type: EngagementBreakdown['recentActivities'][0]['type']) {
  switch (type) {
    case 'event_attended':
      return <Calendar className="h-4 w-4 text-blue-500" />
    case 'volunteer':
      return <Hand className="h-4 w-4 text-green-500" />
    case 'feedback':
      return <MessageSquare className="h-4 w-4 text-purple-500" />
    case 'skill_added':
      return <Briefcase className="h-4 w-4 text-orange-500" />
    case 'nomination':
      return <Star className="h-4 w-4 text-yellow-500" />
    default:
      return <CheckCircle2 className="h-4 w-4 text-gray-500" />
  }
}

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Score breakdown item component
function ScoreBreakdownItem({
  label,
  score,
  icon,
  detail,
}: {
  label: string
  score: number
  icon: React.ReactNode
  detail?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
        </div>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  )
}

export function EngagementMetricsTab({ breakdown }: EngagementMetricsTabProps) {
  const hasActivities = breakdown.recentActivities.length > 0
  const hasTrendData = breakdown.monthlyTrend.some((m) => m.eventsAttended > 0)

  return (
    <div className="space-y-6">
      {/* Main Score Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Engagement Score Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Engagement Score
              </CardTitle>
              <Badge variant="outline" className={getScoreColor(breakdown.engagementScore)}>
                {getScoreLabel(breakdown.engagementScore)}
              </Badge>
            </div>
            <CardDescription>Based on events, contributions & activity in the last 12 months</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="text-center space-y-2">
              <div className={`text-5xl font-bold ${getScoreColor(breakdown.engagementScore)}`}>
                {breakdown.engagementScore}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
              <Progress
                value={breakdown.engagementScore}
                className="h-3"
              />
            </div>

            <Separator />

            {/* Score Breakdown */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Score Breakdown
              </h4>

              <ScoreBreakdownItem
                label="Attendance"
                score={breakdown.attendanceScore}
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.eventsAttended}/${breakdown.eventsRsvpd} events`}
              />

              <ScoreBreakdownItem
                label="Volunteer Hours"
                score={breakdown.volunteerScore}
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.volunteerHours} hrs`}
              />

              <ScoreBreakdownItem
                label="Feedback Given"
                score={breakdown.feedbackScore}
                icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.feedbackCount} submissions`}
              />

              <ScoreBreakdownItem
                label="Skills Added"
                score={breakdown.skillsScore}
                icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.skillsCount} skills`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Leadership Readiness Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Leadership Readiness
              </CardTitle>
              <Badge variant="outline" className={getScoreColor(breakdown.readinessScore)}>
                {getReadinessLabel(breakdown.readinessScore)}
              </Badge>
            </div>
            <CardDescription>Measures preparedness for leadership roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="text-center space-y-2">
              <div className={`text-5xl font-bold ${getScoreColor(breakdown.readinessScore)}`}>
                {breakdown.readinessScore}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
              <Progress
                value={breakdown.readinessScore}
                className="h-3"
              />
            </div>

            <Separator />

            {/* Score Breakdown */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Readiness Factors
              </h4>

              <ScoreBreakdownItem
                label="Tenure"
                score={breakdown.tenureScore}
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.tenureYears} years`}
              />

              <ScoreBreakdownItem
                label="Positions Held"
                score={breakdown.positionsScore}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.positionsHeld} positions`}
              />

              <ScoreBreakdownItem
                label="Training/Events"
                score={breakdown.trainingScore}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.eventsParticipated} attended`}
              />

              <ScoreBreakdownItem
                label="Peer Nominations"
                score={breakdown.peerInputScore}
                icon={<Star className="h-4 w-4 text-muted-foreground" />}
                detail={`${breakdown.nominationsReceived} received`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline and Trend */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest engagement activities</CardDescription>
          </CardHeader>
          <CardContent>
            {hasActivities ? (
              <div className="space-y-4">
                {breakdown.recentActivities.slice(0, 10).map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      {activity.details && (
                        <p className="text-xs text-muted-foreground">{activity.details}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(activity.date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No recent activity recorded</p>
                <p className="text-xs mt-1">
                  Attend events, volunteer, and add skills to build your activity history
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement Trend
            </CardTitle>
            <CardDescription>Activity over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {hasTrendData ? (
              <div className="space-y-4">
                {breakdown.monthlyTrend.map((month, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{month.month}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {month.eventsAttended} event{month.eventsAttended !== 1 ? 's' : ''}
                        </span>
                        <Badge
                          variant="outline"
                          className={getScoreColor(month.engagementScore)}
                        >
                          {month.engagementScore}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={month.engagementScore} className="h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No trend data available</p>
                <p className="text-xs mt-1">
                  Engage with chapter activities to see your trend over time
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
          <CardDescription>Key engagement metrics at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{breakdown.eventsAttended}</div>
              <div className="text-xs text-muted-foreground">Events Attended</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Clock className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{breakdown.volunteerHours}</div>
              <div className="text-xs text-muted-foreground">Volunteer Hours</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Briefcase className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{breakdown.skillsCount}</div>
              <div className="text-xs text-muted-foreground">Skills Listed</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Star className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold">{breakdown.nominationsReceived}</div>
              <div className="text-xs text-muted-foreground">Peer Nominations</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
