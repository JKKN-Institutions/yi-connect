import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/types/finance'
import { AlertCircle, AlertTriangle } from 'lucide-react'

interface BudgetUtilizationProps {
  totalAmount: number
  spentAmount: number
  allocatedAmount?: number
  showDetails?: boolean
  className?: string
}

export function BudgetUtilization({
  totalAmount,
  spentAmount,
  allocatedAmount,
  showDetails = true,
  className,
}: BudgetUtilizationProps) {
  const utilizationPercentage = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0
  const isOverBudget = spentAmount > totalAmount
  const isNearLimit = utilizationPercentage >= 80 && !isOverBudget

  const getProgressColor = () => {
    if (isOverBudget) return 'bg-red-500'
    if (isNearLimit) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const availableAmount = totalAmount - spentAmount

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Budget Utilization</span>
          {isOverBudget && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {isNearLimit && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </div>
        <span className={cn(
          'font-semibold',
          isOverBudget && 'text-red-600',
          isNearLimit && 'text-yellow-600'
        )}>
          {utilizationPercentage.toFixed(1)}%
        </span>
      </div>

      <Progress
        value={Math.min(utilizationPercentage, 100)}
        className="h-2"
      />

      {showDetails && (
        <div className="grid grid-cols-2 gap-4 text-sm pt-2">
          <div>
            <p className="text-muted-foreground">Total Budget</p>
            <p className="font-semibold">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Spent</p>
            <p className={cn(
              'font-semibold',
              isOverBudget && 'text-red-600'
            )}>
              {formatCurrency(spentAmount)}
            </p>
          </div>
          {allocatedAmount !== undefined && (
            <div>
              <p className="text-muted-foreground">Allocated</p>
              <p className="font-semibold">{formatCurrency(allocatedAmount)}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Available</p>
            <p className={cn(
              'font-semibold',
              availableAmount < 0 && 'text-red-600',
              availableAmount >= 0 && 'text-green-600'
            )}>
              {formatCurrency(availableAmount)}
            </p>
          </div>
        </div>
      )}

      {isOverBudget && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Budget exceeded by {formatCurrency(spentAmount - totalAmount)}
        </p>
      )}
      {isNearLimit && !isOverBudget && (
        <p className="text-xs text-yellow-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Approaching budget limit ({(100 - utilizationPercentage).toFixed(1)}% remaining)
        </p>
      )}
    </div>
  )
}
