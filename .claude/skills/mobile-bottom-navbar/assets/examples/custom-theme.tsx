// Example: Custom Theme Configuration
// Demonstrates how to customize colors, animations, and layout

export const customBottomNavTheme = {
  // Color configuration
  colors: {
    // Active nav item
    active: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
    // Inactive nav item
    inactive: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
    // Navbar background
    background: 'bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800',
    // Submenu active item
    submenuActive: 'bg-purple-600 text-white',
    // Submenu inactive item
    submenuInactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
    // Backdrop
    backdrop: 'bg-black/40 backdrop-blur-sm',
  },

  // Animation configuration
  animations: {
    // Spring animation for navbar
    spring: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 35,
      mass: 0.8,
    },
    // Fade animation for backdrop
    fade: {
      type: 'tween' as const,
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    // Submenu slide
    slide: {
      duration: 0.2,
      ease: 'easeInOut' as const,
    },
  },

  // Layout configuration
  layout: {
    // Number of primary nav items (rest go in "More")
    primaryItemCount: 4,
    // Submenu grid columns
    submenuColumns: 'grid-cols-3 md:grid-cols-4',
    // Navbar height
    navbarHeight: 'py-2',
    // Nav item spacing
    itemSpacing: 'gap-1',
    // Icon size
    iconSize: 'h-5 w-5',
    // Font size
    fontSize: 'text-xs',
  },

  // Shadow configuration
  shadows: {
    // Navbar shadow
    navbar: 'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]',
    // Floating pill (if using minimized state)
    pill: 'shadow-xl shadow-black/15 dark:shadow-black/30',
  },

  // Border radius
  borderRadius: {
    navbar: 'rounded-none',  // Sharp edges
    item: 'rounded-lg',
    submenuItem: 'rounded-xl',
    pill: 'rounded-2xl',
  },
};

// Apply theme to components:

// In bottom-navbar.tsx:
// className={cn(
//   'fixed bottom-0 left-0 right-0 z-[80]',
//   'lg:hidden',
//   customBottomNavTheme.colors.background,
//   customBottomNavTheme.shadows.navbar,
//   customBottomNavTheme.borderRadius.navbar,
//   customBottomNavTheme.layout.navbarHeight
// )}

// In bottom-nav-item.tsx:
// className={cn(
//   'flex flex-col items-center justify-center',
//   customBottomNavTheme.layout.itemSpacing,
//   customBottomNavTheme.layout.fontSize,
//   isActive
//     ? customBottomNavTheme.colors.active
//     : customBottomNavTheme.colors.inactive,
//   customBottomNavTheme.borderRadius.item
// )}
// <Icon className={customBottomNavTheme.layout.iconSize} />

// Use animation configs:
// transition={customBottomNavTheme.animations.spring}

// ===================================================
// Alternative: Purple Gradient Theme
// ===================================================

export const purpleGradientTheme = {
  colors: {
    active: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
    inactive: 'text-gray-600 hover:text-purple-600',
    background: 'bg-gradient-to-t from-purple-900 via-purple-800 to-transparent border-t border-purple-700/50',
    submenuActive: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
    submenuInactive: 'bg-purple-100 text-purple-900 hover:bg-purple-200',
    backdrop: 'bg-purple-900/40 backdrop-blur-md',
  },
  shadows: {
    navbar: 'shadow-[0_-8px_30px_rgba(124,58,237,0.4)]',
    pill: 'shadow-2xl shadow-purple-500/30',
  },
  // ... rest of config
};

// ===================================================
// Alternative: Glass Morphism Theme
// ===================================================

export const glassMorphismTheme = {
  colors: {
    active: 'bg-white/20 text-white backdrop-blur-xl',
    inactive: 'text-white/70 hover:text-white',
    background: 'bg-white/10 backdrop-blur-2xl border-t border-white/20',
    submenuActive: 'bg-white/30 text-white',
    submenuInactive: 'bg-white/10 text-white/80 hover:bg-white/20',
    backdrop: 'bg-black/20 backdrop-blur-sm',
  },
  shadows: {
    navbar: 'shadow-[0_-8px_40px_rgba(0,0,0,0.1)]',
    pill: 'shadow-2xl shadow-black/20',
  },
  borderRadius: {
    navbar: 'rounded-t-3xl',
    item: 'rounded-full',
    submenuItem: 'rounded-2xl',
    pill: 'rounded-full',
  },
  // ... rest of config
};

// ===================================================
// How to Switch Themes
// ===================================================

// 1. Import your theme
// import { customBottomNavTheme } from '@/assets/examples/custom-theme';

// 2. Use throughout components
// const theme = customBottomNavTheme;  // or purpleGradientTheme or glassMorphismTheme

// 3. Apply to className and transition props
// className={theme.colors.background}
// transition={theme.animations.spring}
