'use client';

import { usePathname } from 'next/navigation';
import { AdminBottomNavbar } from '@/components/AdminBottomNav';

interface AdminBottomNavbarWrapperProps {
  userRoles: string[];
}

/**
 * Admin Bottom Navbar Wrapper
 *
 * Renders the admin bottom navbar on all dashboard pages for mobile view.
 * Provides comprehensive navigation access on mobile devices.
 */
export function AdminBottomNavbarWrapper({ userRoles }: AdminBottomNavbarWrapperProps) {
  const pathname = usePathname();

  // Exclude routes where navbar should NOT appear (auth pages, public pages, mobile-specific routes)
  const excludedRoutes = [
    '/login',
    '/forgot-password',
    '/auth',
    '/m/', // Mobile-specific route group has its own navbar
    '/industry-portal',
    '/coordinator',
    '/chapter-lead'
  ];

  // Check if current pathname should exclude the navbar
  const shouldExclude = excludedRoutes.some(route => pathname.startsWith(route));

  // Don't render on excluded routes
  if (shouldExclude) {
    return null;
  }

  // Render navbar on all dashboard pages
  return <AdminBottomNavbar userRoles={userRoles} />;
}
