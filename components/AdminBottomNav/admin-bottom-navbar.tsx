'use client';

import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Home, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminBottomNav, useAdminBottomNavHydration } from '@/hooks/use-admin-bottom-nav';
import { getAdminBottomNavPages } from '@/lib/adminBottomNavConfig';
import { AdminBottomNavItem } from './admin-bottom-nav-item';
import { AdminBottomNavSubmenu } from './admin-bottom-nav-submenu';
import { AdminBottomNavMoreMenu } from './admin-bottom-nav-more-menu';
import { AdminBottomNavGroup, FlatMenuItem, ActivePageInfo } from './types';

// Icon mapping for admin groups
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Overview': Home
};

/**
 * Flatten menu items including submenus
 */
function flattenMenuItems(
  menus: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    submenus: Array<{ href: string; label: string; icon: LucideIcon; active: boolean }>;
  }>
): FlatMenuItem[] {
  const seenHrefs = new Set<string>();

  return menus.flatMap((menu) => {
    const items: FlatMenuItem[] = [];

    if (menu.submenus.length === 0) {
      if (!seenHrefs.has(menu.href)) {
        seenHrefs.add(menu.href);
        items.push({
          href: menu.href,
          label: menu.label,
          icon: menu.icon,
          active: menu.active
        });
      }
    } else {
      menu.submenus.forEach((sub) => {
        if (!seenHrefs.has(sub.href)) {
          seenHrefs.add(sub.href);
          items.push({
            href: sub.href,
            label: sub.label,
            icon: sub.icon,
            active: sub.active
          });
        }
      });
    }

    return items;
  });
}

interface AdminBottomNavbarProps {
  userRoles: string[];
}

export function AdminBottomNavbar({ userRoles }: AdminBottomNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const hasHydrated = useAdminBottomNavHydration();

  const {
    activeNavId,
    isExpanded,
    isMoreMenuOpen,
    activePage,
    setActiveNav,
    switchToNav,
    setExpanded,
    setMoreMenuOpen,
    setActivePage
  } = useAdminBottomNav();

  // Set loading to false after initial mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Get filtered pages based on role
  const filteredPages = useMemo(() => {
    return getAdminBottomNavPages(pathname, userRoles);
  }, [pathname, userRoles]);

  // Transform filtered pages into bottom nav groups
  const allNavGroups = useMemo((): AdminBottomNavGroup[] => {
    return filteredPages
      .filter((group) => group.menus.length > 0)
      .map((group) => ({
        id: group.groupLabel?.toLowerCase().replace(/\s+/g, '-') || 'default',
        groupLabel: group.groupLabel || 'Menu',
        icon: GROUP_ICONS[group.groupLabel || ''] || group.menus[0]?.icon || Home,
        menus: flattenMenuItems(group.menus as any)
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
    if (isExpanded && activeNavId) {
      return activeNavId;
    }
    // When collapsed, use pathname-based detection
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

  // Update active page when currentActivePage changes
  useLayoutEffect(() => {
    if (currentActivePage) {
      setActivePage(currentActivePage);
    }
  }, [currentActivePage, setActivePage]);

  // Sync activeNavId with pathname when it changes
  useEffect(() => {
    // Only sync when not expanded
    if (!isExpanded && currentActiveGroup && currentActiveGroup.id !== activeNavId) {
      setActiveNav(currentActiveGroup.id);
    }
  }, [currentActiveGroup, activeNavId, setActiveNav, isExpanded]);

  // Handle nav item click
  const handleNavClick = useCallback(
    (groupId: string) => {
      // If submenu is open and showing THIS group's items, close it
      if (isExpanded && activeNavId === groupId) {
        setExpanded(false);
        setMoreMenuOpen(false);
      } else {
        // Otherwise, switch to this group's submenu
        switchToNav(groupId);
      }
    },
    [activeNavId, isExpanded, switchToNav, setExpanded, setMoreMenuOpen]
  );

  // Handle submenu item click
  const handleSubmenuClick = useCallback(
    (href: string) => {
      router.push(href);
      setExpanded(false);
    },
    [router, setExpanded]
  );

  // Handle "More" menu open
  const handleMoreClick = useCallback(() => {
    setExpanded(false);
    setMoreMenuOpen(!isMoreMenuOpen);
  }, [setMoreMenuOpen, setExpanded, isMoreMenuOpen]);

  // Handle click on More menu item
  const handleMoreItemClick = useCallback(
    (href: string) => {
      router.push(href);
      setMoreMenuOpen(false);
    },
    [router, setMoreMenuOpen]
  );

  // Close submenu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-admin-bottom-nav]')) {
        setExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isExpanded, setExpanded]);

  // Wait for hydration
  if (!hasHydrated) {
    return null;
  }

  // While loading, return null
  if (isLoading) {
    return null;
  }

  // Don't render if no groups available
  if (primaryNavGroups.length === 0) {
    return null;
  }

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Backdrop when submenu expanded */}
      <AnimatePresence>
        {isExpanded && !isMoreMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[75] lg:hidden"
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Admin bottom navigation */}
      <motion.nav
        data-admin-bottom-nav
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
          'lg:hidden',
          'bg-background border-t border-border',
          'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Expanded submenu */}
        <AdminBottomNavSubmenu
          items={activeSubmenus}
          isOpen={isExpanded}
          onItemClick={handleSubmenuClick}
        />

        {/* Nav items */}
        <div className="flex items-center justify-around">
          {primaryNavGroups.map((group) => (
            <AdminBottomNavItem
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
            <AdminBottomNavItem
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
      <AdminBottomNavMoreMenu
        groups={moreNavGroups}
        isOpen={isMoreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onItemClick={handleMoreItemClick}
      />
    </>
  );
}
