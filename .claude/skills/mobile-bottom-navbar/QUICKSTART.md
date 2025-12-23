# Mobile Bottom Navbar - Quick Start Guide

## 🎯 Goal
Implement the exact same bottom navbar pattern from MyJKKN in your Next.js application with:
- 3-column icon grid for submenus
- Accordion-based More menu with all groups expanded by default
- Smooth animations and state persistence

## 📸 Visual Reference
See actual UI examples in `references/screenshots/`:
- `myjkkn-dashboard.png` - Main bottom navbar
- `myjkkn-submenu-dropdown.png` - Submenu grid dropdown
- `myjkkn-more-menu.png` - **Accordion More menu (KEY PATTERN)**

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```bash
# Core dependencies
npm install zustand framer-motion lucide-react clsx tailwind-merge

# Shadcn/ui components
npx shadcn@latest add sheet accordion scroll-area
```

### Step 2: Copy All Component Files (2 min)

**From:** `.claude/skills/mobile-bottom-navbar/assets/`
**To:** Your project root

```bash
# Copy components
cp -r .claude/skills/mobile-bottom-navbar/assets/components/BottomNav components/

# Copy hooks
cp .claude/skills/mobile-bottom-navbar/assets/hooks/use-bottom-nav.ts hooks/
cp .claude/skills/mobile-bottom-navbar/assets/hooks/use-mobile.tsx hooks/
```

**Files copied:**
- ✅ `components/BottomNav/bottom-navbar.tsx` (Main component)
- ✅ `components/BottomNav/bottom-nav-item.tsx` (Nav button)
- ✅ `components/BottomNav/bottom-nav-submenu.tsx` (3-column grid dropdown)
- ✅ `components/BottomNav/bottom-nav-more-menu.tsx` **(KEY: Accordion + grid)**
- ✅ `components/BottomNav/bottom-nav-minimized.tsx` (Optional)
- ✅ `components/BottomNav/types.ts` (TypeScript types)
- ✅ `components/BottomNav/index.ts` (Exports)
- ✅ `hooks/use-bottom-nav.ts` (State management)
- ✅ `hooks/use-mobile.tsx` (Mobile detection)

### Step 3: Integrate in Layout (1 min)

Update `app/(routes)/layout.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavbar } from '@/components/BottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <>
      <main className={cn(
        'min-h-screen bg-background',
        isMobile && 'pb-20'  // Critical: Add bottom padding
      )}>
        {children}
      </main>

      <BottomNavbar />
    </>
  );
}
```

### Step 4: Configure Navigation (1 min)

Create or update `lib/sidebarMenuLink.ts`:

```typescript
import { Home, Users, Building, /* ... */ } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  submenus: Array<{ href: string; label: string; active: boolean }>;
}

interface MenuGroup {
  groupLabel: string;
  menus: MenuItem[];
}

export function GetRoleBasedPages(
  pathname: string,
  userRole?: any // Replace with your user role type
): MenuGroup[] {
  return [
    // First 4 groups → Bottom navbar items
    {
      groupLabel: 'Overview',
      menus: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: Home,
          active: pathname === '/dashboard',
          submenus: [
            { href: '/dashboard', label: 'Dashboard', active: pathname === '/dashboard' },
            { href: '/ai-assistant', label: 'AI Assistant', active: pathname === '/ai-assistant' }
          ]
        }
      ]
    },
    {
      groupLabel: 'User Management',
      menus: [
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          active: pathname.startsWith('/users'),
          submenus: [
            { href: '/users/list', label: 'User List', active: pathname === '/users/list' },
            { href: '/users/roles', label: 'Roles', active: pathname === '/users/roles' }
          ]
        }
      ]
    },
    // ... 2 more groups for navbar items (total 4)

    // Groups 5+ → More menu (accordion + icon grid)
    {
      groupLabel: 'Organization Management',
      menus: [
        {
          href: '/organization',
          label: 'Organization',
          icon: Building,
          active: pathname.startsWith('/organization'),
          submenus: [
            { href: '/organization/institutions', label: 'Institutions', active: false },
            { href: '/organization/degrees', label: 'Degrees', active: false },
            { href: '/organization/departments', label: 'Departments', active: false },
            { href: '/organization/programs', label: 'Programs', active: false },
            { href: '/organization/semesters', label: 'Semesters', active: false },
            { href: '/organization/sections', label: 'Sections', active: false },
            { href: '/organization/courses', label: 'All Courses', active: false },
            { href: '/organization/mappings', label: 'Course Mappings', active: false }
          ]
        }
      ]
    }
    // ... More groups as needed
  ];
}
```

**💡 Tip:** See `assets/examples/basic-setup.tsx` for a complete example.

---

## ✅ Verification Checklist

Test your implementation:

### Mobile View (< 1024px)
- [ ] Bottom navbar appears with 4 items + "More" button
- [ ] More button shows badge count (e.g., "5+")
- [ ] Active item highlighted with primary color
- [ ] Active indicator line below active item

### Submenu Dropdown
- [ ] Click nav item → Submenu appears **ABOVE** navbar
- [ ] Submenu shows **3-column grid** with icons + labels
- [ ] Click outside → Submenu closes
- [ ] Backdrop overlay visible when open

### More Menu (Critical Pattern)
- [ ] Click "More" → Sheet slides up from bottom
- [ ] Title shows "All Menus"
- [ ] Groups displayed in **Accordion** format
- [ ] All groups **expanded by default**
- [ ] Group headers show: icon + label + count
- [ ] Submenus in **3-column grid** with icons
- [ ] Click item → Navigates and closes menu

### Desktop View (≥ 1024px)
- [ ] Bottom navbar hidden (only visible on mobile)

### State Persistence
- [ ] Refresh page → State maintained
- [ ] Navigate between pages → Active state correct

---

## 🚨 Common Issues & Quick Fixes

### Issue: More Menu Shows Flat List

**Symptom:** More menu displays items in vertical list, not accordion grid
**Cause:** Using old/incorrect BottomNavMoreMenu component

**Fix:**
```bash
# Re-copy the correct component
cp .claude/skills/mobile-bottom-navbar/assets/components/BottomNav/bottom-nav-more-menu.tsx \
   components/BottomNav/
```

**Verify Pattern:**
```typescript
// bottom-nav-more-menu.tsx should have:
<Accordion type="multiple" defaultValue={groups.map(g => g.id)}>
  ...
  <div className="grid grid-cols-3 gap-2">  // ← 3-column grid
    ...
  </div>
</Accordion>
```

### Issue: Submenu Below Navbar

**Symptom:** Submenu appears below navbar instead of above

**Fix:** Check `bottom-navbar.tsx` structure:
```typescript
<nav>
  {/* Submenu INSIDE nav, BEFORE items */}
  <BottomNavSubmenu items={...} isOpen={isExpanded} />

  {/* Nav items below submenu */}
  <div className="flex items-center justify-around">
    ...
  </div>
</nav>
```

### Issue: No Icons in Grid

**Symptom:** Grid items show only text, no icons

**Fix:** Verify types.ts has icon property:
```typescript
// types.ts
export interface FlatMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;  // ← Must have icon
  active?: boolean;
}
```

### Issue: Accordion Groups Collapsed

**Symptom:** Groups in More menu start collapsed

**Fix:**
```typescript
// bottom-nav-more-menu.tsx
<Accordion
  type="multiple"  // ← Allow multiple open
  defaultValue={groups.map(g => g.id)}  // ← All open by default
>
```

---

## 📚 Need More Details?

- **Complete Guide**: `references/complete-implementation.md`
- **Component API**: `references/component-reference.md`
- **Customization**: `references/customization-guide.md`
- **Troubleshooting**: `references/troubleshooting.md`
- **Visual Examples**: `references/screenshots/README.md`
- **Main Documentation**: `skill.md`

---

## 💡 Pro Tips

1. **Always Copy Latest Components**: Use files from `assets/` folder
2. **Check Screenshots First**: Visual reference in `references/screenshots/`
3. **Test on Real Devices**: Chrome DevTools responsive mode may not show all issues
4. **Verify Accordion Pattern**: More menu must use accordion + grid, not flat list
5. **Use Examples**: See `assets/examples/` for working patterns

---

## 🎉 Success Criteria

Your implementation is correct when:

✅ Bottom navbar matches `myjkkn-dashboard.png`
✅ Submenu dropdown matches `myjkkn-submenu-dropdown.png`
✅ **More menu matches `myjkkn-more-menu.png` (accordion + icon grid)**
✅ Navigation works smoothly
✅ State persists across refreshes
✅ All animations are smooth and responsive

---

## 🆘 Still Having Issues?

1. Compare your More menu with `myjkkn-more-menu.png` screenshot
2. Re-copy `bottom-nav-more-menu.tsx` from `assets/` folder
3. Check `references/troubleshooting.md` for solutions
4. Verify all shadcn/ui components installed (sheet, accordion)
5. Test with simplified navigation structure first

---

**Next Step:** Copy the files and test on mobile view! The pattern should work immediately if all files are copied correctly.
