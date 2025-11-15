import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  BudgetStatus,
  ExpenseStatus,
  ReimbursementStatus,
  DealStage,
} from '@/types/finance'

// Budget Status Badge
interface BudgetStatusBadgeProps {
  status: BudgetStatus
  className?: string
}

export function BudgetStatusBadge({ status, className }: BudgetStatusBadgeProps) {
  const variants: Record<BudgetStatus, { label: string; variant: string; className: string }> = {
    draft: {
      label: 'Draft',
      variant: 'secondary',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    approved: {
      label: 'Approved',
      variant: 'default',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    active: {
      label: 'Active',
      variant: 'default',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    closed: {
      label: 'Closed',
      variant: 'secondary',
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

// Expense Status Badge
interface ExpenseStatusBadgeProps {
  status: ExpenseStatus
  className?: string
}

export function ExpenseStatusBadge({ status, className }: ExpenseStatusBadgeProps) {
  const variants: Record<ExpenseStatus, { label: string; className: string }> = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    submitted: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    approved: {
      label: 'Approved',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
    paid: {
      label: 'Paid',
      className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Reimbursement Status Badge
interface ReimbursementStatusBadgeProps {
  status: ReimbursementStatus
  className?: string
}

export function ReimbursementStatusBadge({ status, className }: ReimbursementStatusBadgeProps) {
  const variants: Record<ReimbursementStatus, { label: string; className: string }> = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    submitted: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    pending_approval: {
      label: 'Pending Approval',
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
    paid: {
      label: 'Paid',
      className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    },
  }

  const config = variants[status]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Deal Stage Badge
interface DealStageBadgeProps {
  stage: DealStage
  className?: string
}

export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
  const variants: Record<DealStage, { label: string; className: string }> = {
    prospect: {
      label: 'Prospect',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
    contacted: {
      label: 'Contacted',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    proposal_sent: {
      label: 'Proposal Sent',
      className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    },
    negotiation: {
      label: 'Negotiation',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    committed: {
      label: 'Committed',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
    contract_signed: {
      label: 'Contract Signed',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    payment_received: {
      label: 'Payment Received',
      className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    },
    lost: {
      label: 'Lost',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
  }

  const config = variants[stage]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Budget Period Badge
interface BudgetPeriodBadgeProps {
  period: 'quarterly' | 'annual' | 'custom'
  quarter?: number | null
  className?: string
}

export function BudgetPeriodBadge({ period, quarter, className }: BudgetPeriodBadgeProps) {
  const getLabel = () => {
    if (period === 'quarterly' && quarter) {
      return `Q${quarter}`
    }
    if (period === 'annual') {
      return 'Annual'
    }
    return 'Custom'
  }

  return (
    <Badge variant="outline" className={cn('font-medium', className)}>
      {getLabel()}
    </Badge>
  )
}

// Priority Badge (for sponsors)
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high'
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const variants: Record<'low' | 'medium' | 'high', { label: string; className: string }> = {
    low: {
      label: 'Low',
      className: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
    },
    medium: {
      label: 'Medium',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    high: {
      label: 'High',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
  }

  const config = variants[priority]

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Expense Category Badge
type ExpenseCategory = 'event' | 'operations' | 'marketing' | 'admin' | 'salary' | 'travel' | 'equipment' | 'other'

interface ExpenseCategoryBadgeProps {
  category: ExpenseCategory
  className?: string
}

export function ExpenseCategoryBadge({ category, className }: ExpenseCategoryBadgeProps) {
  const variants: Record<ExpenseCategory, { label: string; className: string }> = {
    event: {
      label: 'Event',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    operations: {
      label: 'Operations',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    marketing: {
      label: 'Marketing',
      className: 'bg-pink-100 text-pink-800 hover:bg-pink-100',
    },
    admin: {
      label: 'Admin',
      className: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
    },
    salary: {
      label: 'Salary',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    travel: {
      label: 'Travel',
      className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    },
    equipment: {
      label: 'Equipment',
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    },
    other: {
      label: 'Other',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
  }

  const config = variants[category]

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

// Payment Method Badge
type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online'

interface PaymentMethodBadgeProps {
  method: PaymentMethod
  className?: string
}

export function PaymentMethodBadge({ method, className }: PaymentMethodBadgeProps) {
  const variants: Record<PaymentMethod, { label: string; className: string }> = {
    cash: {
      label: 'Cash',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    cheque: {
      label: 'Cheque',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    bank_transfer: {
      label: 'Bank Transfer',
      className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    },
    upi: {
      label: 'UPI',
      className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    },
    credit_card: {
      label: 'Credit Card',
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    },
    online: {
      label: 'Online Payment',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
  }

  const config = variants[method]

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
