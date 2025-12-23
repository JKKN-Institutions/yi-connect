# Component Reference

Detailed documentation for all bottom navbar components.

## Table of Contents

1. [BottomNavbar](#bottomnavbar) - Main component
2. [BottomNavItem](#bottomnavitem) - Individual nav button
3. [BottomNavSubmenu](#bottomnavsubmenu) - Expandable submenu overlay
4. [BottomNavMoreMenu](#bottomnavmoremenu) - Overflow menu sheet
5. [BottomNavMinimized](#bottomnavminimized) - Minimized state (optional)

---

## BottomNavbar

The main bottom navigation component that orchestrates all child components.

### Location

`components/BottomNav/bottom-navbar.tsx`

### Features

- **Always Visible on Mobile**: Full navbar always shown, no minimized state
- **Role-Based Filtering**: Filters menu items based on user permissions
- **Smart Active Detection**: Automatically highlights current page's nav item
- **Submenu Expansion**: Click to expand submenu with backdrop overlay
- **Overflow Handling**: Shows "More" menu when > 4 groups
- **State Persistence**: Zustand with localStorage
- **Hydration Safety**: Prevents flash of incorrect state
- **Smooth Animations**: Spring-based with Framer Motion

### Props

This component doesn't accept props - it's completely self-contained.

### Key Configuration

#### Icon Mapping

```typescript
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Overview': Home,
  'User Management': Users,
  'Applications': TabletSmartphone,
  'Organization Management': Building,
  'Learners Management': GraduationCap,
  // Add your custom mappings here
};
```

#### Parent-Only Routes

Routes that have no actual page (only submenus):

```typescript
const PARENT_ONLY_ROUTES = new Set([
  '/billing/categories',
  // Add routes that should not be directly accessible
]);
```

#### Redirect Routes

Routes that should redirect elsewhere:

```typescript
const REDIRECT_ROUTES: Record<string, string> = {
  '/': '/dashboard',
  // Add custom redirects
};
```

### Internal Logic Flow

1. **Initialization**
   - Fetch user role
   - Get filtered pages based on role
   - Transform to bottom nav groups
   - Determine primary (first 4) and more groups (remaining)

2. **Active Detection**
   - Find group containing current pathname
   - Exact match or startsWith for nested routes
   - Update active nav ID

3. **User Interactions**
   - **Click nav item**: Toggle submenu or switch to different group
   - **Click submenu item**: Navigate and close submenu
   - **Click More**: Open overflow menu
   - **Click outside**: Close submenu

4. **State Management**
   - `activeNavId`: Currently selected nav group
   - `isExpanded`: Submenu open/closed
   - `isMoreMenuOpen`: More menu open/closed
   - `activePage`: Current page info (for minimized state)

### Usage Example

```typescript
import { BottomNavbar } from '@/components/BottomNav';

export default function Layout({ children }) {
  return (
    <>
      <main className="pb-20"> {/* Add bottom padding */}
        {children}
      </main>
      <BottomNavbar />
    </>
  );
}
```

---

## BottomNavItem

Individual navigation button component.

### Location

`components/BottomNav/bottom-nav-item.tsx`

### Props

```typescript
interface BottomNavItemProps {
  id: string;                    // Unique identifier for this nav item
  icon: LucideIcon;              // Icon component from lucide-react
  label: string;                 // Display label
  isActive: boolean;             // Is this item currently active?
  hasSubmenu: boolean;           // Does this item have a submenu?
  badgeCount?: number;           // Optional badge count (for "More" button)
  onClick: () => void;           // Click handler
}
```

### Features

- **Active State**: Highlighted when `isActive` is true
- **Icon Animation**: Smooth transitions and hover effects
- **Badge Support**: Shows count badge (used for More menu)
- **Touch Optimized**: Proper touch targets (48x48px minimum)
- **Accessibility**: Semantic button with proper ARIA attributes

### Styling

```typescript
// Active state
bg-primary/10 text-primary

// Inactive state
text-muted-foreground hover:text-foreground

// Badge
bg-primary/20 text-primary text-xs
```

### Usage Example

```typescript
<BottomNavItem
  id="dashboard"
  icon={Home}
  label="Home"
  isActive={activeNavId === 'dashboard'}
  hasSubmenu={true}
  onClick={() => handleNavClick('dashboard')}
/>
```

---

## BottomNavSubmenu

Expandable submenu overlay that slides up from bottom navbar.

### Location

`components/BottomNav/bottom-nav-submenu.tsx`

### Props

```typescript
interface BottomNavSubmenuProps {
  items: FlatMenuItem[];         // Array of menu items to display
  isOpen: boolean;               // Is submenu currently open?
  onItemClick: (href: string) => void;  // Item click handler
}
```

### Features

- **Slide Animation**: Smooth slide-up from navbar
- **Grid Layout**: Responsive grid with 3-4 columns
- **Active Highlighting**: Current page highlighted
- **Scroll Support**: Vertical scroll for many items
- **Auto Close**: Closes after navigation

### Layout

```typescript
// Container
max-h-[60vh] overflow-y-auto

// Grid
grid grid-cols-3 gap-2 p-4
md:grid-cols-4

// Item
flex flex-col items-center gap-2 p-3 rounded-xl
```

### Animation Config

```typescript
initial={{ height: 0, opacity: 0 }}
animate={{ height: 'auto', opacity: 1 }}
exit={{ height: 0, opacity: 0 }}
transition={{ duration: 0.2, ease: 'easeInOut' }}
```

### Usage Example

```typescript
<BottomNavSubmenu
  items={[
    { href: '/students', label: 'Students', icon: Users, active: true },
    { href: '/staff', label: 'Staff', icon: Users, active: false },
  ]}
  isOpen={isExpanded}
  onItemClick={(href) => {
    router.push(href);
    setExpanded(false);
  }}
/>
```

---

## BottomNavMoreMenu

Sheet component for overflow navigation groups (beyond first 4).

### Location

`components/BottomNav/bottom-nav-more-menu.tsx`

### Props

```typescript
interface BottomNavMoreMenuProps {
  groups: BottomNavGroup[];      // Array of overflow groups
  isOpen: boolean;               // Is menu currently open?
  onClose: () => void;           // Close handler
  onItemClick: (href: string) => void;  // Item click handler
}
```

### Features

- **Sheet Modal**: Full-screen overlay on mobile
- **Grouped Display**: Shows all overflow groups organized
- **Search/Filter**: Optional search functionality
- **Scroll Area**: Scrollable content for many groups

### Dependencies

Requires shadcn/ui Sheet component:

```bash
npx shadcn@latest add sheet
```

Or manually:

```bash
npm install @radix-ui/react-dialog
```

### Layout Structure

```
Sheet
  └── SheetContent (right side)
      ├── SheetHeader
      │   └── SheetTitle ("More")
      └── ScrollArea
          └── Groups
              ├── Group 1
              │   ├── Group Label
              │   └── Menu Items (grid)
              ├── Group 2
              └── ...
```

### Usage Example

```typescript
<BottomNavMoreMenu
  groups={moreNavGroups}
  isOpen={isMoreMenuOpen}
  onClose={() => setMoreMenuOpen(false)}
  onItemClick={(href) => {
    router.push(href);
    setMoreMenuOpen(false);
  }}
/>
```

---

## BottomNavMinimized

Optional minimized state showing only the active page.

### Location

`components/BottomNav/bottom-nav-minimized.tsx`

### Props

```typescript
interface BottomNavMinimizedProps {
  activePage: ActivePageInfo | {
    href: string;
    label: string;
    groupLabel: string
  };
  onExpand: () => void;          // Handler to expand to full navbar
}
```

### Features

- **Floating Pill**: Rounded card at bottom with active page
- **Expand Button**: X button to show full navbar
- **Icon Display**: Shows group icon
- **iOS Safe Area**: Respects safe area insets

### When to Use

The current implementation doesn't use minimized state (always shows full navbar). However, this component is included for projects that prefer a minimized approach:

1. User navigates to a page → Navbar minimizes to show only active page
2. User clicks X button → Navbar expands to full view
3. User clicks nav item → Navbar returns to minimized after navigation

To enable minimized state, update `hooks/use-bottom-nav.ts`:

```typescript
isMinimized: true,  // Start minimized
```

And update `bottom-navbar.tsx` to use minimized logic.

### Usage Example

```typescript
{isMinimized ? (
  <BottomNavMinimized
    activePage={activePage}
    onExpand={() => setMinimized(false)}
  />
) : (
  <BottomNavbar />
)}
```

---

## State Management

### Zustand Store

Location: `hooks/use-bottom-nav.ts`

#### State Properties

```typescript
{
  activeNavId: string | null;       // Currently selected nav group ID
  isExpanded: boolean;               // Is submenu expanded?
  isMoreMenuOpen: boolean;           // Is More menu open?
  isMinimized: boolean;              // Is navbar minimized? (false = always full)
  activePage: ActivePageInfo | null; // Current active page info
  selectedSubItem: string | null;    // Currently selected submenu item
  _hasHydrated: boolean;             // Has Zustand hydrated from localStorage?
}
```

#### Actions

```typescript
{
  setActiveNav: (id: string | null) => void;
  switchToNav: (id: string) => void;        // Atomic: set active + expand
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

#### Persistence

Only serializable data is persisted to localStorage:

```typescript
{
  selectedSubItem: string | null;
  isMinimized: boolean;
  activePage: {
    href: string;
    label: string;
    groupLabel: string;
    // NOTE: icon is NOT persisted (not serializable)
  }
}
```

#### Hydration Safety

The store tracks hydration status to prevent flash of incorrect state:

```typescript
const hasHydrated = useBottomNavHydration();

if (!hasHydrated) {
  return null;  // Don't render until hydrated
}
```

---

## Animation Configuration

All components use Framer Motion with consistent animation configs.

### Spring Animation (Primary)

Used for navbar and submenu animations:

```typescript
const springConfig = {
  type: 'spring',
  stiffness: 500,  // Fast response
  damping: 35,     // Smooth stop
  mass: 0.8        // Light weight
};
```

### Fade Animation (Secondary)

Used for opacity transitions:

```typescript
const fadeConfig = {
  type: 'tween',
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1]  // Ease-in-out cubic
};
```

### Backdrop Animation

```typescript
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.12, ease: 'easeOut' }}
```

---

## Responsive Behavior

### Desktop (>= 1024px)

```typescript
className="lg:hidden"  // Navbar completely hidden
```

### Mobile (< 1024px)

```typescript
className="fixed bottom-0 left-0 right-0 z-[80]"  // Fixed at bottom
```

### Content Padding

```typescript
// Add to main content to prevent overlap
className={cn(
  'min-h-screen',
  isMobile && 'pb-20'  // 80px padding for navbar
)}
```

---

## Z-Index Layers

```
Backdrop: z-[75]      // Behind navbar
Navbar: z-[80]        // Bottom navbar
Submenu: z-[80]       // Same level as navbar
More Menu: z-[90]     // Above navbar (Sheet modal)
```

---

## Accessibility

### Keyboard Navigation

- **Tab**: Navigate between nav items
- **Enter/Space**: Activate nav item
- **Escape**: Close submenu/More menu

### Screen Readers

All components include proper ARIA attributes:

```typescript
<button
  aria-label={`Navigate to ${label}`}
  aria-current={isActive ? 'page' : undefined}
  role="button"
>
```

### Focus Management

When submenu opens:
1. Focus moves to first submenu item
2. Trap focus within submenu
3. Return focus to trigger button on close

---

## Performance Optimizations

### Memoization

All expensive computations are memoized:

```typescript
const allNavGroups = useMemo(() => {
  return filteredPages.map(/* transform */);
}, [filteredPages]);

const primaryNavGroups = useMemo(() => {
  return allNavGroups.slice(0, 4);
}, [allNavGroups]);
```

### Callbacks

All event handlers use `useCallback`:

```typescript
const handleNavClick = useCallback(
  (groupId: string) => {
    // Handler logic
  },
  [activeNavId, isExpanded, switchToNav]
);
```

### Layout Effects

Use `useLayoutEffect` for immediate updates before paint:

```typescript
useLayoutEffect(() => {
  if (currentActivePage) {
    setActivePage(currentActivePage);  // Instant update
  }
}, [currentActivePage]);
```

### Event Listener Cleanup

Always clean up event listeners:

```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    // Handler
  };

  if (isExpanded) {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
}, [isExpanded]);
```

---

## Best Practices

1. **Always wait for hydration** before rendering
2. **Use atomic state updates** (switchToNav instead of multiple setters)
3. **Clean up event listeners** in useEffect
4. **Memoize expensive computations** with useMemo
5. **Use useCallback** for event handlers
6. **Handle nested routes** with startsWith checks
7. **Don't persist non-serializable data** (like icon components)
8. **Test on real mobile devices**, not just responsive mode

---

## TypeScript Tips

### Type Imports

```typescript
import type { LucideIcon } from 'lucide-react';
import type { BottomNavGroup, ActivePageInfo } from './types';
```

### Custom Role Type

If using role-based filtering:

```typescript
// Define your role type
export type UserRole = 'admin' | 'teacher' | 'student';

// Use in function signature
export function GetRoleBasedPages(
  pathname: string,
  role: UserRole | null
): MenuGroup[] {
  // Implementation
}
```

### Strict Null Checks

Always check for null values:

```typescript
if (!currentActiveGroup) return null;

const effectiveActivePage = currentActivePage || activePage;
if (!effectiveActivePage) return null;
```
