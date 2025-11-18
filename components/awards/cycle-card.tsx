import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AwardCycleWithDetails } from '@/types/award'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  Users,
  FileText,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface CycleCardProps {
  cycle: AwardCycleWithDetails
  showActions?: boolean
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
  open: { label: 'Open for Nominations', variant: 'default' as const, icon: CheckCircle2 },
  nominations_closed: { label: 'Nominations Closed', variant: 'outline' as const, icon: XCircle },
  judging: { label: 'Under Judging', variant: 'default' as const, icon: Users },
  completed: { label: 'Completed', variant: 'outline' as const, icon: Award },
  cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: XCircle },
} as const

export function CycleCard({ cycle, showActions = true }: CycleCardProps) {
  const statusConfig = STATUS_CONFIG[cycle.status || 'draft']
  const StatusIcon = statusConfig.icon

  // Calculate progress percentage
  const now = new Date()
  const start = new Date(cycle.start_date)
  const end = new Date(cycle.end_date)
  const total = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  const progress = Math.min(Math.max((elapsed / total) * 100, 0), 100)

  // Check deadlines
  const nominationDeadline = new Date(cycle.nomination_deadline)
  const juryDeadline = new Date(cycle.jury_deadline)
  const isNominationOpen = now <= nominationDeadline && cycle.status === 'open'
  const isJudgingOpen = now <= juryDeadline && cycle.status && ['nominations_closed', 'judging'].includes(cycle.status)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{cycle.cycle_name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {cycle.year}
              {cycle.period_identifier && ` - ${cycle.period_identifier}`}
            </CardDescription>
          </div>
          <Badge variant={statusConfig.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {cycle.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {cycle.description}
          </p>
        )}

        {/* Progress Bar */}
        {cycle.status !== 'draft' && cycle.status !== 'completed' && cycle.status !== 'cancelled' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cycle Progress</span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col">
            <span className="text-xl font-bold">
              {cycle._count?.nominations || 0}
            </span>
            <span className="text-xs text-muted-foreground">Nominations</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold">
              {cycle._count?.jury_members || 0}
            </span>
            <span className="text-xs text-muted-foreground">Jury Members</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold">
              {cycle._count?.winners || 0}
            </span>
            <span className="text-xs text-muted-foreground">Winners</span>
          </div>
        </div>

        {/* Deadlines */}
        <div className="space-y-2">
          {isNominationOpen && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">
                Nominations close{' '}
                <span className="font-medium text-foreground">
                  {formatDistanceToNow(nominationDeadline, { addSuffix: true })}
                </span>
              </span>
            </div>
          )}
          {isJudgingOpen && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">
                Judging ends{' '}
                <span className="font-medium text-foreground">
                  {formatDistanceToNow(juryDeadline, { addSuffix: true })}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Category Info */}
        {cycle.category && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{cycle.category.name}</span>
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="flex gap-2">
          <Button asChild variant="default" className="flex-1">
            <Link href={`/awards/cycles/${cycle.id}`}>View Details</Link>
          </Button>
          {isNominationOpen && (
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/awards/nominate?cycle=${cycle.id}`}>Nominate</Link>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
