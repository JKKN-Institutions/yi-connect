/**
 * Dashboard Sidebar
 *
 * Main navigation sidebar for the dashboard with collapsible dropdown menus.
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
  UserCog,
  Settings,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  Grid3x3,
  TrendingUp,
  CalendarDays,
  Plus,
  List,
  User,
  FileText,
  DollarSign,
  Receipt,
  Handshake,
  ReceiptText,
  GraduationCap,
  Factory,
  Landmark,
  Package,
  Mic,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface NavItem {
  name: string
  href?: string
  icon: any
  items?: {
    name: string
    href: string
    icon?: any
  }[]
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Members',
    icon: Users,
    items: [
      {
        name: 'All Members',
        href: '/members',
        icon: TableIcon,
      },
      {
        name: 'Grid View',
        href: '/members/grid',
        icon: Grid3x3,
      },
      {
        name: 'Analytics',
        href: '/members/analytics',
        icon: TrendingUp,
      },
      {
        name: 'Add Member',
        href: '/members/new',
        icon: Plus,
      },
    ],
  },
  {
    name: 'Events',
    icon: Calendar,
    items: [
      {
        name: 'All Events',
        href: '/events',
        icon: CalendarDays,
      },
      {
        name: 'Table View',
        href: '/events/table',
        icon: TableIcon,
      },
      {
        name: 'Manage Events',
        href: '/events/manage',
        icon: List,
      },
      {
        name: 'Create Event',
        href: '/events/new',
        icon: Plus,
      },
    ],
  },
  {
    name: 'Finance',
    icon: Wallet,
    items: [
      {
        name: 'Overview',
        href: '/finance',
        icon: LayoutDashboard,
      },
      {
        name: 'Budgets',
        href: '/finance/budgets',
        icon: DollarSign,
      },
      {
        name: 'Expenses',
        href: '/finance/expenses',
        icon: Receipt,
      },
      {
        name: 'Sponsorships',
        href: '/finance/sponsorships',
        icon: Handshake,
      },
      {
        name: 'Reimbursements',
        href: '/finance/reimbursements',
        icon: ReceiptText,
      },
      {
        name: 'Add Budget',
        href: '/finance/budgets/new',
        icon: Plus,
      },
      {
        name: 'Add Expense',
        href: '/finance/expenses/new',
        icon: Plus,
      },
      {
        name: 'Add Deal',
        href: '/finance/sponsorships/new',
        icon: Plus,
      },
      {
        name: 'New Request',
        href: '/finance/reimbursements/new',
        icon: Plus,
      },
    ],
  },
  {
    name: 'Stakeholders',
    icon: Building2,
    items: [
      {
        name: 'Overview',
        href: '/stakeholders',
        icon: LayoutDashboard,
      },
      {
        name: 'Schools',
        href: '/stakeholders/schools',
        icon: Building2,
      },
      {
        name: 'Colleges',
        href: '/stakeholders/colleges',
        icon: GraduationCap,
      },
      {
        name: 'Industries',
        href: '/stakeholders/industries',
        icon: Factory,
      },
      {
        name: 'Government',
        href: '/stakeholders/government',
        icon: Landmark,
      },
      {
        name: 'NGOs',
        href: '/stakeholders/ngos',
        icon: Users,
      },
      {
        name: 'Vendors',
        href: '/stakeholders/vendors',
        icon: Package,
      },
      {
        name: 'Speakers',
        href: '/stakeholders/speakers',
        icon: Mic,
      },
    ],
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
  {
    name: 'Settings',
    icon: Settings,
    items: [
      {
        name: 'Profile',
        href: '/settings/profile',
        icon: User,
      },
      {
        name: 'General',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
]

const adminNavigation: NavItem[] = [
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
  {
    name: 'User Management',
    href: '/admin/users',
    icon: UserCog,
  },
]

function NavItemComponent({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-expand if any child is active
    if (item.items) {
      return item.items.some(
        (child) => pathname === child.href || pathname.startsWith(child.href + '/')
      )
    }
    return false
  })

  // If item has no subitems, render as simple link
  if (!item.items) {
    const isActive = pathname === item.href || pathname.startsWith(item.href! + '/')
    const Icon = item.icon

    return (
      <li>
        <Link
          href={item.href!}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{item.name}</span>
        </Link>
      </li>
    )
  }

  // Render collapsible item with subitems
  const hasActiveChild = item.items.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + '/')
  )

  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              hasActiveChild
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">{item.name}</span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1">
          <ul className="space-y-1 ml-6 pl-2 border-l border-border">
            {item.items.map((subItem) => {
              const isActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/')
              const SubIcon = subItem.icon

              return (
                <li key={subItem.name}>
                  <Link
                    href={subItem.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {SubIcon && <SubIcon className="h-4 w-4 shrink-0" />}
                    <span>{subItem.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  const handleNavigate = () => {
    setIsOpen(false)
  }

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
              {navigation.map((item) => (
                <NavItemComponent key={item.name} item={item} onNavigate={handleNavigate} />
              ))}
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
                {adminNavigation.map((item) => (
                  <NavItemComponent key={item.name} item={item} onNavigate={handleNavigate} />
                ))}
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
