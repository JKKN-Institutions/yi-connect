// Example: With Role-Based Filtering
// Shows/hides navigation items based on user role

import { Home, Users, Settings, FileText, Shield, BarChart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Define your app's user roles
export type UserRole = 'admin' | 'manager' | 'user' | 'guest';

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

export function GetRoleBasedPages(
  pathname: string,
  userRole: UserRole | null
): MenuGroup[] {
  // Define role hierarchy
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || isAdmin;
  const isUser = userRole === 'user' || isManager;

  const groups: MenuGroup[] = [
    // Always visible to everyone
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

    // Visible to authenticated users (user, manager, admin)
    ...(isUser ? [{
      groupLabel: 'Content',
      menus: [
        {
          href: '/documents',
          label: 'Documents',
          icon: FileText,
          active: pathname.startsWith('/documents'),
          submenus: [
            {
              href: '/documents/my-docs',
              label: 'My Documents',
              active: pathname === '/documents/my-docs'
            },
            {
              href: '/documents/shared',
              label: 'Shared',
              active: pathname === '/documents/shared'
            }
          ]
        }
      ]
    }] : []),

    // Visible to managers and admins only
    ...(isManager ? [{
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
    }] : []),

    // Visible to managers and admins
    ...(isManager ? [{
      groupLabel: 'Analytics',
      menus: [
        {
          href: '/analytics',
          label: 'Analytics',
          icon: BarChart,
          active: pathname.startsWith('/analytics'),
          submenus: [
            {
              href: '/analytics/overview',
              label: 'Overview',
              active: pathname === '/analytics/overview'
            },
            {
              href: '/analytics/reports',
              label: 'Reports',
              active: pathname === '/analytics/reports'
            }
          ]
        }
      ]
    }] : []),

    // Admin-only sections
    ...(isAdmin ? [{
      groupLabel: 'Administration',
      menus: [
        {
          href: '/admin',
          label: 'Admin Panel',
          icon: Shield,
          active: pathname.startsWith('/admin'),
          submenus: [
            {
              href: '/admin/roles',
              label: 'Roles & Permissions',
              active: pathname === '/admin/roles'
            },
            {
              href: '/admin/audit',
              label: 'Audit Log',
              active: pathname === '/admin/audit'
            }
          ]
        }
      ]
    }] : []),

    // Settings - visible to all authenticated users
    ...(isUser ? [{
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
            },
            // Admin-only settings
            ...(isAdmin ? [{
              href: '/settings/system',
              label: 'System Settings',
              active: pathname === '/settings/system'
            }] : [])
          ]
        }
      ]
    }] : [])
  ];

  // Filter out empty groups
  return groups.filter(group => group.menus.length > 0);
}

// Usage in bottom-navbar.tsx:
// const [userRole, setUserRole] = useState<UserRole | null>(null);
//
// useEffect(() => {
//   const fetchRole = async () => {
//     const profile = await AuthService.getUserProfile();
//     setUserRole(profile?.role || null);
//   };
//   fetchRole();
// }, []);
//
// const filteredPages = useMemo(() => {
//   return GetRoleBasedPages(pathname, userRole);
// }, [pathname, userRole]);
