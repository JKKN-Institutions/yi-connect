'use client'

/**
 * Mobile Bottom Navigation Component
 *
 * A fixed bottom navigation bar for mobile devices with 5 key tabs.
 * Includes badge indicators and haptic feedback support.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Calendar,
  QrCode,
  Bell,
  User
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { triggerHaptic } from '@/lib/mobile/haptics'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/m',
    icon: Home
  },
  {
    name: 'Events',
    href: '/m/events',
    icon: Calendar
  },
  {
    name: 'Check-in',
    href: '/m/checkin',
    icon: QrCode
  },
  {
    name: 'Alerts',
    href: '/m/notifications',
    icon: Bell
  },
  {
    name: 'Profile',
    href: '/m/profile',
    icon: User
  }
]

export function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread notifications count from API
  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications/unread-count')
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.count || 0)
        }
      } catch {
        // Silently fail - notifications badge will show 0
        setUnreadCount(0)
      }
    }
    fetchUnreadCount()
  }, [])

  const handleNavClick = () => {
    triggerHaptic('selection')
  }

  return (
    <nav className='fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-pb'>
      <div className='flex items-center justify-around h-16'>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/m' && pathname.startsWith(item.href))
          const Icon = item.icon
          const badge = item.name === 'Alerts' ? unreadCount : item.badge

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full',
                'transition-colors duration-200',
                'active:bg-accent/50',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className='relative'>
                <Icon
                  className={cn(
                    'h-6 w-6 transition-transform',
                    isActive && 'scale-110'
                  )}
                />
                {badge && badge > 0 && (
                  <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground'>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium',
                  isActive && 'font-semibold'
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
