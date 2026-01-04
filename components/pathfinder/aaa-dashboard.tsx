'use client'

/**
 * AAA Pathfinder Dashboard Component
 *
 * Chair's view of all verticals' AAA status.
 * Shows progress, commitments, mentors, and first event dates.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Megaphone,
  Rocket,
  Shield,
  Target,
  CalendarCheck,
  Lock,
  Users,
  FileSignature,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import type { PathfinderDashboard, VerticalAAAStatus } from '@/types/aaa'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface AAAPDashboardProps {
  dashboard: PathfinderDashboard
}

export function AAADashboard({ dashboard }: AAAPDashboardProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards')

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verticals</p>
                  <p className="text-2xl font-bold">{dashboard.total_verticals}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.verticals_with_plans} with AAA plans
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plans Approved</p>
                  <p className="text-2xl font-bold">{dashboard.plans_approved}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <Progress
                value={(dashboard.plans_approved / dashboard.total_verticals) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Commitments</p>
                  <p className="text-2xl font-bold">{dashboard.commitments_signed}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <FileSignature className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cards signed by EC Chairs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mentors</p>
                  <p className="text-2xl font-bold">{dashboard.mentors_assigned}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Assigned to EC Chairs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. AAA Progress</p>
                  <p className="text-2xl font-bold">{dashboard.avg_aaa_completion}%</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
              </div>
              <Progress value={dashboard.avg_aaa_completion} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Activities Logged</p>
                  <p className="text-2xl font-bold">{dashboard.health_card_total_activities}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.health_card_total_participants} participants • {dashboard.health_card_activities_this_month} this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex justify-end gap-2">
          <Button
            variant={view === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('cards')}
          >
            Cards
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('table')}
          >
            Table
          </Button>
        </div>

        {/* Verticals Grid/Table */}
        {view === 'cards' ? (
          <VerticalCards verticals={dashboard.verticals} />
        ) : (
          <VerticalTable verticals={dashboard.verticals} />
        )}
      </div>
    </TooltipProvider>
  )
}

function VerticalCards({ verticals }: { verticals: VerticalAAAStatus[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {verticals.map((v) => (
        <Card key={v.vertical_id} className="overflow-hidden">
          {/* Vertical Header with Color */}
          <div
            className="h-2"
            style={{ backgroundColor: v.vertical_color || '#6366f1' }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${v.vertical_color}20` || '#6366f120' }}
                >
                  <span className="text-xl">{v.vertical_icon || '📊'}</span>
                </div>
                <div>
                  <CardTitle className="text-base">{v.vertical_name}</CardTitle>
                  {v.ec_chair_name ? (
                    <CardDescription className="flex items-center gap-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={v.ec_chair_avatar || ''} />
                        <AvatarFallback className="text-[8px]">
                          {v.ec_chair_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {v.ec_chair_name}
                    </CardDescription>
                  ) : (
                    <CardDescription className="text-amber-600">
                      No EC Chair assigned
                    </CardDescription>
                  )}
                </div>
              </div>
              <StatusBadge status={v.plan_status} hasPlan={v.has_plan} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AAA Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AAA Progress</span>
                <span className="font-medium">{v.aaa_completion}%</span>
              </div>
              <Progress value={v.aaa_completion} className="h-2" />
              <div className="flex gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1",
                        v.awareness_count === 3 && "bg-blue-50 border-blue-200"
                      )}
                    >
                      <Megaphone className="h-3 w-3" />
                      {v.awareness_count}/3
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Awareness: {v.awareness_count} of 3 completed</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1",
                        v.action_count === 2 && "bg-orange-50 border-orange-200"
                      )}
                    >
                      <Rocket className="h-3 w-3" />
                      {v.action_count}/2
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Action: {v.action_count} of 2 completed</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1",
                        v.advocacy_done && "bg-purple-50 border-purple-200"
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {v.advocacy_done ? '1/1' : '0/1'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Advocacy: {v.advocacy_done ? 'Completed' : 'Pending'}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* First Event */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CalendarCheck className={cn(
                  "h-4 w-4",
                  v.first_event_locked ? "text-green-600" : "text-muted-foreground"
                )} />
                <span className="text-sm">First Event</span>
              </div>
              <div className="flex items-center gap-2">
                {v.first_event_date ? (
                  <>
                    <span className="text-sm font-medium">
                      {new Date(v.first_event_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    {v.first_event_locked && (
                      <Lock className="h-3 w-3 text-green-600" />
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            </div>

            {/* Commitment & Mentor */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <FileSignature className={cn(
                  "h-4 w-4",
                  v.commitment_signed ? "text-green-600" : "text-muted-foreground"
                )} />
                <span className="text-xs">
                  {v.commitment_signed ? 'Signed' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Users className={cn(
                  "h-4 w-4",
                  v.has_mentor ? "text-purple-600" : "text-muted-foreground"
                )} />
                <span className="text-xs truncate">
                  {v.mentor_name || 'No mentor'}
                </span>
              </div>
            </div>

            {/* View Plan Button */}
            {v.plan_id && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/pathfinder/plans/${v.plan_id}`}>
                  View Plan
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function VerticalTable({ verticals }: { verticals: VerticalAAAStatus[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vertical</TableHead>
              <TableHead>EC Chair</TableHead>
              <TableHead className="text-center">AAA</TableHead>
              <TableHead className="text-center">First Event</TableHead>
              <TableHead className="text-center">Commitment</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verticals.map((v) => (
              <TableRow key={v.vertical_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{v.vertical_icon || '📊'}</span>
                    <span className="font-medium">{v.vertical_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {v.ec_chair_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={v.ec_chair_avatar || ''} />
                        <AvatarFallback className="text-xs">
                          {v.ec_chair_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{v.ec_chair_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-amber-600">Not assigned</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">{v.aaa_completion}%</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] px-1">
                        A:{v.awareness_count}/3
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1">
                        A:{v.action_count}/2
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {v.first_event_date ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm">
                        {new Date(v.first_event_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      {v.first_event_locked && (
                        <Lock className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {v.commitment_signed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
                <TableCell>
                  {v.mentor_name ? (
                    <span className="text-sm">{v.mentor_name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={v.plan_status} hasPlan={v.has_plan} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  status,
  hasPlan,
}: {
  status: string | null
  hasPlan: boolean
}) {
  if (!hasPlan) {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-300">
        <AlertCircle className="h-3 w-3 mr-1" />
        No Plan
      </Badge>
    )
  }

  switch (status) {
    case 'approved':
    case 'active':
      return (
        <Badge className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {status === 'active' ? 'Active' : 'Approved'}
        </Badge>
      )
    case 'submitted':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      )
    case 'draft':
    default:
      return (
        <Badge variant="outline">
          Draft
        </Badge>
      )
  }
}
