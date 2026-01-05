/**
 * Dashboard Bottom Navigation Configuration
 *
 * Defines the navigation structure for the mobile bottom navbar across all dashboard pages.
 * Follows role-based access control and groups features logically.
 */

import {
  LayoutDashboard,
  Users,
  MapPin,
  Settings,
  UserCog,
  UserCheck,
  UserPlus,
  Building2,
  Plus,
  HelpCircle,
  Shield,
  Award,
  Activity,
  Factory,
  Calendar,
  Briefcase,
  Globe,
  Wallet,
  BookOpen,
  MessageSquare,
  LucideIcon
} from 'lucide-react';

export interface AdminMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  requiredRoles?: string[];
}

export interface AdminMenuGroup {
  groupLabel: string;
  menus: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    submenus: AdminMenuItem[];
    requiredRoles?: string[];
  }>;
}

/**
 * Get dashboard navigation pages based on current pathname and user roles
 */
export function getAdminBottomNavPages(
  pathname: string,
  userRoles: string[] = []
): AdminMenuGroup[] {
  // Helper function to check if user has required roles
  const hasRequiredRoles = (requiredRoles?: string[]): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Super Admin and National Admin have access to everything
    if (userRoles.includes('Super Admin') || userRoles.includes('National Admin')) {
      return true;
    }

    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    return hasRole;
  };

  const allGroups: AdminMenuGroup[] = [
    // 1. Dashboard Group
    {
      groupLabel: 'Dashboard',
      menus: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          active: pathname === '/dashboard',
          submenus: [
            {
              href: '/dashboard',
              label: 'Dashboard',
              icon: LayoutDashboard,
              active: pathname === '/dashboard'
            }
          ]
        }
      ]
    },

    // 2. Members Group
    {
      groupLabel: 'Members',
      menus: [
        {
          href: '/members',
          label: 'Members',
          icon: Users,
          active: pathname.startsWith('/members'),
          requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
          submenus: [
            {
              href: '/members',
              label: 'All Members',
              icon: Users,
              active: pathname === '/members',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/members/grid',
              label: 'Grid View',
              icon: Users,
              active: pathname === '/members/grid',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/members/analytics',
              label: 'Analytics',
              icon: Activity,
              active: pathname === '/members/analytics',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/members/new',
              label: 'Add Member',
              icon: Plus,
              active: pathname === '/members/new',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
            }
          ]
        }
      ]
    },

    // 3. Events Group
    {
      groupLabel: 'Events',
      menus: [
        {
          href: '/events',
          label: 'Events',
          icon: Calendar,
          active: pathname.startsWith('/events'),
          submenus: [
            {
              href: '/events',
              label: 'All Events',
              icon: Calendar,
              active: pathname === '/events'
            },
            {
              href: '/events/table',
              label: 'Table View',
              icon: Calendar,
              active: pathname === '/events/table'
            },
            {
              href: '/events/manage',
              label: 'Manage Events',
              icon: Settings,
              active: pathname === '/events/manage',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/events/new',
              label: 'Create Event',
              icon: Plus,
              active: pathname === '/events/new',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            }
          ]
        }
      ]
    },

    // 4. Settings Group
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
              icon: UserCog,
              active: pathname === '/settings/profile'
            },
            {
              href: '/settings',
              label: 'General',
              icon: Settings,
              active: pathname === '/settings'
            }
          ]
        }
      ]
    },

    // 5. Finance Group (More Menu)
    {
      groupLabel: 'Finance',
      menus: [
        {
          href: '/finance',
          label: 'Finance',
          icon: Wallet,
          active: pathname.startsWith('/finance'),
          requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'],
          submenus: [
            {
              href: '/finance',
              label: 'Overview',
              icon: LayoutDashboard,
              active: pathname === '/finance',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/finance/budgets',
              label: 'Budgets',
              icon: Wallet,
              active: pathname.startsWith('/finance/budgets'),
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            },
            {
              href: '/finance/expenses',
              label: 'Expenses',
              icon: Wallet,
              active: pathname.startsWith('/finance/expenses'),
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
            }
          ]
        }
      ]
    },

    // 6. Communications Group (More Menu)
    {
      groupLabel: 'Communications',
      menus: [
        {
          href: '/communications',
          label: 'Communications',
          icon: MessageSquare,
          active: pathname.startsWith('/communications'),
          requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'],
          submenus: [
            {
              href: '/communications',
              label: 'Overview',
              icon: LayoutDashboard,
              active: pathname === '/communications',
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
            },
            {
              href: '/communications/announcements',
              label: 'Announcements',
              icon: MessageSquare,
              active: pathname.startsWith('/communications/announcements'),
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
            },
            {
              href: '/communications/whatsapp',
              label: 'WhatsApp',
              icon: MessageSquare,
              active: pathname.startsWith('/communications/whatsapp'),
              requiredRoles: ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']
            }
          ]
        }
      ]
    },

    // 7. Awards Group (More Menu)
    {
      groupLabel: 'Awards',
      menus: [
        {
          href: '/awards',
          label: 'Awards',
          icon: Award,
          active: pathname.startsWith('/awards'),
          submenus: [
            {
              href: '/awards',
              label: 'Overview',
              icon: LayoutDashboard,
              active: pathname === '/awards'
            },
            {
              href: '/awards/leaderboard',
              label: 'Leaderboard',
              icon: Award,
              active: pathname === '/awards/leaderboard'
            },
            {
              href: '/awards/nominations',
              label: 'My Nominations',
              icon: Award,
              active: pathname === '/awards/nominations'
            }
          ]
        }
      ]
    },

    // 8. Knowledge Group (More Menu)
    {
      groupLabel: 'Knowledge',
      menus: [
        {
          href: '/knowledge',
          label: 'Knowledge',
          icon: BookOpen,
          active: pathname.startsWith('/knowledge'),
          submenus: [
            {
              href: '/knowledge',
              label: 'Overview',
              icon: LayoutDashboard,
              active: pathname === '/knowledge'
            },
            {
              href: '/knowledge/documents',
              label: 'Documents',
              icon: BookOpen,
              active: pathname.startsWith('/knowledge/documents')
            },
            {
              href: '/knowledge/wiki',
              label: 'Wiki Pages',
              icon: BookOpen,
              active: pathname.startsWith('/knowledge/wiki')
            }
          ]
        }
      ]
    },

    // 9. Admin Group (More Menu)
    {
      groupLabel: 'Admin',
      menus: [
        {
          href: '/admin/users',
          label: 'User Management',
          icon: UserCog,
          active: pathname.startsWith('/admin/users'),
          requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair'],
          submenus: [
            {
              href: '/admin/users',
              label: 'All Users',
              icon: UserCog,
              active: pathname === '/admin/users',
              requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair']
            },
            {
              href: '/admin/users/invite',
              label: 'Invite User',
              icon: UserPlus,
              active: pathname === '/admin/users/invite',
              requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair']
            }
          ]
        },
        {
          href: '/admin/chapters',
          label: 'Chapters',
          icon: MapPin,
          active: pathname.startsWith('/admin/chapters'),
          requiredRoles: ['Super Admin', 'National Admin'],
          submenus: [
            {
              href: '/admin/chapters',
              label: 'All Chapters',
              icon: Building2,
              active: pathname === '/admin/chapters',
              requiredRoles: ['Super Admin', 'National Admin']
            },
            {
              href: '/admin/chapters/new',
              label: 'Create Chapter',
              icon: Plus,
              active: pathname === '/admin/chapters/new',
              requiredRoles: ['Super Admin', 'National Admin']
            }
          ]
        },
        {
          href: '/member-requests',
          label: 'Member Requests',
          icon: UserCheck,
          active: pathname === '/member-requests',
          requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair', 'Co-Chair', 'EC Member'],
          submenus: [
            {
              href: '/member-requests',
              label: 'Pending Requests',
              icon: UserCheck,
              active: pathname === '/member-requests',
              requiredRoles: ['Super Admin', 'National Admin', 'Executive Member', 'Chair', 'Co-Chair', 'EC Member']
            }
          ]
        },
        {
          href: '/admin/docs',
          label: 'User Guide',
          icon: HelpCircle,
          active: pathname.startsWith('/admin/docs'),
          submenus: [
            {
              href: '/admin/docs',
              label: 'Documentation',
              icon: HelpCircle,
              active: pathname.startsWith('/admin/docs')
            }
          ]
        }
      ]
    }
  ];

  // Filter groups based on user roles
  return allGroups
    .map(group => ({
      ...group,
      menus: group.menus
        .filter(menu => hasRequiredRoles(menu.requiredRoles))
        .map(menu => ({
          ...menu,
          submenus: menu.submenus.filter(submenu => hasRequiredRoles(submenu.requiredRoles))
        }))
    }))
    .filter(group => group.menus.length > 0);
}
