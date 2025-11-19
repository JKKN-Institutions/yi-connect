/**
 * Industry Portal Layout
 * Separate layout for industry users with different navigation
 */

import { Building2, CalendarClock, Users, BarChart3, Settings } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';

const industryNavigation = [
  {
    title: 'Dashboard',
    href: '/industry-portal',
    icon: BarChart3,
  },
  {
    title: 'My Slots',
    href: '/industry-portal/slots',
    icon: CalendarClock,
  },
  {
    title: 'Attendees',
    href: '/industry-portal/attendees',
    icon: Users,
  },
  {
    title: 'Settings',
    href: '/industry-portal/settings',
    icon: Settings,
  },
];

export default async function IndustryPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Opt out of static prerendering for authenticated routes
  await connection()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <Link href="/industry-portal" className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <h2 className="font-semibold">Industry Portal</h2>
                <p className="text-xs text-muted-foreground">Yi Connect</p>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarMenu>
              {industryNavigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/industrial-visits/marketplace">
                View Member Portal
              </Link>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 max-w-7xl">
            <Suspense fallback={<div>Loading...</div>}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
