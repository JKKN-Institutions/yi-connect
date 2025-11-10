/**
 * Member Stats Components
 *
 * Display member statistics and metrics.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  Award,
  Target,
  Briefcase,
  MapPin,
} from 'lucide-react'
import type { MemberAnalytics } from '@/types/member'

interface MemberStatsProps {
  analytics: MemberAnalytics
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp
              className={`h-3 w-3 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}
            />
            <span
              className={`text-xs ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MemberStats({ analytics }: MemberStatsProps) {
  const activePercentage = analytics.total_members
    ? Math.round((analytics.active_members / analytics.total_members) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Primary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={analytics.total_members.toLocaleString()}
          description={`${activePercentage}% active members`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Active Members"
          value={analytics.active_members.toLocaleString()}
          description="Currently active"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <StatCard
          title="New This Month"
          value={analytics.new_members_this_month.toLocaleString()}
          description="Recently joined"
          icon={<UserPlus className="h-4 w-4" />}
        />
        <StatCard
          title="Avg Engagement"
          value={analytics.avg_engagement_score}
          description="Overall engagement score"
          icon={<Award className="h-4 w-4" />}
        />
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Membership Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Membership Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(analytics.members_by_status).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize">{status}</span>
                <div className="flex items-center gap-2">
                  <Progress
                    value={(count / analytics.total_members) * 100}
                    className="w-20 h-2"
                  />
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leadership Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Leadership Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Highly Ready</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={
                    (analytics.leadership_pipeline.highly_ready / analytics.total_members) * 100
                  }
                  className="w-20 h-2"
                />
                <Badge variant="default" className="bg-green-500">
                  {analytics.leadership_pipeline.highly_ready}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ready</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={(analytics.leadership_pipeline.ready / analytics.total_members) * 100}
                  className="w-20 h-2"
                />
                <Badge variant="default" className="bg-blue-500">
                  {analytics.leadership_pipeline.ready}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Developing</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={(analytics.leadership_pipeline.developing / analytics.total_members) * 100}
                  className="w-20 h-2"
                />
                <Badge variant="secondary">{analytics.leadership_pipeline.developing}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Not Ready</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={(analytics.leadership_pipeline.not_ready / analytics.total_members) * 100}
                  className="w-20 h-2"
                />
                <Badge variant="outline">{analytics.leadership_pipeline.not_ready}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Companies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.top_companies.slice(0, 5).map((company, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[150px]">{company.company}</span>
                </div>
                <Badge variant="secondary">{company.count}</Badge>
              </div>
            ))}
            {analytics.top_companies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No company data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cities Distribution (if available) */}
      {Object.keys(analytics.members_by_city).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Members by City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(analytics.members_by_city)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{city}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface MemberScoreDisplayProps {
  engagementScore: number
  readinessScore: number
  size?: 'sm' | 'md' | 'lg'
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Average'
  return 'Needs Improvement'
}

export function MemberScoreDisplay({
  engagementScore,
  readinessScore,
  size = 'md',
}: MemberScoreDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const progressHeight = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={sizeClasses[size]}>Engagement Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`font-bold ${sizeClasses[size]} ${getScoreColor(engagementScore)}`}>
              {engagementScore}/100
            </span>
            <Badge variant="outline">{getScoreLabel(engagementScore)}</Badge>
          </div>
          <Progress value={engagementScore} className={progressHeight[size]} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Award className="h-3 w-3" />
            <span>Based on events, contributions & activity</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={sizeClasses[size]}>Leadership Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`font-bold ${sizeClasses[size]} ${getScoreColor(readinessScore)}`}>
              {readinessScore}/100
            </span>
            <Badge variant="outline">{getScoreLabel(readinessScore)}</Badge>
          </div>
          <Progress value={readinessScore} className={progressHeight[size]} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>Based on engagement, tenure, skills & experience</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
