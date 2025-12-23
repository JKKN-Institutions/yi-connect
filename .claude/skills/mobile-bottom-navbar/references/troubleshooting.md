# Troubleshooting Guide

Common issues and solutions when implementing the mobile bottom navbar.

## Table of Contents

1. [Installation & Setup Issues](#installation--setup-issues)
2. [Display & Visibility Issues](#display--visibility-issues)
3. [State & Persistence Issues](#state--persistence-issues)
4. [Navigation & Routing Issues](#navigation--routing-issues)
5. [Animation & Performance Issues](#animation--performance-issues)
6. [TypeScript & Type Issues](#typescript--type-issues)
7. [Mobile & Responsive Issues](#mobile--responsive-issues)

---

## Installation & Setup Issues

### Issue: "Cannot find module 'zustand'"

**Error:**
```
Module not found: Can't resolve 'zustand'
```

**Solution:**
```bash
npm install zustand
# or
yarn add zustand
# or
pnpm add zustand
```

---

### Issue: "framer-motion not found"

**Error:**
```
Module not found: Can't resolve 'framer-motion'
```

**Solution:**
```bash
npm install framer-motion
# or
yarn add framer-motion
```

---

### Issue: "lucide-react icons not rendering"

**Problem:** Icons show as empty boxes or don't render

**Solution:**

1. Ensure lucide-react is installed:
```bash
npm install lucide-react
```

2. Check import statement:
```typescript
// Correct
import { Home, Users } from 'lucide-react';

// Incorrect
import Home from 'lucide-react/Home';
```

3. Verify icon is used correctly:
```typescript
// Correct
<Home className="h-5 w-5" />

// Incorrect
<Home />  // Missing className for sizing
```

---

### Issue: "cn utility not found"

**Error:**
```
Cannot find module '@/lib/utils'
```

**Solution:**

Create `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Install dependencies:
```bash
npm install clsx tailwind-merge
```

---

## Display & Visibility Issues

### Issue: Navbar not visible on mobile

**Symptoms:**
- Navbar doesn't show on mobile devices
- Only visible on desktop

**Possible Causes & Solutions:**

1. **Missing `lg:hidden` class**
```typescript
// Check bottom-navbar.tsx
className="lg:hidden"  // This hides on desktop (≥1024px)
```

2. **Z-index too low**
```typescript
// Should be high enough to be above content
className="z-[80]"
```

3. **Mobile hook not working**
```typescript
// Add debug logging
const isMobile = useIsMobile();
console.log('Is mobile:', isMobile);
```

4. **Component not mounted**
```typescript
// Check layout.tsx
<BottomNavbar />  // Should be outside conditional rendering
```

---

### Issue: Navbar visible on desktop

**Problem:** Navbar shows on desktop when it should be hidden

**Solution:**

Ensure `lg:hidden` class is applied:

```typescript
<motion.nav
  className={cn(
    'fixed bottom-0 left-0 right-0 z-[80]',
    'lg:hidden',  // Must have this
    'bg-background border-t border-border'
  )}
>
```

---

### Issue: Content overlaps with navbar

**Problem:** Page content goes behind the navbar

**Solution:**

Add bottom padding to main content:

```typescript
// In layout.tsx
const isMobile = useIsMobile();

<main
  className={cn(
    'min-h-screen',
    isMobile && 'pb-20'  // 80px padding for navbar height
  )}
>
  {children}
</main>
```

Adjust padding if navbar height is different:
```typescript
// For taller navbar
isMobile && 'pb-24'  // 96px

// For shorter navbar
isMobile && 'pb-16'  // 64px
```

---

### Issue: Backdrop not showing

**Problem:** No darkening when submenu opens

**Solution:**

Check backdrop component is rendered:

```typescript
<AnimatePresence>
  {isExpanded && !isMoreMenuOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[75]"
      onClick={() => setExpanded(false)}
    />
  )}
</AnimatePresence>
```

Ensure z-index is correct:
- Backdrop: `z-[75]`
- Navbar: `z-[80]`

---

## State & Persistence Issues

### Issue: Flash of incorrect state on page load

**Problem:** Navbar shows wrong state briefly when page loads

**Solution:**

Wait for Zustand hydration:

```typescript
const hasHydrated = useBottomNavHydration();

if (!hasHydrated) {
  return null;  // Don't render until hydrated
}
```

---

### Issue: State not persisting across refreshes

**Problem:** Active nav resets when page refreshes

**Cause:** Persisted state configuration issue

**Solution:**

Check `use-bottom-nav.ts` persistence config:

```typescript
persist(
  (set) => ({ /* state */ }),
  {
    name: 'bottom-nav-storage',  // Must be unique
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      // Only persist serializable data
      selectedSubItem: state.selectedSubItem,
      isMinimized: state.isMinimized,
      activePage: state.activePage ? {
        href: state.activePage.href,
        label: state.activePage.label,
        groupLabel: state.activePage.groupLabel
        // Don't persist icon (not serializable)
      } : null
    })
  }
)
```

---

### Issue: "Cannot serialize icon component"

**Error:**
```
Error: Icon cannot be serialized
```

**Solution:**

Don't persist icon in localStorage:

```typescript
// In use-bottom-nav.ts
partialize: (state) => ({
  activePage: state.activePage ? {
    href: state.activePage.href,
    label: state.activePage.label,
    groupLabel: state.activePage.groupLabel
    // Explicitly exclude icon
  } : null
})
```

Icon is reconstructed from GROUP_ICONS mapping:

```typescript
const Icon = ('icon' in activePage && typeof activePage.icon === 'function')
  ? activePage.icon
  : GROUP_ICONS[activePage.groupLabel] || Home;
```

---

### Issue: Submenu doesn't close after navigation

**Problem:** Submenu stays open after clicking item

**Solution:**

Ensure submenu closes in click handler:

```typescript
const handleSubmenuClick = useCallback(
  (href: string) => {
    router.push(href);
    setExpanded(false);  // Must close submenu
  },
  [router, setExpanded]
);
```

---

## Navigation & Routing Issues

### Issue: Active state not updating

**Problem:** Wrong nav item highlighted as active

**Solutions:**

1. **Check pathname matching logic:**
```typescript
// For exact match
active: pathname === '/dashboard'

// For nested routes
active: pathname.startsWith('/users')

// For parent and nested
active: pathname === '/billing' || pathname.startsWith('/billing/')
```

2. **Check redirect routes:**
```typescript
const REDIRECT_ROUTES: Record<string, string> = {
  '/': '/dashboard',
};

const parentHref = REDIRECT_ROUTES[menu.href] || menu.href;
```

3. **Debug with console.log:**
```typescript
console.log('Current pathname:', pathname);
console.log('Menu href:', menu.href);
console.log('Is active:', menu.active);
```

---

### Issue: Navigation doesn't work

**Problem:** Clicking nav items doesn't navigate

**Solutions:**

1. **Check Next.js router import:**
```typescript
import { useRouter } from 'next/navigation';  // ✅ App Router
// NOT from 'next/router' (Pages Router)
```

2. **Verify click handler:**
```typescript
const handleSubmenuClick = useCallback(
  (href: string) => {
    router.push(href);  // Use push, not replace
    setExpanded(false);
  },
  [router, setExpanded]
);
```

3. **Check href format:**
```typescript
// Correct
href: '/dashboard'

// Incorrect (missing leading slash)
href: 'dashboard'
```

---

### Issue: Parent-only routes showing as clickable

**Problem:** Routes with no page are clickable

**Solution:**

Add to PARENT_ONLY_ROUTES:

```typescript
const PARENT_ONLY_ROUTES = new Set([
  '/billing/categories',  // Has no page, only submenus
]);

// This route won't be added as a clickable item
```

---

## Animation & Performance Issues

### Issue: Animations are janky or laggy

**Solutions:**

1. **Use GPU acceleration:**
```typescript
// Add transform to trigger GPU
className="transform-gpu"
```

2. **Reduce animation complexity:**
```typescript
// Simpler spring config
transition={{
  type: 'spring',
  stiffness: 400,  // Lower = slower
  damping: 40,     // Higher = less bounce
  mass: 1
}}
```

3. **Use will-change CSS:**
```typescript
className="will-change-transform"
```

4. **Disable for low-end devices:**
```typescript
const prefersReducedMotion = useReducedMotion();

transition={prefersReducedMotion ? { duration: 0 } : springConfig}
```

---

### Issue: Layout shift when navbar loads

**Problem:** Content jumps when navbar appears

**Solution:**

Reserve space for navbar immediately:

```typescript
<main className="pb-20">  {/* Always reserve space */}
  {children}
</main>

<BottomNavbar />  {/* Fixed position doesn't affect layout */}
```

---

### Issue: Memory leak warnings

**Error:**
```
Warning: Can't perform a React state update on an unmounted component
```

**Solution:**

Clean up event listeners:

```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    // Handler logic
  };

  if (isExpanded) {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);  // Clean up
    };
  }
}, [isExpanded]);
```

---

## TypeScript & Type Issues

### Issue: "Property 'icon' does not exist"

**Error:**
```
Property 'icon' does not exist on type 'ActivePageInfo'
```

**Solution:**

Ensure types match usage:

```typescript
// types.ts
export interface ActivePageInfo {
  href: string;
  label: string;
  icon: LucideIcon;  // Include if using icon
  groupLabel: string;
}

// Or handle both cases
export interface ActivePageInfo {
  href: string;
  label: string;
  icon?: LucideIcon;  // Optional
  groupLabel: string;
}
```

---

### Issue: "Type 'string' is not assignable to type 'LucideIcon'"

**Error:**
```
Type 'string' is not assignable to type 'LucideIcon'
```

**Solution:**

Import icon as component, not string:

```typescript
// Correct
import { Home } from 'lucide-react';
const icon = Home;

// Incorrect
const icon = 'Home';
```

---

### Issue: "Cannot find name 'MenuGroup'"

**Error:**
```
Cannot find name 'MenuGroup'
```

**Solution:**

Export type from sidebarMenuLink.ts:

```typescript
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

---

## Mobile & Responsive Issues

### Issue: Touch events not working

**Problem:** Taps don't register on mobile

**Solutions:**

1. **Increase touch target size:**
```typescript
// Minimum 48x48px for touch
className="min-h-[48px] min-w-[48px]"
```

2. **Remove hover-only interactions:**
```typescript
// Add active state for touch
className="hover:bg-muted active:bg-muted"
```

3. **Add touch event handlers:**
```typescript
<button
  onClick={handleClick}
  onTouchEnd={(e) => {
    e.preventDefault();
    handleClick();
  }}
>
```

---

### Issue: iOS safe area not working

**Problem:** Navbar overlaps iPhone notch/home indicator

**Solution:**

Add safe area inset padding:

```typescript
style={{
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
}}
```

In viewport meta tag:

```html
<!-- In app/layout.tsx or pages/_document.tsx -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

---

### Issue: Different behavior in Chrome DevTools vs real device

**Problem:** Works in responsive mode but not on actual phone

**Solution:**

Always test on real devices:
1. **Use mobile device for testing**
2. **Check actual viewport size**
3. **Test touch interactions**
4. **Verify safe area insets**

Debug viewport:
```typescript
console.log('Window width:', window.innerWidth);
console.log('Is mobile:', window.innerWidth < 1024);
```

---

## Common Error Messages

### "Hydration failed"

**Full error:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server
```

**Cause:** Server-rendered HTML doesn't match client

**Solution:**

Wait for hydration before rendering:

```typescript
const hasHydrated = useBottomNavHydration();

if (!hasHydrated) {
  return null;
}
```

Or use `useEffect` for client-only code:

```typescript
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

if (!isMounted) return null;
```

---

### "Maximum update depth exceeded"

**Cause:** Infinite re-render loop

**Solution:**

Check for missing dependencies in `useCallback`:

```typescript
// Before (causes infinite loop)
const handleClick = useCallback(() => {
  setExpanded(!isExpanded);
}, []);  // Missing isExpanded dependency

// After (correct)
const handleClick = useCallback(() => {
  setExpanded(!isExpanded);
}, [isExpanded]);

// Better (no dependency needed)
const handleClick = useCallback(() => {
  setExpanded((prev) => !prev);
}, []);
```

---

### "Cannot read property 'menus' of undefined"

**Cause:** Navigation group is undefined

**Solution:**

Add null checks:

```typescript
// Before
const activeSubmenus = currentActiveGroup.menus;

// After
const activeSubmenus = currentActiveGroup?.menus || [];

// Or
if (!currentActiveGroup) return null;
const activeSubmenus = currentActiveGroup.menus;
```

---

## Debugging Tips

### Enable Debug Logging

Add logging to track state changes:

```typescript
// In bottom-navbar.tsx
useEffect(() => {
  console.log('[BottomNav] State:', {
    activeNavId,
    isExpanded,
    isMoreMenuOpen,
    currentPath: pathname
  });
}, [activeNavId, isExpanded, isMoreMenuOpen, pathname]);
```

### React DevTools

1. Install React DevTools extension
2. Inspect component tree
3. Check state values in real-time
4. Track re-renders with Profiler

### Zustand DevTools

```typescript
import { devtools } from 'zustand/middleware';

export const useBottomNav = create<BottomNavState>()(
  devtools(
    persist(
      (set) => ({ /* state */ }),
      { name: 'bottom-nav-storage' }
    ),
    { name: 'BottomNav' }  // Shows in Redux DevTools
  )
);
```

### TypeScript Compiler

Run type checking:
```bash
npx tsc --noEmit
```

---

## Performance Optimization

### Issue: Slow re-renders

**Solutions:**

1. **Memoize expensive computations:**
```typescript
const allNavGroups = useMemo(() => {
  return filteredPages.map(/* transform */);
}, [filteredPages]);
```

2. **Use useCallback for handlers:**
```typescript
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

3. **Split into smaller components:**
```typescript
// Instead of one large component
<BottomNavbar />

// Split into smaller memoized components
const MemoizedNavItem = memo(BottomNavItem);
<MemoizedNavItem {...props} />
```

---

## Still Having Issues?

### Check Common Mistakes

1. ✅ All dependencies installed
2. ✅ Tailwind configured correctly
3. ✅ Component files in correct locations
4. ✅ Zustand store exported correctly
5. ✅ Hydration check implemented
6. ✅ Mobile hook working
7. ✅ Layout integration correct
8. ✅ Bottom padding on main content

### Debug Checklist

- [ ] Check browser console for errors
- [ ] Verify network requests (auth, role fetch)
- [ ] Test on real mobile device
- [ ] Check React DevTools component tree
- [ ] Enable debug logging
- [ ] Run TypeScript type check
- [ ] Test with different user roles
- [ ] Clear localStorage and test fresh state

### Get Help

If issues persist:

1. **Create minimal reproduction**
   - Isolate the problem
   - Remove unrelated code
   - Share reproduction repo

2. **Document the issue**
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/videos
   - Browser/device info
   - Error messages

3. **Check examples**
   - Review reference implementation
   - Compare with working examples
   - Test example code first
