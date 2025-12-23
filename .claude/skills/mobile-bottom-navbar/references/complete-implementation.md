# Complete Implementation Guide

This guide provides a step-by-step walkthrough for implementing the standardized mobile bottom navbar in any Next.js 14+ application.

## Prerequisites

Before starting, ensure your project has:

- **Next.js 14+** with App Router
- **TypeScript** configured
- **Tailwind CSS** set up
- **Node.js 18+**

## Installation

### Step 1: Install Required Dependencies

```bash
npm install zustand framer-motion lucide-react
# or
yarn add zustand framer-motion lucide-react
# or
pnpm add zustand framer-motion lucide-react
```

### Step 2: Install Optional Dependencies (Recommended)

For the "More" menu sheet functionality:

```bash
npx shadcn@latest add sheet
npx shadcn@latest add scroll-area
```

Or manually install:

```bash
npm install @radix-ui/react-dialog
```

### Step 3: Verify Tailwind Configuration

Ensure your `tailwind.config.ts` includes:

```typescript
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Optional: Add custom colors for navbar theming
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
      },
    },
  },
}
```

### Step 4: Set Up Utilities

Create or verify `lib/utils.ts` has the `cn` utility:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If missing, install dependencies:

```bash
npm install clsx tailwind-merge
```

## File Structure

Create the following directory structure:

```
your-project/
├── components/
│   └── BottomNav/
│       ├── bottom-navbar.tsx           # Main navbar component
│       ├── bottom-nav-item.tsx         # Individual nav button
│       ├── bottom-nav-submenu.tsx      # Expandable submenu overlay
│       ├── bottom-nav-more-menu.tsx    # Overflow "More" menu
│       ├── bottom-nav-minimized.tsx    # (Optional) Minimized state
│       ├── types.ts                    # TypeScript type definitions
│       └── index.ts                    # Barrel export
├── hooks/
│   ├── use-bottom-nav.ts               # Zustand state management
│   └── use-mobile.ts                   # Mobile detection hook
└── lib/
    └── sidebarMenuLink.ts              # Navigation structure (your existing file)
```

## Step-by-Step Implementation

### Step 1: Create Type Definitions

Create `components/BottomNav/types.ts`:

```typescript
import { LucideIcon } from 'lucide-react';

export interface FlatMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

export interface BottomNavGroup {
  id: string;
  groupLabel: string;
  icon: LucideIcon;
  menus: FlatMenuItem[];
}

export interface ActivePageInfo {
  href: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
}

export interface BottomNavState {
  activeNavId: string | null;
  isExpanded: boolean;
  isMoreMenuOpen: boolean;
  isMinimized: boolean;
  activePage: ActivePageInfo | null;
  selectedSubItem: string | null;

  setActiveNav: (id: string | null) => void;
  switchToNav: (id: string) => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleMoreMenu: () => void;
  setMoreMenuOpen: (open: boolean) => void;
  setSelectedSubItem: (item: string | null) => void;
  setMinimized: (minimized: boolean) => void;
  setActivePage: (page: ActivePageInfo | null) => void;
  resetState: () => void;
}
```

### Step 2: Create Mobile Detection Hook

Create `hooks/use-mobile.ts`:

```typescript
import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 1024; // lg breakpoint in Tailwind

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
```

### Step 3: Create Zustand State Store

Create `hooks/use-bottom-nav.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BottomNavState, ActivePageInfo } from '@/components/BottomNav/types';

// Extended state type to include hydration tracking
interface BottomNavStateExtended extends BottomNavState {
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useBottomNav = create<BottomNavStateExtended>()(
  persist(
    (set) => ({
      activeNavId: null,
      isExpanded: false,
      isMoreMenuOpen: false,
      isMinimized: false,  // Always show full navbar
      activePage: null,
      selectedSubItem: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setActiveNav: (id) =>
        set({
          activeNavId: id
        }),

      // Atomic state update for switching nav groups
      switchToNav: (id) =>
        set({
          activeNavId: id,
          isExpanded: true,
          isMoreMenuOpen: false
        }),

      toggleExpanded: () =>
        set((state) => ({
          isExpanded: !state.isExpanded
        })),

      setExpanded: (expanded) =>
        set({
          isExpanded: expanded
        }),

      toggleMoreMenu: () =>
        set((state) => ({
          isMoreMenuOpen: !state.isMoreMenuOpen,
          isExpanded: false
        })),

      setMoreMenuOpen: (open) =>
        set({
          isMoreMenuOpen: open,
          isExpanded: false
        }),

      setSelectedSubItem: (item) =>
        set({
          selectedSubItem: item
        }),

      setMinimized: (minimized) =>
        set({
          isMinimized: minimized,
          isExpanded: false,
          isMoreMenuOpen: false
        }),

      setActivePage: (page) =>
        set({
          activePage: page
        }),

      resetState: () =>
        set({
          activeNavId: null,
          isExpanded: false,
          isMoreMenuOpen: false,
          isMinimized: false,
          activePage: null,
          selectedSubItem: null
        })
    }),
    {
      name: 'bottom-nav-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedSubItem: state.selectedSubItem,
        isMinimized: state.isMinimized,
        // Only persist serializable data (icons are not serializable)
        activePage: state.activePage ? {
          href: state.activePage.href,
          label: state.activePage.label,
          groupLabel: state.activePage.groupLabel
        } : null
      }),
      // Track when hydration completes to prevent flash of wrong state
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

// Helper hook to wait for hydration before rendering
export const useBottomNavHydration = () => {
  return useBottomNav((state) => state._hasHydrated);
};
```

### Step 4: Copy Component Files

Copy all component files from the `assets/components/BottomNav/` directory into your project's `components/BottomNav/` directory:

- `bottom-navbar.tsx` - Main component
- `bottom-nav-item.tsx` - Nav button
- `bottom-nav-submenu.tsx` - Submenu overlay
- `bottom-nav-more-menu.tsx` - More menu sheet
- `index.ts` - Barrel export

These files are ready to use and include all the logic from the reference implementation.

### Step 5: Integrate with Layout

Update your `app/(routes)/layout.tsx` or main layout component:

```typescript
'use client';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavbar } from '@/components/BottomNav';

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Your existing sidebar or header */}

      <main
        className={cn(
          'min-h-screen bg-background',
          // Add bottom padding on mobile to prevent content overlap
          isMobile && 'pb-20'
        )}
      >
        {children}
      </main>

      {/* Bottom Navigation for mobile */}
      <BottomNavbar />
    </>
  );
}
```

### Step 6: Configure Navigation Structure

Update your navigation configuration file (e.g., `lib/sidebarMenuLink.ts`) to export a function that returns menu groups:

```typescript
import { LucideIcon } from 'lucide-react';

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
  role: YourRoleType | null
): MenuGroup[] {
  // Return filtered menu groups based on user role
  // See integration-guide.md for detailed examples
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
    // ... more groups
  ];
}
```

## Testing

### Visual Testing Checklist

- [ ] Navbar appears at bottom on mobile (width < 1024px)
- [ ] Hidden on desktop (width >= 1024px)
- [ ] Active nav item is highlighted
- [ ] Submenu expands smoothly when clicking nav item
- [ ] More menu opens when clicking "More" button
- [ ] Backdrop appears when submenu is open
- [ ] Click outside closes submenu
- [ ] Animations are smooth

### Functionality Testing

- [ ] Clicking nav items navigates to correct routes
- [ ] Submenu toggles correctly
- [ ] Active detection updates when route changes
- [ ] State persists across page reloads
- [ ] No content overlap with bottom navbar

### Mobile-Specific Testing

- [ ] iOS safe area insets work correctly
- [ ] Touch interactions are responsive
- [ ] Works on actual mobile devices (not just responsive mode)

## Troubleshooting

See `troubleshooting.md` for common issues and solutions.

## Next Steps

- **Customization**: See `customization-guide.md` to customize colors, animations, and layout
- **Role-Based Filtering**: See `integration-guide.md` for auth system integration
- **Component Reference**: See `component-reference.md` for detailed API documentation
