'use client'

/**
 * Quick Action Grid Component
 *
 * A grid of quick action buttons for common mobile tasks.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  QrCode,
  CalendarPlus,
  Users,
  Bell,
  Award,
  FileText,
  Wallet,
  Clock
} from 'lucide-react'
import { triggerHaptic } from '@/lib/mobile/haptics'
import type { QuickAction } from '@/types/mobile'

// Default quick actions for members
const defaultActions: QuickAction[] = [
  {
    id: 'checkin',
    name: 'Check-in',
    description: 'Scan QR code',
    icon: QrCode,
    href: '/m/checkin',
    variant: 'primary'
  },
  {
    id: 'events',
    name: 'Events',
    description: 'Upcoming events',
    icon: CalendarPlus,
    href: '/m/events'
  },
  {
    id: 'members',
    name: 'Members',
    description: 'Directory',
    icon: Users,
    href: '/members'
  },
  {
    id: 'notifications',
    name: 'Alerts',
    description: 'View all',
    icon: Bell,
    href: '/m/notifications'
  }
]

// Additional actions for leaders (EC, Chair, EM)
const leaderActions: QuickAction[] = [
  {
    id: 'awards',
    name: 'Awards',
    description: 'Nominations',
    icon: Award,
    href: '/awards'
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'View reports',
    icon: FileText,
    href: '/knowledge/documents'
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Budgets',
    icon: Wallet,
    href: '/finance'
  },
  {
    id: 'volunteer',
    name: 'Log Hours',
    description: 'Volunteer time',
    icon: Clock,
    href: '/m/log-hours'
  }
]

interface QuickActionGridProps {
  actions?: QuickAction[]
  showLeaderActions?: boolean
  className?: string
}

export function QuickActionGrid({
  actions = defaultActions,
  showLeaderActions = false,
  className
}: QuickActionGridProps) {
  const allActions = showLeaderActions
    ? [...actions, ...leaderActions]
    : actions

  const handleActionClick = () => {
    triggerHaptic('light')
  }

  return (
    <div className={cn('grid grid-cols-4 gap-3', className)}>
      {allActions.map((action) => (
        <QuickActionButton
          key={action.id}
          action={action}
          onClick={handleActionClick}
        />
      ))}
    </div>
  )
}

interface QuickActionButtonProps {
  action: QuickAction
  onClick?: () => void
}

function QuickActionButton({ action, onClick }: QuickActionButtonProps) {
  const Icon = action.icon
  const isPrimary = action.variant === 'primary'

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-xl',
        'transition-all active:scale-95',
        isPrimary
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border hover:bg-accent'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-6 w-6 mb-1', !isPrimary && 'text-primary')} />
      <span className='text-xs font-medium text-center leading-tight'>
        {action.name}
      </span>
    </div>
  )

  if (action.href) {
    return <Link href={action.href}>{content}</Link>
  }

  if (action.onClick) {
    return (
      <button type='button' onClick={action.onClick} className='w-full'>
        {content}
      </button>
    )
  }

  return content
}

/**
 * Quick Action List
 *
 * A vertical list layout for quick actions (alternative to grid).
 */
export function QuickActionList({
  actions = defaultActions,
  className
}: {
  actions?: QuickAction[]
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon
        const content = (
          <div
            key={action.id}
            className='flex items-center gap-3 p-3 rounded-xl bg-card border active:bg-accent transition-colors'
          >
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
              <Icon className='h-5 w-5 text-primary' />
            </div>
            <div className='flex-1'>
              <p className='text-sm font-medium'>{action.name}</p>
              {action.description && (
                <p className='text-xs text-muted-foreground'>
                  {action.description}
                </p>
              )}
            </div>
          </div>
        )

        if (action.href) {
          return (
            <Link key={action.id} href={action.href}>
              {content}
            </Link>
          )
        }

        return content
      })}
    </div>
  )
}
