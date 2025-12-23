/**
 * Dashboard Sidebar
 *
 * Main navigation sidebar for the dashboard with collapsible dropdown menus.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  Building2,
  MessageSquare,
  MessageCircle,
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
  Briefcase,
  ShoppingCart,
  PieChart,
  ShieldCheck,
  Send,
  Bell,
  Users2,
  Trophy,
  Target,
  Activity,
  RefreshCw,
  Megaphone,
  Upload,
  Search,
  ClipboardList,
  HelpCircle
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';

/**
 * Check if user has any of the specified roles
 */
function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  // Super Admin and National Admin have access to everything
  if (
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin')
  ) {
    return true;
  }
  // Check if user has any of the required roles
  return requiredRoles.some((role) => userRoles.includes(role));
}

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  requiredRoles?: string[]; // Roles required to see this menu item
  items?: {
    name: string;
    href: string;
    icon?: any;
    requiredRoles?: string[]; // Roles required to see this sub-item
  }[];
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    name: 'Members',
    icon: Users,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
    items: [
      {
        name: 'All Members',
        href: '/members',
        icon: TableIcon,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Grid View',
        href: '/members/grid',
        icon: Grid3x3,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Analytics',
        href: '/members/analytics',
        icon: TrendingUp,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Skill/Will Matrix',
        href: '/members/skill-will-matrix',
        icon: Target,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Member',
        href: '/members/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Bulk Upload',
        href: '/members/bulk-upload',
        icon: Upload,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      }
    ]
  },
  {
    name: 'Events',
    icon: Calendar,
    items: [
      {
        name: 'All Events',
        href: '/events',
        icon: CalendarDays
      },
      {
        name: 'Table View',
        href: '/events/table',
        icon: TableIcon
      },
      {
        name: 'Manage Events',
        href: '/events/manage',
        icon: List,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Create Event',
        href: '/events/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      }
    ]
  },
  {
    name: 'Finance',
    icon: Wallet,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
    items: [
      {
        name: 'Overview',
        href: '/finance',
        icon: LayoutDashboard,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Budgets',
        href: '/finance/budgets',
        icon: DollarSign,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Expenses',
        href: '/finance/expenses',
        icon: Receipt,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Sponsorships',
        href: '/finance/sponsorships',
        icon: Handshake,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Reimbursements',
        href: '/finance/reimbursements',
        icon: ReceiptText,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Budget',
        href: '/finance/budgets/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Expense',
        href: '/finance/expenses/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Sponsor',
        href: '/finance/sponsorships/sponsors/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Deal',
        href: '/finance/sponsorships/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'New Request',
        href: '/finance/reimbursements/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      }
    ]
  },
  {
    name: 'Stakeholders',
    icon: Building2,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
    items: [
      {
        name: 'Overview',
        href: '/stakeholders',
        icon: LayoutDashboard,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Schools',
        href: '/stakeholders/schools',
        icon: Building2,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Colleges',
        href: '/stakeholders/colleges',
        icon: GraduationCap,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Industries',
        href: '/stakeholders/industries',
        icon: Factory,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Government',
        href: '/stakeholders/government',
        icon: Landmark,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'NGOs',
        href: '/stakeholders/ngos',
        icon: Users,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Vendors',
        href: '/stakeholders/vendors',
        icon: Package,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Speakers',
        href: '/stakeholders/speakers',
        icon: Mic,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      }
    ]
  },
  {
    name: 'Industrial Visits',
    icon: Briefcase,
    items: [
      {
        name: 'Marketplace',
        href: '/industrial-visits/marketplace',
        icon: ShoppingCart
      },
      {
        name: 'My Bookings',
        href: '/industrial-visits/my-bookings',
        icon: List
      },
      {
        name: 'Admin',
        href: '/industrial-visits/admin',
        icon: ShieldCheck,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Analytics',
        href: '/industrial-visits/analytics',
        icon: PieChart,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Visit Requests',
        href: '/visit-requests',
        icon: ClipboardList,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'New Request',
        href: '/visit-requests/new',
        icon: Plus
      }
    ]
  },
  {
    name: 'Opportunities',
    icon: Briefcase,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'],
    items: [
      {
        name: 'Browse',
        href: '/opportunities',
        icon: Search,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'My Applications',
        href: '/opportunities/my-applications',
        icon: FileText,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Manage',
        href: '/opportunities/manage',
        icon: Settings,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Post New',
        href: '/opportunities/manage/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      }
    ]
  },
  {
    name: 'Communication Hub',
    icon: MessageSquare,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
    items: [
      {
        name: 'Overview',
        href: '/communications',
        icon: LayoutDashboard,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Announcements',
        href: '/communications/announcements',
        icon: Send,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'WhatsApp',
        href: '/communications/whatsapp',
        icon: MessageCircle,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member']
      },
      {
        name: 'WhatsApp Groups',
        href: '/communications/whatsapp/groups',
        icon: Users2,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair']
      },
      {
        name: 'Notifications',
        href: '/communications/notifications',
        icon: Bell,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Templates',
        href: '/communications/templates',
        icon: FileText,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Segments',
        href: '/communications/segments',
        icon: Users2,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'Analytics',
        href: '/communications/analytics',
        icon: TrendingUp,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      },
      {
        name: 'New Announcement',
        href: '/communications/announcements/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      }
    ]
  },
  {
    name: 'Awards',
    icon: Award,
    items: [
      {
        name: 'Overview',
        href: '/awards',
        icon: LayoutDashboard
      },
      {
        name: 'Leaderboard',
        href: '/awards/leaderboard',
        icon: Trophy
      },
      {
        name: 'My Nominations',
        href: '/awards/nominations',
        icon: FileText
      },
      {
        name: 'Nominate',
        href: '/awards/nominate',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Jury Portal',
        href: '/awards/jury',
        icon: Users2,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Admin',
        href: '/awards/admin/cycles',
        icon: ShieldCheck,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      }
    ]
  },
  {
    name: 'Knowledge',
    icon: BookOpen,
    items: [
      {
        name: 'Overview',
        href: '/knowledge',
        icon: LayoutDashboard
      },
      {
        name: 'Documents',
        href: '/knowledge/documents',
        icon: FileText
      },
      {
        name: 'Wiki Pages',
        href: '/knowledge/wiki',
        icon: BookOpen
      },
      {
        name: 'Best Practices',
        href: '/knowledge/best-practices',
        icon: Trophy
      },
      {
        name: 'Upload Document',
        href: '/knowledge/documents/upload',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      }
    ]
  },
  {
    name: 'Verticals',
    icon: Target,
    requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
    items: [
      {
        name: 'Overview',
        href: '/verticals',
        icon: LayoutDashboard,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Rankings',
        href: '/verticals/rankings',
        icon: Trophy,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Add Vertical',
        href: '/verticals/new',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      }
    ]
  },
  {
    name: 'Succession',
    icon: Activity,
    items: [
      {
        name: 'Overview',
        href: '/succession',
        icon: LayoutDashboard
      },
      {
        name: 'Apply',
        href: '/succession/apply',
        icon: FileText
      },
      {
        name: 'My Applications',
        href: '/succession/applications',
        icon: User
      },
      {
        name: 'My Nominations',
        href: '/succession/nominations',
        icon: Users
      },
      {
        name: 'Eligibility',
        href: '/succession/eligibility',
        icon: ShieldCheck
      },
      {
        name: 'Nominate',
        href: '/succession/nominate',
        icon: Plus,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Evaluations',
        href: '/succession/evaluations',
        icon: Target,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
      },
      {
        name: 'Knowledge Base',
        href: '/succession/knowledge-base',
        icon: BookOpen
      },
      {
        name: 'Admin',
        href: '/succession/admin',
        icon: Settings,
        requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
      }
    ]
  },
  {
    name: 'National',
    icon: Globe,
    requiredRoles: ['Super Admin', 'National Admin'],
    items: [
      {
        name: 'Overview',
        href: '/national',
        icon: LayoutDashboard,
        requiredRoles: ['Super Admin', 'National Admin']
      },
      {
        name: 'Events',
        href: '/national/events',
        icon: CalendarDays,
        requiredRoles: ['Super Admin', 'National Admin']
      },
      {
        name: 'Benchmarks',
        href: '/national/benchmarks',
        icon: BarChart3,
        requiredRoles: ['Super Admin', 'National Admin']
      },
      {
        name: 'Broadcasts',
        href: '/national/broadcasts',
        icon: Megaphone,
        requiredRoles: ['Super Admin', 'National Admin']
      },
      {
        name: 'Sync Status',
        href: '/national/sync',
        icon: RefreshCw,
        requiredRoles: ['Super Admin', 'National Admin']
      },
      {
        name: 'Settings',
        href: '/national/settings',
        icon: Settings,
        requiredRoles: ['Super Admin', 'National Admin']
      }
    ]
  },
  {
    name: 'Settings',
    icon: Settings,
    items: [
      {
        name: 'Profile',
        href: '/settings/profile',
        icon: User
      },
      {
        name: 'General',
        href: '/settings',
        icon: Settings
      }
    ]
  }
];

const adminNavigation: NavItem[] = [
  {
    name: 'Member Requests',
    href: '/member-requests',
    icon: UserCheck,
    requiredRoles: ['Executive Member', 'Chair', 'Co-Chair', 'EC Member']
  },
  {
    name: 'Chapters',
    href: '/admin/chapters',
    icon: MapPin,
    requiredRoles: ['Super Admin', 'National Admin']
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: UserCog,
    requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair']
  },
  {
    name: 'User Guide',
    href: '/admin/docs',
    icon: HelpCircle,
    requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair', 'Co-Chair', 'EC Member']
  }
];

function NavItemComponent({
  item,
  onNavigate
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  // Hooks must be called at the top level (before any returns)
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const [manualOpenState, setManualOpenState] = useState(false);

  // Mounted state to prevent hydration mismatch
  // usePathname() returns undefined on server but actual path on client
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If item has no subitems, render as simple link
  if (!item.items) {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href! + '/');
    const Icon = item.icon;

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
          <Icon className='h-5 w-5 shrink-0' />
          <span>{item.name}</span>
        </Link>
      </li>
    );
  }

  // Render collapsible item with subitems
  // Calculate if should be open based on active child - only after mounted to prevent hydration mismatch
  const hasActiveChild = mounted && item.items.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + '/')
  );

  // Determine open state: manual toggle takes precedence, otherwise use hasActiveChild
  // Start closed during SSR to prevent hydration mismatch
  const isOpen = isManuallyToggled ? manualOpenState : hasActiveChild;

  const handleOpenChange = (open: boolean) => {
    setIsManuallyToggled(true);
    setManualOpenState(open);
  };

  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              hasActiveChild
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className='h-5 w-5 shrink-0' />
            <span className='flex-1 text-left'>{item.name}</span>
            {isOpen ? (
              <ChevronDown className='h-4 w-4 shrink-0' />
            ) : (
              <ChevronRight className='h-4 w-4 shrink-0' />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className='mt-1'>
          <ul className='space-y-1 ml-6 pl-2 border-l border-border'>
            {item.items.map((subItem) => {
              const isActive =
                pathname === subItem.href ||
                pathname.startsWith(subItem.href + '/');
              const SubIcon = subItem.icon;

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
                    {SubIcon && <SubIcon className='h-4 w-4 shrink-0' />}
                    <span>{subItem.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

interface DashboardSidebarProps {
  userRoles: string[];
}

export function DashboardSidebar({ userRoles }: DashboardSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = () => {
    setIsOpen(false);
  };

  // Filter navigation items based on user roles
  const filteredNavigation = useMemo(() => {
    return navigation
      .map((item) => {
        // If item has no role requirements, show it to everyone
        if (!item.requiredRoles || item.requiredRoles.length === 0) {
          return item;
        }

        // Check if user has required role for this item
        if (!hasAnyRole(userRoles, item.requiredRoles)) {
          return null;
        }

        // If item has subitems, filter those too
        if (item.items) {
          const filteredItems = item.items.filter((subItem) => {
            if (!subItem.requiredRoles || subItem.requiredRoles.length === 0) {
              return true;
            }
            return hasAnyRole(userRoles, subItem.requiredRoles);
          });

          // If no subitems remain after filtering, hide the parent item
          if (filteredItems.length === 0) {
            return null;
          }

          return { ...item, items: filteredItems };
        }

        return item;
      })
      .filter((item): item is NavItem => item !== null);
  }, [userRoles]);

  // Filter admin navigation based on user roles
  const filteredAdminNavigation = useMemo(() => {
    return adminNavigation
      .filter((item) => {
        if (!item.requiredRoles || item.requiredRoles.length === 0) {
          return true;
        }
        return hasAnyRole(userRoles, item.requiredRoles);
      });
  }, [userRoles]);

  return (
    <>
      {/* Mobile Menu Button - Hidden because bottom navbar is used on mobile */}
      <div className='hidden lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 items-center justify-between'>
        <Link href='/dashboard' className='flex items-center gap-2'>
          <div className='h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center'>
            <span className='text-lg font-bold text-primary'>Yi</span>
          </div>
          <span className='text-lg font-bold'>Yi Connect</span>
        </Link>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => setIsOpen(!isOpen)}
          aria-label='Toggle menu'
        >
          {isOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
        </Button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className='lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm'
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
        <div className='flex flex-col h-full'>
          {/* Logo */}
          <div className='hidden lg:flex items-center gap-2 px-6 py-5 border-b'>
            <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
              <span className='text-2xl font-bold text-primary'>Yi</span>
            </div>
            <span className='text-2xl font-bold'>Yi Connect</span>
          </div>

          {/* Navigation */}
          <nav className='flex-1 overflow-y-auto px-3 py-4 lg:pt-4'>
            <ul className='space-y-1'>
              {filteredNavigation.map((item) => (
                <NavItemComponent
                  key={item.name}
                  item={item}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>

            {/* Admin Section - Only show if user has access to at least one admin item */}
            {filteredAdminNavigation.length > 0 && (
              <div className='mt-6'>
                <div className='flex items-center gap-2 px-3 pb-2'>
                  <Shield className='h-4 w-4 text-muted-foreground' />
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Administration
                  </h3>
                </div>
                <ul className='space-y-1'>
                  {filteredAdminNavigation.map((item) => (
                    <NavItemComponent
                      key={item.name}
                      item={item}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </ul>
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className='p-4 border-t'>
            <p className='text-xs text-muted-foreground text-center'>
              Yi Connect v1.0.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
