import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AwardCycleWithDetails, AwardCycleStatus } from '@/types/award'
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

const STATUS_CONFIG: Record<AwardCycleStatus | 'open' | 'nominations_closed' | 'judging' | 'cancelled', { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof FileText }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  nomination_open: { label: 'Open for Nominations', variant: 'default', icon: CheckCircle2 },
  open: { label: 'Open for Nominations', variant: 'default', icon: CheckCircle2 }, // Alias for compatibility
  nomination_closed: { label: 'Nominations Closed', variant: 'outline', icon: XCircle },
  nominations_closed: { label: 'Nominations Closed', variant: 'outline', icon: XCircle }, // Alias for compatibility
  voting_open: { label: 'Voting Open', variant: 'default', icon: Users },
  voting_closed: { label: 'Voting Closed', variant: 'outline', icon: XCircle },
  judging: { label: 'Under Judging', variant: 'default', icon: Users }, // Alias for compatibility
  completed: { label: 'Completed', variant: 'outline', icon: Award },
  cancelled: { label: 'Cancelled', variant: 'secondary', icon: XCircle },
}

export function CycleCard({ cycle, showActions = true }: CycleCardProps) {
  const statusKey = (cycle.status || 'draft') as keyof typeof STATUS_CONFIG
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon

  // Calculate progress percentage
  const now = new Date()
  const start = cycle.start_date ? new Date(cycle.start_date) : null
  const end = cycle.end_date ? new Date(cycle.end_date) : null
  const total = start && end ? end.getTime() - start.getTime() : 0
  const elapsed = start ? now.getTime() - start.getTime() : 0
  const progress = total > 0 ? Math.min(Math.max((elapsed / total) * 100, 0), 100) : 0

  // Check deadlines
  const nominationDeadline = new Date(cycle.nomination_deadline)
  const juryDeadline = cycle.jury_deadline ? new Date(cycle.jury_deadline) : null
  const isNominationOpen = now <= nominationDeadline && (cycle.status === 'nomination_open' || cycle.status === 'open')
  const isJudgingOpen = juryDeadline && now <= juryDeadline && cycle.status && ['nomination_closed', 'nominations_closed', 'voting_open', 'judging'].includes(cycle.status)

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
        {cycle.status !== 'draft' && cycle.status !== 'completed' && cycle.status !== 'cancelled' && cycle.start_date && cycle.end_date && (
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
          {isJudgingOpen && juryDeadline && (
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
