'use client'

/**
 * Mobile Stat Widget Component
 *
 * Compact stat display card for mobile dashboard.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Users,
  Bell,
  Award,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  type LucideIcon
} from 'lucide-react'

// Map of icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  calendar: Calendar,
  users: Users,
  bell: Bell,
  award: Award,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  clock: Clock,
  'check-circle': CheckCircle,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
}

interface StatWidgetProps {
  id: string
  label: string
  value: string | number
  change?: number
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string // Icon name as string
  href?: string
  className?: string
}

export function StatWidget({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  href,
  className
}: StatWidgetProps) {
  // Get the icon component from the map
  const Icon = icon ? iconMap[icon.toLowerCase()] : null

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl bg-card border',
        'transition-colors',
        href && 'active:bg-accent cursor-pointer',
        className
      )}
    >
      {Icon && (
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
          <Icon className='h-5 w-5 text-primary' />
        </div>
      )}
      <div className='flex-1 min-w-0'>
        <p className='text-xs text-muted-foreground truncate'>{label}</p>
        <div className='flex items-baseline gap-2'>
          <p className='text-xl font-bold'>{value}</p>
          {change !== undefined && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                changeType === 'positive' && 'text-green-600',
                changeType === 'negative' && 'text-red-600',
                changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {changeType === 'positive' && (
                <TrendingUp className='h-3 w-3 mr-0.5' />
              )}
              {changeType === 'negative' && (
                <TrendingDown className='h-3 w-3 mr-0.5' />
              )}
              {changeType === 'neutral' && <Minus className='h-3 w-3 mr-0.5' />}
              {change > 0 ? '+' : ''}
              {change}%
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

/**
 * Stat Widget Grid
 *
 * A 2-column grid layout for stat widgets.
 */
export function StatWidgetGrid({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>
  )
}

/**
 * Stat Widget Skeleton
 *
 * Loading state for stat widgets.
 */
export function StatWidgetSkeleton() {
  return (
    <div className='flex items-center gap-3 p-4 rounded-xl bg-card border animate-pulse'>
      <div className='h-10 w-10 rounded-lg bg-muted' />
      <div className='flex-1'>
        <div className='h-3 w-16 bg-muted rounded mb-2' />
        <div className='h-6 w-12 bg-muted rounded' />
      </div>
    </div>
  )
}
