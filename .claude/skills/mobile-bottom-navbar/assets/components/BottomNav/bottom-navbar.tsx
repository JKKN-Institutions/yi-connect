'use client';

import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  MoreHorizontal,
  GraduationCap,
  CalendarClock,
  FileText,
  Users,
  Building,
  ClipboardCheck,
  Package,
  Bell,
  Settings,
  TabletSmartphone,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBottomNav, useBottomNavHydration } from '@/hooks/use-bottom-nav';
import { GetRoleBasedPages } from '@/lib/sidebarMenuLink';
import { AuthService } from '@/lib/auth/auth-service';
import { RoleService } from '@/lib/services/roles/role-service';
import { CustomRole } from '@/types/auth';
import { BottomNavItem } from './bottom-nav-item';
import { BottomNavSubmenu } from './bottom-nav-submenu';
import { BottomNavMoreMenu } from './bottom-nav-more-menu';
import { BottomNavMinimized } from './bottom-nav-minimized';
import { BottomNavGroup, FlatMenuItem, ActivePageInfo } from './types';

// Icon mapping for menu groups
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Overview': Home,
  'User Management': Users,
  'Applications': TabletSmartphone,
  'Application Management': TabletSmartphone,
  'Organization Management': Building,
  'Learners Management': GraduationCap,
  'Facilitators Management': Users,
  'Academic Management': CalendarClock,
  'Resource Management': Package,
  'Admissions Management': ClipboardCheck,
  'Billing Management': FileText,
  'Administration': Bell,
  'System': Settings
};

// Routes that are parent-only (no actual page, only submenus)
const PARENT_ONLY_ROUTES = new Set([
  '/billing/categories'
]);

// Routes that should redirect to dashboard
const REDIRECT_ROUTES: Record<string, string> = {
  '/': '/dashboard'
};

// Flatten menu items including submenus, excluding parent-only routes
function flattenMenuItems(
  menus: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    submenus: Array<{ href: string; label: string; active: boolean }>;
  }>
): FlatMenuItem[] {
  const seenHrefs = new Set<string>();

  return menus.flatMap((menu) => {
    const items: FlatMenuItem[] = [];
    const parentHref = REDIRECT_ROUTES[menu.href] || menu.href;

    if (menu.submenus.length === 0) {
      if (!seenHrefs.has(parentHref)) {
        seenHrefs.add(parentHref);
        items.push({
          href: parentHref,
          label: menu.label,
          icon: menu.icon,
          active: menu.active
        });
      }
    } else {
      if (!PARENT_ONLY_ROUTES.has(menu.href) && !seenHrefs.has(parentHref)) {
        const parentIsDifferent = !menu.submenus.some(sub => sub.href === parentHref);
        if (parentIsDifferent) {
          seenHrefs.add(parentHref);
          items.push({
            href: parentHref,
            label: menu.label,
            icon: menu.icon,
            active: menu.active
          });
        }
      }

      menu.submenus.forEach((sub) => {
        const subHref = REDIRECT_ROUTES[sub.href] || sub.href;
        if (!seenHrefs.has(subHref)) {
          seenHrefs.add(subHref);
          items.push({
            href: subHref,
            label: sub.label,
            icon: menu.icon,
            active: sub.active
          });
        }
      });
    }

    return items;
  });
}

export function BottomNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [userRole, setUserRole] = useState<CustomRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const hasHydrated = useBottomNavHydration();

  const {
    activeNavId,
    isExpanded,
    isMoreMenuOpen,
    isMinimized,
    activePage,
    setActiveNav,
    switchToNav,
    setExpanded,
    setMoreMenuOpen,
    setMinimized,
    setActivePage
  } = useBottomNav();

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setIsLoading(true);
        const profile = await AuthService.getUserProfile();
        if (profile?.role) {
          const roleData = await RoleService.getRoleByKey(profile.role);
          setUserRole(roleData);
        }
      } catch (error) {
        console.error('[BottomNav] Error fetching user role:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserRole();
  }, []);

  // Get filtered pages based on role
  const filteredPages = useMemo(() => {
    return GetRoleBasedPages(pathname, userRole);
  }, [pathname, userRole]);

  // Transform filtered pages into bottom nav groups
  const allNavGroups = useMemo((): BottomNavGroup[] => {
    return filteredPages
      .filter((group) => group.menus.length > 0)
      .map((group) => ({
        id: group.groupLabel?.toLowerCase().replace(/\s+/g, '-') || 'default',
        groupLabel: group.groupLabel || 'Menu',
        icon: GROUP_ICONS[group.groupLabel || ''] || Home,
        menus: flattenMenuItems(group.menus)
      }));
  }, [filteredPages]);

  // Primary nav groups (first 4)
  const primaryNavGroups = useMemo(() => {
    return allNavGroups.slice(0, 4);
  }, [allNavGroups]);

  // Remaining groups for "More" menu
  const moreNavGroups = useMemo(() => {
    return allNavGroups.slice(4);
  }, [allNavGroups]);

  // Find the group that contains the current pathname
  const currentActiveGroup = useMemo(() => {
    // Search all groups for a matching menu item
    for (const group of allNavGroups) {
      for (const menu of group.menus) {
        // Exact match or starts with (for nested routes)
        if (pathname === menu.href || pathname.startsWith(menu.href + '/')) {
          return group;
        }
      }
    }
    // Default to first group if no match found
    return allNavGroups[0] || null;
  }, [pathname, allNavGroups]);

  // Find the active page info based on current pathname
  const currentActivePage = useMemo((): ActivePageInfo | null => {
    if (!currentActiveGroup) return null;

    for (const menu of currentActiveGroup.menus) {
      if (pathname === menu.href || pathname.startsWith(menu.href + '/')) {
        return {
          href: menu.href,
          label: menu.label,
          icon: menu.icon,
          groupLabel: currentActiveGroup.groupLabel
        };
      }
    }
    return null;
  }, [pathname, currentActiveGroup]);

  // Determine the effective active nav ID
  const effectiveActiveNavId = useMemo(() => {
    // When submenu is expanded, respect user's manual selection
    // This allows clicking different groups to show their submenus
    if (isExpanded && activeNavId) {
      return activeNavId;
    }
    // When collapsed (or no selection), use pathname-based detection
    if (currentActiveGroup) {
      return currentActiveGroup.id;
    }
    // Fallback to stored activeNavId
    return activeNavId;
  }, [currentActiveGroup, activeNavId, isExpanded]);

  // Current active submenu items - based on effective active nav
  const activeSubmenus = useMemo(() => {
    if (effectiveActiveNavId) {
      const selectedGroup = allNavGroups.find((g) => g.id === effectiveActiveNavId);
      if (selectedGroup) {
        return selectedGroup.menus;
      }
    }
    // Fallback to current pathname's group
    return currentActiveGroup?.menus || [];
  }, [effectiveActiveNavId, allNavGroups, currentActiveGroup]);

  // Update active page IMMEDIATELY when currentActivePage changes (before paint)
  useLayoutEffect(() => {
    if (currentActivePage) {
      setActivePage(currentActivePage);

      // On first initialization after loading completes, ensure we're NOT minimized
      if (!hasInitialized.current && !isLoading) {
        hasInitialized.current = true;
        // Always keep full navbar visible - never minimize
        setMinimized(false);
      }
    }
  }, [currentActivePage, setActivePage, isLoading, setMinimized]);

  // Sync activeNavId with pathname when it changes (but not while user is browsing)
  useEffect(() => {
    // Only sync when not expanded - don't override user's manual selection while browsing
    if (!isExpanded && currentActiveGroup && currentActiveGroup.id !== activeNavId) {
      setActiveNav(currentActiveGroup.id);
    }
  }, [currentActiveGroup, activeNavId, setActiveNav, isExpanded]);

  // Handle nav item click - simplified toggle logic with atomic state update
  const handleNavClick = useCallback(
    (groupId: string) => {
      // If submenu is open and showing THIS group's items, close it
      if (isExpanded && activeNavId === groupId) {
        setExpanded(false);
        setMoreMenuOpen(false);
      } else {
        // Otherwise, switch to this group's submenu (atomic update)
        switchToNav(groupId);
      }
    },
    [activeNavId, isExpanded, switchToNav, setExpanded, setMoreMenuOpen]
  );

  // Handle submenu item click - navigate and close submenu
  const handleSubmenuClick = useCallback(
    (href: string) => {
      router.push(href);
      setExpanded(false);
      // Don't minimize - keep full navbar visible
    },
    [router, setExpanded]
  );

  // Handle "More" menu open - close submenu first
  const handleMoreClick = useCallback(() => {
    setExpanded(false); // Close any open submenu first
    setMoreMenuOpen(!isMoreMenuOpen); // Toggle More menu
  }, [setMoreMenuOpen, setExpanded, isMoreMenuOpen]);

  // Handle click on More menu item - navigate and close menu
  const handleMoreItemClick = useCallback(
    (href: string) => {
      router.push(href);
      setMoreMenuOpen(false);
      // Don't minimize - keep full navbar visible
    },
    [router, setMoreMenuOpen]
  );

  // Handle expand from minimized state (no longer used, but kept for compatibility)
  const handleExpandFromMinimized = useCallback(() => {
    // Set the active nav to the current group based on pathname
    if (currentActiveGroup) {
      setActiveNav(currentActiveGroup.id);
    }
    setMinimized(false);
    setExpanded(false);
  }, [setMinimized, setExpanded, setActiveNav, currentActiveGroup]);

  // Close submenu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-bottom-nav]')) {
        setExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isExpanded, setExpanded]);

  // Wait for Zustand store to hydrate before rendering
  // This prevents flash of incorrect state
  if (!hasHydrated) {
    return null;
  }

  // While loading role data, return null
  // Full navbar will show after loading completes
  if (isLoading) {
    return null;
  }

  // Don't render if no groups available
  if (primaryNavGroups.length === 0) return null;

  // Always show full navbar - never minimized
  return (
    <>
      {/* Backdrop when submenu expanded - only for submenu, not More menu */}
      <AnimatePresence>
        {isExpanded && !isMoreMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[75] lg:hidden"
            onClick={() => {
              setExpanded(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Full bottom navigation - always visible on mobile */}
      <motion.nav
        data-bottom-nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 35,
          mass: 0.8
        }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[80]',
          // Hide on desktop when sidebar is visible (lg+)
          'lg:hidden',
          'bg-background border-t border-border',
          'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Expanded submenu */}
        <BottomNavSubmenu
          items={activeSubmenus}
          isOpen={isExpanded}
          onItemClick={handleSubmenuClick}
        />

        {/* Nav items */}
        <div className="flex items-center justify-around">
          {primaryNavGroups.map((group) => (
            <BottomNavItem
              key={group.id}
              id={group.id}
              icon={group.icon}
              label={group.groupLabel}
              isActive={effectiveActiveNavId === group.id}
              hasSubmenu={group.menus.length > 1}
              onClick={() => handleNavClick(group.id)}
            />
          ))}

          {/* More button if there are additional groups */}
          {moreNavGroups.length > 0 && (
            <BottomNavItem
              id="more"
              icon={MoreHorizontal}
              label="More"
              isActive={isMoreMenuOpen}
              hasSubmenu={true}
              badgeCount={moreNavGroups.length}
              onClick={handleMoreClick}
            />
          )}
        </div>
      </motion.nav>

      {/* More menu sheet */}
      <BottomNavMoreMenu
        groups={moreNavGroups}
        isOpen={isMoreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onItemClick={handleMoreItemClick}
      />
    </>
  );
}
