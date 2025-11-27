/**
 * Mobile Navigation for Documentation Pages
 *
 * Client component with sheet drawer for mobile navigation.
 */

'use client';

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
  Home,
  ChevronRight,
  Menu
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { useState } from 'react';

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

export function DocsMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className='lg:hidden sticky top-16 z-30 bg-background border-b px-4 py-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm min-w-0'>
          <Link
            href='/admin/docs'
            className='text-muted-foreground hover:text-foreground font-medium truncate'
          >
            User Guide
          </Link>
          <ChevronRight className='h-4 w-4 text-muted-foreground shrink-0' />
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant='outline' size='sm' className='h-8 px-2 shrink-0'>
              <Menu className='h-4 w-4 mr-1.5' />
              <span className='text-xs'>Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side='left' className='w-[280px] sm:w-80 p-0'>
            <SheetHeader className='px-4 py-4 border-b'>
              <SheetTitle className='flex items-center gap-2 text-left'>
                <BookOpen className='h-5 w-5 text-primary' />
                User Guide
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className='h-[calc(100vh-65px)]'>
              <div className='px-3 py-4'>
                <nav className='space-y-1'>
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
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
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
