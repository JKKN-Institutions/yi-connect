import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Approach Response Status Badge
interface ApproachResponseBadgeProps {
  status: 'pending' | 'accepted' | 'declined' | 'conditional'
  className?: string
}

export function ApproachResponseBadge({ status, className }: ApproachResponseBadgeProps) {
  const variants: Record<'pending' | 'accepted' | 'declined' | 'conditional', { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
    accepted: {
      label: 'Accepted',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    declined: {
      label: 'Declined',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
    conditional: {
      label: 'Conditional',
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Timeline Step Status Badge
interface TimelineStepStatusBadgeProps {
  status: 'pending' | 'active' | 'completed' | 'overdue'
  className?: string
}

export function TimelineStepStatusBadge({ status, className }: TimelineStepStatusBadgeProps) {
  const variants: Record<'pending' | 'active' | 'completed' | 'overdue', { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    active: {
      label: 'Active',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    overdue: {
      label: 'Overdue',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Meeting Status Badge
interface MeetingStatusBadgeProps {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  className?: string
}

export function MeetingStatusBadge({ status, className }: MeetingStatusBadgeProps) {
  const variants: Record<'scheduled' | 'in_progress' | 'completed' | 'cancelled', { label: string; className: string }> = {
    scheduled: {
      label: 'Scheduled',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    in_progress: {
      label: 'In Progress',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Meeting Type Badge
interface MeetingTypeBadgeProps {
  type: 'steering_committee' | 'rc_review' | 'final_selection' | 'interview'
  className?: string
}

export function MeetingTypeBadge({ type, className }: MeetingTypeBadgeProps) {
  const variants: Record<'steering_committee' | 'rc_review' | 'final_selection' | 'interview', { label: string; className: string }> = {
    steering_committee: {
      label: 'Steering Committee',
      className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    },
    rc_review: {
      label: 'RC Review',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    final_selection: {
      label: 'Final Selection',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    interview: {
      label: 'Interview',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
  }

  const config = variants[type]

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Vote Value Badge
interface VoteBadgeProps {
  vote: 'yes' | 'no' | 'abstain'
  className?: string
}

export function VoteBadge({ vote, className }: VoteBadgeProps) {
  const variants: Record<'yes' | 'no' | 'abstain', { label: string; className: string }> = {
    yes: {
      label: 'Yes',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    no: {
      label: 'No',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
    abstain: {
      label: 'Abstain',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
  }

  const config = variants[vote]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Nomination/Application Status Badge (exists across different entities)
interface ApplicationStatusBadgeProps {
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  className?: string
}

export function ApplicationStatusBadge({ status, className }: ApplicationStatusBadgeProps) {
  const variants: Record<'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn', { label: string; className: string }> = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    submitted: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    under_review: {
      label: 'Under Review',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
    approved: {
      label: 'Approved',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
    withdrawn: {
      label: 'Withdrawn',
      className: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
