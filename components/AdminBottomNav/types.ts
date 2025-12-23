/**
 * Type definitions for Admin Bottom Navigation
 * Based on the mobile-bottom-navbar skill pattern
 */

import { LucideIcon } from 'lucide-react';

export interface FlatMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  parentLabel?: string;
  active?: boolean;
}

export interface AdminBottomNavGroup {
  id: string;
  groupLabel: string;
  icon: LucideIcon;
  menus: FlatMenuItem[];
}

export interface AdminBottomNavItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  hasSubmenu: boolean;
  badgeCount?: number;
  onClick: () => void;
}

export interface AdminBottomNavSubmenuProps {
  items: FlatMenuItem[];
  isOpen: boolean;
  onItemClick: (href: string) => void;
}

export interface AdminBottomNavMoreMenuProps {
  groups: AdminBottomNavGroup[];
  isOpen: boolean;
  onClose: () => void;
  onItemClick: (href: string) => void;
}

export interface ActivePageInfo {
  href: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
}

export interface AdminBottomNavState {
  activeNavId: string | null;
  isExpanded: boolean;
  isMoreMenuOpen: boolean;
  activePage: ActivePageInfo | null;
  setActiveNav: (id: string | null) => void;
  switchToNav: (id: string) => void;
  setExpanded: (expanded: boolean) => void;
  setMoreMenuOpen: (open: boolean) => void;
  setActivePage: (page: ActivePageInfo | null) => void;
  resetState: () => void;
}
