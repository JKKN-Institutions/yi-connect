# Integration Guide

This guide covers integrating the bottom navbar with different auth systems, permission frameworks, and existing applications.

## Table of Contents

1. [Role-Based Navigation Filtering](#role-based-navigation-filtering)
2. [Auth System Integration](#auth-system-integration)
3. [Layout Integration](#layout-integration)
4. [Navigation Structure Configuration](#navigation-structure-configuration)
5. [Migration from Existing Navbar](#migration-from-existing-navbar)

---

## Role-Based Navigation Filtering

### Overview

Role-based filtering shows/hides navigation items based on user permissions. This is optional but recommended for multi-role applications.

### Basic Implementation (No Roles)

Simplest approach without role filtering:

```typescript
// lib/sidebarMenuLink.ts
import { Home, Users, Settings } from 'lucide-react';

export function GetRoleBasedPages(pathname: string) {
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
          submenus: []
        }
      ]
    }
  ];
}
```

Usage in component:

```typescript
// components/BottomNav/bottom-navbar.tsx
const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname);  // No role parameter
}, [pathname]);
```

### With Role Filtering

Add role-based filtering:

```typescript
// types/auth.ts
export type UserRole = 'admin' | 'manager' | 'user';

export interface UserProfile {
  id: string;
  role: UserRole;
  email: string;
}

// lib/sidebarMenuLink.ts
export function GetRoleBasedPages(
  pathname: string,
  userRole: UserRole | null
): MenuGroup[] {
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';

  const groups: MenuGroup[] = [
    // Always visible
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
    // Manager and admin only
    ...(isManager ? [{
      groupLabel: 'Management',
      menus: [
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          active: pathname.startsWith('/users'),
          submenus: []
        }
      ]
    }] : []),
    // Admin only
    ...(isAdmin ? [{
      groupLabel: 'Settings',
      menus: [
        {
          href: '/settings',
          label: 'Settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
          submenus: []
        }
      ]
    }] : [])
  ];

  return groups.filter(group => group.menus.length > 0);
}
```

### Permission-Based Filtering

More granular control with permissions:

```typescript
// types/auth.ts
export type Permission =
  | 'view_dashboard'
  | 'view_users'
  | 'edit_users'
  | 'view_settings'
  | 'edit_settings';

export interface UserProfile {
  id: string;
  role: UserRole;
  permissions: Permission[];
}

// lib/permissions.ts
export function hasPermission(
  userProfile: UserProfile | null,
  permission: Permission
): boolean {
  if (!userProfile) return false;
  return userProfile.permissions.includes(permission);
}

// lib/sidebarMenuLink.ts
export function GetRoleBasedPages(
  pathname: string,
  userProfile: UserProfile | null
): MenuGroup[] {
  const canViewUsers = hasPermission(userProfile, 'view_users');
  const canViewSettings = hasPermission(userProfile, 'view_settings');

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
    ...(canViewUsers ? [{
      groupLabel: 'Management',
      menus: [
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          active: pathname.startsWith('/users'),
          submenus: []
        }
      ]
    }] : []),
    ...(canViewSettings ? [{
      groupLabel: 'Settings',
      menus: [
        {
          href: '/settings',
          label: 'Settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
          submenus: []
        }
      ]
    }] : [])
  ].filter(group => group.menus.length > 0);
}
```

---

## Auth System Integration

### Supabase Auth

```typescript
// lib/auth/auth-service.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export class AuthService {
  static async getUserProfile() {
    const supabase = createClientComponentClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile;
  }

  static async getUserRole() {
    const profile = await this.getUserProfile();
    return profile?.role || null;
  }
}

// components/BottomNav/bottom-navbar.tsx
const [userRole, setUserRole] = useState<UserRole | null>(null);

useEffect(() => {
  const fetchRole = async () => {
    const role = await AuthService.getUserRole();
    setUserRole(role);
  };
  fetchRole();
}, []);

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userRole);
}, [pathname, userRole]);
```

### NextAuth.js

```typescript
// lib/auth/auth-service.ts
import { useSession } from 'next-auth/react';

// In component
const { data: session } = useSession();
const userRole = session?.user?.role || null;

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userRole);
}, [pathname, userRole]);
```

### Clerk

```typescript
// components/BottomNav/bottom-navbar.tsx
import { useUser } from '@clerk/nextjs';

const { user } = useUser();
const userRole = user?.publicMetadata?.role as UserRole || null;

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userRole);
}, [pathname, userRole]);
```

### Auth0

```typescript
// components/BottomNav/bottom-navbar.tsx
import { useUser } from '@auth0/nextjs-auth0/client';

const { user } = useUser();
const userRole = user?.['https://your-domain.com/roles']?.[0] || null;

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userRole);
}, [pathname, userRole]);
```

### Custom Auth

```typescript
// lib/auth/auth-service.ts
export class AuthService {
  static async getUserProfile(): Promise<UserProfile | null> {
    const response = await fetch('/api/auth/profile');
    if (!response.ok) return null;
    return response.json();
  }
}

// components/BottomNav/bottom-navbar.tsx
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

useEffect(() => {
  const fetchProfile = async () => {
    const profile = await AuthService.getUserProfile();
    setUserProfile(profile);
  };
  fetchProfile();
}, []);

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userProfile);
}, [pathname, userProfile]);
```

### Role Service Pattern (MyJKKN)

Advanced pattern with role lookup from database:

```typescript
// lib/services/roles/role-service.ts
export interface CustomRole {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

export class RoleService {
  static async getRoleByKey(roleKey: string): Promise<CustomRole | null> {
    // Fetch from database
    const response = await fetch(`/api/roles/${roleKey}`);
    if (!response.ok) return null;
    return response.json();
  }
}

// components/BottomNav/bottom-navbar.tsx
const [userRole, setUserRole] = useState<CustomRole | null>(null);

useEffect(() => {
  const fetchUserRole = async () => {
    const profile = await AuthService.getUserProfile();
    if (profile?.role) {
      const roleData = await RoleService.getRoleByKey(profile.role);
      setUserRole(roleData);
    }
  };
  fetchUserRole();
}, []);

const filteredPages = useMemo(() => {
  return GetRoleBasedPages(pathname, userRole);
}, [pathname, userRole]);
```

---

## Layout Integration

### App Router Layout

```typescript
// app/(routes)/layout.tsx
'use client';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Sidebar from '@/components/Sidebar';
import { BottomNavbar } from '@/components/BottomNav';

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main
        className={cn(
          'min-h-screen bg-background',
          // Desktop: add left margin for sidebar
          'lg:ml-64',
          // Mobile: add bottom padding for navbar
          isMobile && 'pb-20'
        )}
      >
        {children}
      </main>

      {/* Mobile bottom navbar */}
      <BottomNavbar />
    </>
  );
}
```

### With Header

```typescript
export default function MainLayout({ children }) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Header (always visible) */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background border-b">
        {/* Header content */}
      </header>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main
        className={cn(
          'min-h-screen bg-background',
          'pt-16',  // Top padding for header
          'lg:ml-64',  // Left margin for sidebar on desktop
          isMobile && 'pb-20'  // Bottom padding for navbar on mobile
        )}
      >
        {children}
      </main>

      {/* Mobile bottom navbar */}
      <BottomNavbar />
    </>
  );
}
```

### With Footer

```typescript
export default function MainLayout({ children }) {
  const isMobile = useIsMobile();

  return (
    <>
      <Sidebar />

      <main className={cn(
        'min-h-screen bg-background',
        'lg:ml-64',
        isMobile && 'pb-20'
      )}>
        {children}
      </main>

      {/* Footer - hide on mobile */}
      <footer className={cn(
        'bg-background border-t',
        'lg:ml-64',
        isMobile && 'hidden'  // Hidden when bottom navbar is visible
      )}>
        {/* Footer content */}
      </footer>

      <BottomNavbar />
    </>
  );
}
```

### Sidebar Coordination

Ensure navbar is hidden when sidebar is visible:

```typescript
// components/BottomNav/bottom-navbar.tsx
<motion.nav
  className={cn(
    'fixed bottom-0 left-0 right-0 z-[80]',
    'lg:hidden',  // Hide on large screens and up
    'bg-background border-t border-border'
  )}
>
```

Adjust main content margin:

```typescript
// In layout
const sidebar = useSidebarToggle();

<main
  className={cn(
    'min-h-screen',
    sidebar?.isOpen === false ? 'lg:ml-[90px]' : 'lg:ml-72',
    isMobile && 'pb-20'
  )}
>
```

---

## Navigation Structure Configuration

### Basic Structure

```typescript
// lib/sidebarMenuLink.ts
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
```

### With Submenus

```typescript
{
  groupLabel: 'Academic',
  menus: [
    {
      href: '/academic',
      label: 'Academic',
      icon: GraduationCap,
      active: pathname.startsWith('/academic'),
      submenus: [
        {
          href: '/academic/students',
          label: 'Students',
          active: pathname === '/academic/students'
        },
        {
          href: '/academic/courses',
          label: 'Courses',
          active: pathname === '/academic/courses'
        }
      ]
    }
  ]
}
```

### Nested Routes

```typescript
{
  href: '/billing',
  label: 'Billing',
  icon: FileText,
  // Match parent route or any nested route
  active: pathname === '/billing' || pathname.startsWith('/billing/'),
  submenus: [
    {
      href: '/billing/invoices',
      label: 'Invoices',
      active: pathname === '/billing/invoices'
    },
    {
      href: '/billing/payments',
      label: 'Payments',
      active: pathname === '/billing/payments'
    }
  ]
}
```

### Dynamic Routes

```typescript
{
  href: '/students',
  label: 'Students',
  icon: Users,
  // Match both /students and /students/[id]
  active: pathname.startsWith('/students'),
  submenus: []
}
```

### Parent-Only Routes

Routes with no actual page (only submenus):

```typescript
// In bottom-navbar.tsx
const PARENT_ONLY_ROUTES = new Set([
  '/billing/categories',  // This route has no page, only submenus
]);

// These routes won't be added as clickable items
// Only their submenus will be shown
```

### Redirect Routes

```typescript
// In bottom-navbar.tsx
const REDIRECT_ROUTES: Record<string, string> = {
  '/': '/dashboard',  // Root redirects to dashboard
  '/old-route': '/new-route',
};
```

---

## Migration from Existing Navbar

### Step 1: Audit Current Navigation

Document your existing navigation structure:

```typescript
// Example: Current sidebar structure
const currentSidebar = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Users', href: '/users' },
  // ...
];
```

### Step 2: Map to New Structure

Transform to bottom navbar format:

```typescript
// New structure
const newNavigation = [
  {
    groupLabel: 'Overview',
    menus: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: Home,
        active: false,
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
        active: false,
        submenus: []
      }
    ]
  }
];
```

### Step 3: Implement in Parallel

Keep existing navbar while implementing new one:

```typescript
export default function Layout({ children }) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Existing sidebar for desktop */}
      {!isMobile && <Sidebar />}

      {/* New bottom navbar for mobile */}
      {isMobile && <BottomNavbar />}

      <main className={cn(
        isMobile ? 'pb-20' : 'lg:ml-64'
      )}>
        {children}
      </main>
    </>
  );
}
```

### Step 4: Test Both Systems

Ensure feature parity:

- [ ] All routes accessible
- [ ] Active states match
- [ ] Role filtering works
- [ ] Submenus work
- [ ] Navigation works

### Step 5: Gradual Rollout

Option 1: Feature flag

```typescript
const useNewNavbar = process.env.NEXT_PUBLIC_NEW_NAVBAR === 'true';

{useNewNavbar ? <BottomNavbar /> : <OldNavbar />}
```

Option 2: User preference

```typescript
const { navbarPreference } = useUserPreferences();

{navbarPreference === 'bottom' ? <BottomNavbar /> : <Sidebar />}
```

### Step 6: Remove Old Navbar

After testing, remove old navbar and update layouts.

---

## Troubleshooting Integration Issues

### Issue: Navbar Not Showing

Check:
1. Is `isMobile` hook working? Add console.log
2. Is component mounted? Check render conditions
3. Is z-index correct? Should be z-[80]

### Issue: Role Filtering Not Working

Check:
1. Is user profile loading? Add loading state
2. Are permissions correct? Log user role
3. Is GetRoleBasedPages filtering correctly?

### Issue: Active States Wrong

Check:
1. Is pathname correct? Log current pathname
2. Are active checks using startsWith for nested routes?
3. Are redirect routes configured?

### Issue: Content Overlapping Navbar

Check:
1. Is bottom padding applied? Should be pb-20 on mobile
2. Is main element using correct classes?
3. Is navbar z-index higher than content?

---

## Best Practices

1. **Always test with real user roles** - Don't just test as admin
2. **Handle loading states** - Show skeleton while fetching user data
3. **Graceful degradation** - Show basic navigation if role fetch fails
4. **Cache user data** - Avoid refetching on every navigation
5. **Log permission checks** - Easier to debug access issues
6. **Document permission requirements** - For each route/feature
7. **Test edge cases** - No role, multiple roles, custom roles
8. **Monitor performance** - Role checks shouldn't slow navigation

---

## Example: Complete Integration

Full example with Supabase auth and role filtering:

```typescript
// lib/auth/auth-service.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export class AuthService {
  static async getUserProfile() {
    const supabase = createClientComponentClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile;
  }
}

// lib/sidebarMenuLink.ts
import { Home, Users, Settings } from 'lucide-react';

export function GetRoleBasedPages(pathname: string, userRole: string | null) {
  const isAdmin = userRole === 'admin';

  return [
    {
      groupLabel: 'Overview',
      menus: [{
        href: '/dashboard',
        label: 'Dashboard',
        icon: Home,
        active: pathname === '/dashboard',
        submenus: []
      }]
    },
    {
      groupLabel: 'Management',
      menus: [{
        href: '/users',
        label: 'Users',
        icon: Users,
        active: pathname.startsWith('/users'),
        submenus: []
      }]
    },
    ...(isAdmin ? [{
      groupLabel: 'Settings',
      menus: [{
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        active: pathname.startsWith('/settings'),
        submenus: []
      }]
    }] : [])
  ];
}

// app/(routes)/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavbar } from '@/components/BottomNav';
import { AuthService } from '@/lib/auth/auth-service';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await AuthService.getUserProfile();
      setIsLoading(false);
    };
    initAuth();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <main className={cn(
        'min-h-screen bg-background',
        isMobile && 'pb-20'
      )}>
        {children}
      </main>

      <BottomNavbar />
    </>
  );
}
```
