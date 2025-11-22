'use client'

/**
 * Mobile Header Component
 *
 * A compact header for mobile pages with back navigation,
 * title, and optional actions.
 */

import { useRouter } from 'next/navigation'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MobileHeaderAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface MobileHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  actions?: MobileHeaderAction[]
  className?: string
  transparent?: boolean
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  className,
  transparent = false
}: MobileHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between h-14 px-4',
        'safe-area-pt',
        transparent
          ? 'bg-transparent'
          : 'bg-background/95 backdrop-blur-sm border-b',
        className
      )}
    >
      {/* Left: Back button or spacer */}
      <div className='w-10'>
        {showBack && (
          <Button
            variant='ghost'
            size='icon'
            className='h-10 w-10 -ml-2'
            onClick={handleBack}
          >
            <ChevronLeft className='h-6 w-6' />
          </Button>
        )}
      </div>

      {/* Center: Title */}
      <div className='flex-1 text-center'>
        <h1 className='text-base font-semibold truncate'>{title}</h1>
        {subtitle && (
          <p className='text-xs text-muted-foreground truncate'>{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className='w-10'>
        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-10 w-10 -mr-2'>
                <MoreVertical className='h-5 w-5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {actions.map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    action.variant === 'destructive' && 'text-destructive'
                  )}
                >
                  {action.icon && <action.icon className='mr-2 h-4 w-4' />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}

/**
 * Simple Mobile Header
 *
 * A simplified header with just the app logo for the main dashboard.
 */
export function MobileHomeHeader() {
  return (
    <header className='sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-background/95 backdrop-blur-sm border-b safe-area-pt'>
      <div className='flex items-center gap-2'>
        <div className='h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center'>
          <span className='text-lg font-bold text-primary'>Yi</span>
        </div>
        <span className='text-lg font-bold'>Yi Connect</span>
      </div>
    </header>
  )
}
