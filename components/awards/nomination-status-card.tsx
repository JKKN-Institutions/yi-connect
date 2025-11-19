import { formatDate, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { NominationWithDetails } from '@/types/award';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
  Eye,
  Edit,
  AlertCircle
} from 'lucide-react';

interface NominationStatusCardProps {
  nomination: NominationWithDetails;
  showActions?: boolean;
  viewAs?: 'nominator' | 'nominee' | 'jury' | 'admin';
}

const STATUS_CONFIG = {
  // Database enum values
  pending: {
    label: 'Pending',
    variant: 'default' as const,
    icon: Clock,
    description: 'Awaiting review'
  },
  approved: {
    label: 'Approved',
    variant: 'default' as const,
    icon: CheckCircle2,
    description: 'Approved for judging'
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive' as const,
    icon: XCircle,
    description: 'Not accepted'
  },
  withdrawn: {
    label: 'Withdrawn',
    variant: 'secondary' as const,
    icon: XCircle,
    description: 'Nomination withdrawn'
  },
  // Form schema values (for compatibility)
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
    icon: FileText,
    description: 'Not yet submitted'
  },
  submitted: {
    label: 'Submitted',
    variant: 'default' as const,
    icon: CheckCircle2,
    description: 'Awaiting review'
  },
  under_review: {
    label: 'Under Review',
    variant: 'default' as const,
    icon: Eye,
    description: 'Being reviewed by admins'
  },
  shortlisted: {
    label: 'Shortlisted',
    variant: 'default' as const,
    icon: CheckCircle2,
    description: 'Accepted for judging'
  },
  winner: {
    label: 'Winner',
    variant: 'default' as const,
    icon: Trophy,
    description: 'Selected as winner'
  }
} as const;

export function NominationStatusCard({
  nomination,
  showActions = true,
  viewAs = 'nominator'
}: NominationStatusCardProps) {
  // Map database status to config key (handle both database enum and form schema values)
  const statusKey = nomination.status || 'pending';
  const statusConfig =
    STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const nominee = nomination.nominee;
  const nominator = nomination.nominator;
  const cycle = nomination.cycle;

  const nomineeInitials = nominee?.full_name
    ? nominee.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '??';

  // Calculate jury completion
  const totalJuryMembers = cycle?._count?.jury_members || 0;
  const juryScoresCount = nomination.jury_scores?.length || 0;
  const juryCompletionPercent =
    totalJuryMembers > 0 ? (juryScoresCount / totalJuryMembers) * 100 : 0;

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Avatar className='h-8 w-8'>
                {nominee?.avatar_url && (
                  <AvatarImage
                    src={nominee.avatar_url}
                    alt={nominee.full_name}
                  />
                )}
                <AvatarFallback className='text-xs'>
                  {nomineeInitials}
                </AvatarFallback>
              </Avatar>
              {nominee?.full_name || 'Unknown Nominee'}
            </CardTitle>
            <CardDescription>
              {cycle?.cycle_name || 'Unknown Cycle'}
              {cycle?.category && ` - ${cycle.category.name}`}
            </CardDescription>
          </div>
          <Badge variant={statusConfig.variant}>
            <StatusIcon className='mr-1 h-3 w-3' />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Nominee Details */}
        {nominee?.designation && nominee?.company && (
          <div className='text-sm text-muted-foreground'>
            {nominee.designation} at {nominee.company}
          </div>
        )}

        {/* Justification Preview */}
        <div>
          <p className='text-sm font-medium mb-1'>Justification:</p>
          <p className='text-sm text-muted-foreground line-clamp-2'>
            {nomination.justification}
          </p>
        </div>

        {/* Scores (if available) */}
        {nomination.average_score != null && nomination.average_score > 0 && (
          <div className='grid grid-cols-2 gap-3 pt-3 border-t'>
            <div className='flex flex-col'>
              <span className='text-2xl font-bold'>
                {nomination.average_score?.toFixed(2) || 'N/A'}
              </span>
              <span className='text-xs text-muted-foreground'>
                Average Score
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='text-2xl font-bold'>
                {nomination.weighted_average_score?.toFixed(2) || 'N/A'}
              </span>
              <span className='text-xs text-muted-foreground'>
                Weighted Score
              </span>
            </div>
          </div>
        )}

        {/* Jury Progress (for approved/pending nominations) */}
        {nomination.status &&
          ['approved', 'pending', 'shortlisted', 'under_review'].includes(
            nomination.status
          ) &&
          totalJuryMembers > 0 && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Jury Evaluation</span>
                <span className='font-medium'>
                  {juryScoresCount} / {totalJuryMembers} completed
                </span>
              </div>
              <Progress value={juryCompletionPercent} className='h-2' />
            </div>
          )}

        {/* Submission Details */}
        <div className='grid grid-cols-2 gap-3 text-xs pt-3 border-t'>
          {nomination.submitted_at && (
            <div>
              <span className='text-muted-foreground'>Submitted:</span>
              <div className='font-medium'>
                {formatDate(new Date(nomination.submitted_at), 'MMM dd, yyyy')}
              </div>
            </div>
          )}
          {viewAs !== 'nominee' && nominator && (
            <div>
              <span className='text-muted-foreground'>Nominated by:</span>
              <div className='font-medium'>{nominator.full_name}</div>
            </div>
          )}
          {nomination.created_at && (
            <div>
              <span className='text-muted-foreground'>Created:</span>
              <div className='font-medium'>
                {formatDistanceToNow(new Date(nomination.created_at), {
                  addSuffix: true
                })}
              </div>
            </div>
          )}
        </div>

        {/* Winner Badge */}
        {nomination.winner && (
          <div className='flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800'>
            <Trophy className='h-5 w-5 text-yellow-500' />
            <div>
              <p className='font-semibold text-sm'>
                {nomination.winner.rank === 1 && '1st Place Winner'}
                {nomination.winner.rank === 2 && '2nd Place Winner'}
                {nomination.winner.rank === 3 && '3rd Place Winner'}
              </p>
              <p className='text-xs text-muted-foreground'>
                Final Score: {nomination.winner.final_score?.toFixed(2) ?? 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Rejection Notice */}
        {nomination.status === 'rejected' && (
          <div className='flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20'>
            <AlertCircle className='h-5 w-5 text-destructive' />
            <p className='text-sm text-destructive'>
              This nomination was not accepted for this cycle.
            </p>
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className='flex gap-2'>
          <Button asChild variant='outline' className='flex-1'>
            <Link href={`/awards/nominations/${nomination.id}`}>
              <Eye className='mr-2 h-4 w-4' />
              View Details
            </Link>
          </Button>
          {((nomination.status as string) === 'draft' ||
            nomination.status === 'pending') &&
            viewAs === 'nominator' && (
              <Button asChild variant='default' className='flex-1'>
                <Link href={`/awards/nominations/${nomination.id}/edit`}>
                  <Edit className='mr-2 h-4 w-4' />
                  Edit
                </Link>
              </Button>
            )}
        </CardFooter>
      )}
    </Card>
  );
}
