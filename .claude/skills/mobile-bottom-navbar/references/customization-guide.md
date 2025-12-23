# Customization Guide

This guide covers how to customize the mobile bottom navbar for your brand, preferences, and use cases.

## Table of Contents

1. [Color Scheme and Theming](#color-scheme-and-theming)
2. [Animation Timing](#animation-timing)
3. [Layout Variants](#layout-variants)
4. [Icon Customization](#icon-customization)
5. [Typography and Spacing](#typography-and-spacing)

---

## Color Scheme and Theming

### Using Tailwind CSS Variables

The navbar uses Tailwind CSS color variables for full theme support including dark mode.

#### Step 1: Define Your Colors

In `app/globals.css`:

```css
@layer base {
  :root {
    /* Light mode */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;      /* Main accent color */
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
  }

  .dark {
    /* Dark mode */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
  }
}
```

#### Step 2: Update Tailwind Config

In `tailwind.config.ts`:

```typescript
module.exports = {
  theme: {
    extend: {
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

### Custom Brand Colors Example

For a brand with purple (#7C3AED) as primary:

```css
:root {
  --primary: 262 83% 58%;           /* #7C3AED */
  --primary-foreground: 0 0% 100%;  /* White */
}

.dark {
  --primary: 262 83% 68%;           /* Lighter in dark mode */
  --primary-foreground: 262 50% 10%; /* Dark purple */
}
```

### Applying Colors in Components

The navbar automatically uses these colors:

```typescript
// Active nav item
className="bg-primary/10 text-primary"

// Inactive nav item
className="text-muted-foreground hover:text-foreground"

// Navbar background
className="bg-background border-t border-border"

// Active submenu item
className="bg-primary text-primary-foreground"
```

### Custom Color Overrides

To use specific colors without changing global variables, update the component classes:

```typescript
// In bottom-nav-item.tsx
className={cn(
  'flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-lg',
  isActive
    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
)}
```

### Shadow Customization

Change navbar elevation:

```typescript
// Light shadow
className="shadow-sm"

// Medium shadow (default)
className="shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"

// Heavy shadow
className="shadow-[0_-8px_30px_rgba(0,0,0,0.2)]"

// No shadow
className="border-t border-border"
```

### Gradient Backgrounds

Add gradient to navbar:

```typescript
className="bg-gradient-to-t from-background to-background/80 backdrop-blur-lg"
```

### Glass Morphism Effect

```typescript
className="bg-background/80 backdrop-blur-md border-t border-border/50"
```

---

## Animation Timing

### Spring Animation Configuration

Edit spring config in `bottom-navbar.tsx`:

```typescript
// Fast and snappy (default)
transition={{
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.8
}}

// Slow and smooth
transition={{
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 1.2
}}

// Bouncy
transition={{
  type: 'spring',
  stiffness: 600,
  damping: 20,
  mass: 0.5
}}

// Minimal (for performance)
transition={{
  type: 'spring',
  stiffness: 400,
  damping: 40,
  mass: 1
}}
```

### Tween Animation (Alternative)

Replace spring with tween for more predictable timing:

```typescript
// In bottom-navbar.tsx
animate={{ y: 0, opacity: 1 }}
transition={{
  type: 'tween',
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1]  // Cubic ease
}}
```

### Submenu Slide Animation

Edit in `bottom-nav-submenu.tsx`:

```typescript
// Fast slide (default)
transition={{ duration: 0.2, ease: 'easeInOut' }}

// Slow slide
transition={{ duration: 0.4, ease: 'easeInOut' }}

// Bounce slide
transition={{
  type: 'spring',
  stiffness: 300,
  damping: 20
}}
```

### Backdrop Fade

Edit in `bottom-navbar.tsx`:

```typescript
// Fast fade (default)
transition={{ duration: 0.12, ease: 'easeOut' }}

// Slow fade
transition={{ duration: 0.3, ease: 'easeInOut' }}

// No animation
transition={{ duration: 0 }}
```

### Disable Animations

For reduced motion preferences:

```typescript
import { useReducedMotion } from 'framer-motion';

const prefersReducedMotion = useReducedMotion();

<motion.nav
  animate={{ y: 0, opacity: 1 }}
  transition={prefersReducedMotion ? { duration: 0 } : springConfig}
>
```

Or globally in Tailwind:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Layout Variants

### Number of Primary Navigation Items

#### 3 Items (More Space)

```typescript
// In bottom-navbar.tsx
const primaryNavGroups = useMemo(() => {
  return allNavGroups.slice(0, 3);  // Changed from 4 to 3
}, [allNavGroups]);

const moreNavGroups = useMemo(() => {
  return allNavGroups.slice(3);  // Changed from 4 to 3
}, [allNavGroups]);
```

Update item spacing:

```typescript
// In bottom-navbar.tsx
<div className="flex items-center justify-around px-4">  // Add horizontal padding
```

#### 5 Items (More Dense)

```typescript
const primaryNavGroups = useMemo(() => {
  return allNavGroups.slice(0, 5);
}, [allNavGroups]);

const moreNavGroups = useMemo(() => {
  return allNavGroups.slice(5);
}, [allNavGroups]);
```

Update item size:

```typescript
// In bottom-nav-item.tsx
className="py-1 px-2 text-xs"  // Smaller padding and text
```

### Vertical Navbar Position

#### Top Navbar Instead of Bottom

```typescript
// In bottom-navbar.tsx
className={cn(
  'fixed top-0 left-0 right-0 z-[80]',  // Changed from bottom-0
  'lg:hidden',
  'bg-background border-b border-border',  // Changed from border-t
  'shadow-[0_4px_20px_rgba(0,0,0,0.1)]'  // Positive shadow
)}
```

Update content padding:

```typescript
// In layout
className={cn(
  'min-h-screen',
  isMobile && 'pt-16'  // Top padding instead of bottom
)}
```

#### Side Navbar (Left/Right)

```typescript
// Left side
className={cn(
  'fixed left-0 top-0 bottom-0 z-[80]',
  'w-20',
  'lg:hidden',
  'bg-background border-r border-border'
)}

// Right side
className={cn(
  'fixed right-0 top-0 bottom-0 z-[80]',
  'w-20',
  'lg:hidden',
  'bg-background border-l border-border'
)}
```

Update layout:

```typescript
<div className="flex flex-col">  // Changed to vertical flex
  {primaryNavGroups.map((group) => (
    <BottomNavItem key={group.id} {...group} />
  ))}
</div>
```

### Navbar Height

```typescript
// Compact (default)
className="py-2"

// Comfortable
className="py-4"

// Spacious
className="py-6"
```

Update safe area inset:

```typescript
style={{
  paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)'  // Minimum 0.5rem
}}
```

### Submenu Layout

#### Grid Columns

```typescript
// 2 columns
className="grid grid-cols-2 gap-3"

// 3 columns (default)
className="grid grid-cols-3 gap-2"

// 4 columns
className="grid grid-cols-4 gap-2"

// Responsive
className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
```

#### List Layout Instead of Grid

```typescript
// In bottom-nav-submenu.tsx
<div className="flex flex-col gap-1 p-2">
  {items.map((item) => (
    <button
      key={item.href}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted"
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
    </button>
  ))}
</div>
```

### Floating Navbar

Create a floating pill design:

```typescript
// In bottom-navbar.tsx
<motion.nav
  className={cn(
    'fixed bottom-4 left-4 right-4 z-[80]',  // Inset from edges
    'lg:hidden',
    'bg-background/80 backdrop-blur-lg',
    'border border-border rounded-2xl',  // Rounded corners
    'shadow-2xl'
  )}
>
```

---

## Icon Customization

### Icon Library

The navbar uses Lucide React by default. You can use any icon library:

#### Heroicons

```typescript
import { HomeIcon, UsersIcon } from '@heroicons/react/24/outline';

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Overview': HomeIcon,
  'User Management': UsersIcon,
};
```

#### React Icons

```typescript
import { AiOutlineHome } from 'react-icons/ai';
import { FiUsers } from 'react-icons/fi';

const GROUP_ICONS = {
  'Overview': AiOutlineHome,
  'User Management': FiUsers,
};
```

### Custom SVG Icons

```typescript
const CustomIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const GROUP_ICONS = {
  'Custom': CustomIcon,
};
```

### Icon Size

```typescript
// In bottom-nav-item.tsx

// Small
<Icon className="h-4 w-4" />

// Medium (default)
<Icon className="h-5 w-5" />

// Large
<Icon className="h-6 w-6" />

// Extra large
<Icon className="h-8 w-8" />
```

### Icon Stroke Width

```typescript
// Thin
<Icon className="h-5 w-5" strokeWidth={1.5} />

// Medium (default)
<Icon className="h-5 w-5" strokeWidth={2} />

// Bold
<Icon className="h-5 w-5" strokeWidth={2.5} />
```

### Filled Icons

```typescript
// In bottom-nav-item.tsx
<Icon
  className={cn(
    'h-5 w-5 transition-all',
    isActive ? 'fill-current' : 'fill-none'
  )}
/>
```

---

## Typography and Spacing

### Font Family

```typescript
// In tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      display: ['Poppins', 'sans-serif'],
    }
  }
}

// In bottom-nav-item.tsx
className="font-sans"  // or font-display
```

### Font Size

```typescript
// Extra small
className="text-[10px]"

// Small (default)
className="text-xs"

// Medium
className="text-sm"

// Large
className="text-base"
```

### Font Weight

```typescript
// Light
className="font-light"

// Normal (default)
className="font-normal"

// Medium
className="font-medium"

// Semibold
className="font-semibold"

// Bold
className="font-bold"
```

### Letter Spacing

```typescript
// Tight
className="tracking-tight"

// Normal (default)
className="tracking-normal"

// Wide
className="tracking-wide"
```

### Nav Item Spacing

```typescript
// In bottom-navbar.tsx

// Tight
className="flex items-center justify-around gap-0"

// Normal (default)
className="flex items-center justify-around"

// Loose
className="flex items-center justify-around gap-4 px-4"
```

### Submenu Item Spacing

```typescript
// In bottom-nav-submenu.tsx

// Compact
className="grid grid-cols-3 gap-1 p-2"

// Normal (default)
className="grid grid-cols-3 gap-2 p-4"

// Spacious
className="grid grid-cols-3 gap-4 p-6"
```

---

## Advanced Customizations

### Badge Styles

Customize the "More" button badge:

```typescript
// In bottom-nav-item.tsx
{badgeCount && (
  <span className={cn(
    'absolute -top-1 -right-1',
    'flex items-center justify-center',
    'min-w-[18px] h-[18px] px-1',
    'bg-red-500 text-white',  // Custom color
    'rounded-full text-[10px] font-bold'
  )}>
    {badgeCount}
  </span>
)}
```

### Active Indicator

Add custom active indicator:

```typescript
// In bottom-nav-item.tsx
{isActive && (
  <motion.div
    layoutId="activeIndicator"
    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
  />
)}
```

### Hover Effects

```typescript
// Subtle hover
className="hover:bg-muted/50 transition-colors"

// Prominent hover
className="hover:bg-primary/10 hover:scale-105 transition-all"

// No hover (touch-only)
className="active:bg-muted"  // Only on touch
```

### Blur Effect

```typescript
// Frosted glass effect
className="bg-background/70 backdrop-blur-xl"

// Subtle blur
className="bg-background/95 backdrop-blur-sm"

// No blur
className="bg-background"
```

### Border Radius

```typescript
// Sharp (no radius)
className="rounded-none"

// Subtle
className="rounded-md"

// Moderate (default)
className="rounded-xl"

// Pill-shaped
className="rounded-full"
```

---

## Responsive Breakpoints

### Custom Mobile Breakpoint

Change when navbar appears:

```typescript
// In use-mobile.ts
const MOBILE_BREAKPOINT = 768;  // md breakpoint (default 1024)

// In components
className="md:hidden"  // Hide on medium screens and up
```

### Tablet-Specific Behavior

```typescript
// Show on mobile and tablet, hide on desktop
className="xl:hidden"  // Only hide on xl screens (1280px+)

// Different layouts for different sizes
className={cn(
  'fixed bottom-0',
  'sm:bottom-4 sm:left-4 sm:right-4 sm:rounded-2xl',  // Floating on tablet
  'lg:hidden'  // Hidden on desktop
)}
```

---

## Examples

### Example 1: Purple Theme with Heavy Shadows

```typescript
// colors
--primary: 262 83% 58%;  /* Purple */

// component
className={cn(
  'bg-background border-t border-border',
  'shadow-[0_-8px_40px_rgba(124,58,237,0.3)]'  // Purple shadow
)}
```

### Example 2: Compact 5-Item Navbar

```typescript
const primaryNavGroups = allNavGroups.slice(0, 5);

// bottom-nav-item.tsx
className="py-1 px-1 text-[10px]"
<Icon className="h-4 w-4" />
```

### Example 3: Floating Pill with Blur

```typescript
<motion.nav
  className={cn(
    'fixed bottom-6 left-6 right-6 z-[80]',
    'bg-background/60 backdrop-blur-2xl',
    'border border-border/50 rounded-full',
    'shadow-2xl shadow-black/10',
    'py-3 px-4'
  )}
>
```

### Example 4: Gradient Background

```typescript
<motion.nav
  className={cn(
    'fixed bottom-0 left-0 right-0 z-[80]',
    'bg-gradient-to-t from-purple-900 via-purple-800 to-transparent',
    'border-t border-purple-700/50',
    'shadow-[0_-8px_30px_rgba(124,58,237,0.4)]'
  )}
>
```

---

## Testing Your Customizations

1. **Visual Test**: Check appearance in light and dark modes
2. **Responsive Test**: Verify on mobile, tablet, and desktop
3. **Animation Test**: Ensure animations feel smooth
4. **Accessibility Test**: Check color contrast ratios (WCAG AA minimum)
5. **Performance Test**: Verify no layout shift or janky animations

### Color Contrast Tool

Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

Minimum requirements:
- **Normal text**: 4.5:1 contrast ratio
- **Large text**: 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio

---

## Saving and Sharing Customizations

### Create a Theme File

```typescript
// lib/theme/bottom-nav-theme.ts
export const bottomNavTheme = {
  colors: {
    active: 'bg-primary/10 text-primary',
    inactive: 'text-muted-foreground',
    background: 'bg-background border-t border-border',
  },
  animations: {
    spring: {
      stiffness: 500,
      damping: 35,
      mass: 0.8,
    },
  },
  layout: {
    primaryItemCount: 4,
    gridColumns: 3,
    navbarHeight: 'py-2',
  },
};
```

Then import and use in components:

```typescript
import { bottomNavTheme } from '@/lib/theme/bottom-nav-theme';

className={bottomNavTheme.colors.active}
transition={bottomNavTheme.animations.spring}
```
