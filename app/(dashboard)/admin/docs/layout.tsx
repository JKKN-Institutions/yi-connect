/**
 * User Documentation Layout
 *
 * Shared layout for all documentation pages with sidebar navigation
 * and role-based access control (EC Members and above).
 */

import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Shield,
  Users,
  Building2,
  Calendar,
  Wallet,
  UserCog,
  Award,
  MessageSquare,
  FileText,
  Target,
  Globe,
  Briefcase,
  GraduationCap,
  Home
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocsMobileNav } from '@/components/docs/mobile-nav';

const ALLOWED_ROLES = [
  'Super Admin',
  'National Admin',
  'Executive Member',
  'Chair',
  'Co-Chair',
  'EC Member'
];

interface NavItem {
  name: string;
  href: string;
  icon: any;
  moduleNumber?: number;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/admin/docs', icon: Home },
  { name: 'Roles & Permissions', href: '/admin/docs/roles', icon: Shield }
];

const moduleNavigation: NavItem[] = [
  {
    name: 'Member Intelligence Hub',
    href: '/admin/docs/members',
    icon: Users,
    moduleNumber: 1
  },
  {
    name: 'Stakeholder CRM',
    href: '/admin/docs/stakeholders',
    icon: Building2,
    moduleNumber: 2
  },
  {
    name: 'Event Lifecycle Manager',
    href: '/admin/docs/events',
    icon: Calendar,
    moduleNumber: 3
  },
  {
    name: 'Financial Command Center',
    href: '/admin/docs/finance',
    icon: Wallet,
    moduleNumber: 4
  },
  {
    name: 'Succession & Leadership',
    href: '/admin/docs/succession',
    icon: UserCog,
    moduleNumber: 5
  },
  {
    name: 'Take Pride Awards',
    href: '/admin/docs/awards',
    icon: Award,
    moduleNumber: 6
  },
  {
    name: 'Communication Hub',
    href: '/admin/docs/communications',
    icon: MessageSquare,
    moduleNumber: 7
  },
  {
    name: 'Knowledge Management',
    href: '/admin/docs/knowledge',
    icon: FileText,
    moduleNumber: 8
  },
  {
    name: 'Vertical Performance',
    href: '/admin/docs/verticals',
    icon: Target,
    moduleNumber: 9
  },
  {
    name: 'National Integration',
    href: '/admin/docs/national',
    icon: Globe,
    moduleNumber: 10
  },
  {
    name: 'Industrial Visits',
    href: '/admin/docs/industrial-visits',
    icon: Briefcase
  },
  {
    name: 'Opportunities',
    href: '/admin/docs/opportunities',
    icon: GraduationCap
  }
];

function DocsSidebar() {
  return (
    <aside className='hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 lg:pt-16 lg:border-r bg-background'>
      <div className='flex items-center gap-2 px-6 py-4 border-b'>
        <BookOpen className='h-5 w-5 text-primary' />
        <span className='font-semibold'>User Guide</span>
      </div>
      <ScrollArea className='flex-1 px-3 py-4'>
        <nav className='space-y-1'>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className='h-4 w-4 shrink-0' />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className='mt-6 pt-6 border-t'>
          <div className='px-3 mb-2'>
            <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              Modules
            </span>
          </div>
          <nav className='space-y-1'>
            {moduleNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className='h-4 w-4 shrink-0' />
                <span className='flex-1 truncate'>{item.name}</span>
                {item.moduleNumber && (
                  <span className='text-xs text-muted-foreground'>
                    #{item.moduleNumber}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  );
}

export default async function DocsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Require EC Member or higher role
  await requireRole(ALLOWED_ROLES);

  return (
    <div className='min-h-screen'>
      <DocsSidebar />
      <DocsMobileNav />
      <main className='lg:pl-72'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
          {children}
        </div>
      </main>
    </div>
  );
}
