// Example: Basic Setup without Role-Based Filtering
// This is the simplest implementation with static navigation

import { Home, Users, Settings, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuGroup {
  groupLabel: string;
  menus: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    submenus: Array<{
      href: string;
      label: string;
      active: boolean;
    }>;
  }>;
}

export function GetRoleBasedPages(pathname: string): MenuGroup[] {
  return [
    {
      groupLabel: 'Overview',
      menus: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: Home,
          active: pathname === '/dashboard',
          submenus: []
        }
      ]
    },
    {
      groupLabel: 'Management',
      menus: [
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          active: pathname.startsWith('/users'),
          submenus: [
            {
              href: '/users/list',
              label: 'User List',
              active: pathname === '/users/list'
            },
            {
              href: '/users/teams',
              label: 'Teams',
              active: pathname === '/users/teams'
            }
          ]
        }
      ]
    },
    {
      groupLabel: 'Content',
      menus: [
        {
          href: '/documents',
          label: 'Documents',
          icon: FileText,
          active: pathname.startsWith('/documents'),
          submenus: []
        }
      ]
    },
    {
      groupLabel: 'Settings',
      menus: [
        {
          href: '/settings',
          label: 'Settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
          submenus: [
            {
              href: '/settings/profile',
              label: 'Profile',
              active: pathname === '/settings/profile'
            },
            {
              href: '/settings/preferences',
              label: 'Preferences',
              active: pathname === '/settings/preferences'
            }
          ]
        }
      ]
    }
  ];
}

// Usage in bottom-navbar.tsx:
// const filteredPages = useMemo(() => {
//   return GetRoleBasedPages(pathname);
// }, [pathname]);
