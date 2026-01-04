'use client'

import {
  Activity,
  Clock,
  Shield,
  Users,
  UserCheck,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ImpersonationAnalytics } from '@/types/impersonation'

interface ImpersonationAnalyticsDashboardProps {
  analytics: ImpersonationAnalytics
}

const chartConfig = {
  sessions: {
    label: 'Sessions',
    color: 'hsl(var(--chart-1))',
  },
  actions: {
    label: 'Actions',
    color: 'hsl(var(--chart-2))',
  },
  count: {
    label: 'Count',
    color: 'hsl(var(--chart-1))',
  },
}

export function ImpersonationAnalyticsDashboard({
  analytics,
}: ImpersonationAnalyticsDashboardProps) {
  // Stats cards data
  const stats = [
    {
      title: 'Total Sessions',
      value: analytics.total_sessions,
      description: `${analytics.sessions_this_month} this month`,
      icon: Activity,
      color: 'text-blue-600',
    },
    {
      title: 'Avg Duration',
      value: `${analytics.avg_duration_minutes} min`,
      description: 'Per session',
      icon: Clock,
      color: 'text-green-600',
    },
    {
      title: 'Unique Users',
      value: analytics.unique_users_impersonated,
      description: 'Users impersonated',
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: 'Active Admins',
      value: analytics.active_admins_count,
      description: 'Using impersonation',
      icon: Shield,
      color: 'text-orange-600',
    },
  ]

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Prepare line chart data with formatted dates
  const lineChartData = analytics.sessions_by_day.map((day) => ({
    ...day,
    displayDate: formatDate(day.date),
  }))

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sessions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Sessions Over Time
            </CardTitle>
            <CardDescription>Last 30 days of impersonation activity</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart
                data={lineChartData}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Sessions"
                  stroke="var(--color-sessions)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="actions"
                  name="Actions"
                  stroke="var(--color-actions)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Sessions by Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              Sessions by Role
            </CardTitle>
            <CardDescription>Distribution of impersonated user roles</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart
                data={analytics.sessions_by_role}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="role_name"
                  type="category"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  name="Sessions"
                  fill="var(--color-count)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Impersonated Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Most Impersonated Users
            </CardTitle>
            <CardDescription>Top 10 users by impersonation count</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.most_impersonated_users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No impersonation data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.most_impersonated_users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.user_name}</p>
                          <p className="text-xs text-muted-foreground">{user.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.user_role}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{user.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Most Active Admins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Most Active Admins
            </CardTitle>
            <CardDescription>Top 10 admins by usage</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.most_active_admins.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No impersonation data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.most_active_admins.map((admin) => (
                    <TableRow key={admin.admin_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{admin.admin_name}</p>
                          <p className="text-xs text-muted-foreground">{admin.admin_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {admin.session_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{admin.total_actions}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Period Summary</CardTitle>
          <CardDescription>Impersonation activity breakdown by time period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-3xl font-bold">{analytics.sessions_this_week}</p>
              <p className="text-xs text-muted-foreground">sessions</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold">{analytics.sessions_this_month}</p>
              <p className="text-xs text-muted-foreground">sessions</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">All Time</p>
              <p className="text-3xl font-bold">{analytics.total_sessions}</p>
              <p className="text-xs text-muted-foreground">sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Empty state component when no analytics data
 */
export function ImpersonationAnalyticsEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No impersonation sessions have been recorded yet. Analytics will appear here
          once admins start using the impersonation feature.
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for the analytics dashboard
 */
export function ImpersonationAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-40 bg-muted animate-pulse rounded" />
              <div className="h-4 w-60 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
