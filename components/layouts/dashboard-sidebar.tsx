/**
 * Dashboard Sidebar
 *
 * Main navigation sidebar for the dashboard.
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  Building2,
  MessageSquare,
  Award,
  BookOpen,
  BarChart3,
  Globe,
  Menu,
  X,
  MapPin,
  Shield,
  UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Members',
    href: '/members',
    icon: Users,
  },
  {
    name: 'Events',
    href: '/events',
    icon: Calendar,
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: Wallet,
  },
  {
    name: 'Stakeholders',
    href: '/stakeholders',
    icon: Building2,
  },
  {
    name: 'Communications',
    href: '/communications',
    icon: MessageSquare,
  },
  {
    name: 'Awards',
    href: '/awards',
    icon: Award,
  },
  {
    name: 'Knowledge',
    href: '/knowledge',
    icon: BookOpen,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Leadership',
    href: '/leadership',
    icon: Globe,
  },
]

const adminNavigation = [
  {
    name: 'Member Requests',
    href: '/member-requests',
    icon: UserCheck,
  },
  {
    name: 'Chapters',
    href: '/admin/chapters',
    icon: MapPin,
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">Yi</span>
          </div>
          <span className="text-lg font-bold">Yi Connect</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-background border-r transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">Yi</span>
            </div>
            <span className="text-2xl font-bold">Yi Connect</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 lg:pt-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Admin Section */}
            <div className="mt-6">
              <div className="flex items-center gap-2 px-3 pb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </h3>
              </div>
              <ul className="space-y-1">
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = item.icon

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Yi Connect v1.0.0
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
