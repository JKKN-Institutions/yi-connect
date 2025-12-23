import { LucideIcon } from 'lucide-react';

export interface FlatMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  parentLabel?: string;
  active?: boolean;
}

export interface BottomNavGroup {
  id: string;
  groupLabel: string;
  icon: LucideIcon;
  menus: FlatMenuItem[];
}

export interface BottomNavItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  hasSubmenu: boolean;
  badgeCount?: number;
  onClick: () => void;
}

export interface BottomNavSubmenuProps {
  items: FlatMenuItem[];
  isOpen: boolean;
  onItemClick: (href: string) => void;
}

export interface BottomNavMoreMenuProps {
  groups: BottomNavGroup[];
  isOpen: boolean;
  onClose: () => void;
  onItemClick: (href: string) => void;
}

// Active page info for minimized state
export interface ActivePageInfo {
  href: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
}

// Serializable version for localStorage (without icon component)
export interface SerializableActivePageInfo {
  href: string;
  label: string;
  groupLabel: string;
}

export interface BottomNavState {
  activeNavId: string | null;
  isExpanded: boolean;
  isMoreMenuOpen: boolean;
  isMinimized: boolean;  // New: controls minimized vs full navbar
  activePage: ActivePageInfo | null;  // New: current active page info
  selectedSubItem: {
    href: string;
    label: string;
  } | null;
  setActiveNav: (id: string | null) => void;
  switchToNav: (id: string) => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleMoreMenu: () => void;
  setMoreMenuOpen: (open: boolean) => void;
  setSelectedSubItem: (item: BottomNavState['selectedSubItem']) => void;
  setMinimized: (minimized: boolean) => void;  // New
  setActivePage: (page: ActivePageInfo | null) => void;  // New
  resetState: () => void;
}
