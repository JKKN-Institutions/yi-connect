# Dark Mode Implementation Patterns

## Table of Contents
1. [Setup & Configuration](#setup--configuration)
2. [Color Translation Patterns](#color-translation-patterns)
3. [Component Patterns](#component-patterns)
4. [Advanced Techniques](#advanced-techniques)
5. [Testing & Quality Assurance](#testing--quality-assurance)

---

## Setup & Configuration

### Installing next-themes

```bash
npm install next-themes
# or
yarn add next-themes
```

### Theme Provider Setup

In your main layout file (e.g., `app/layout.tsx`):

```tsx
import { ThemeProvider } from '@/components/providers/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Important:** The `suppressHydrationWarning` prop on `<html>` prevents hydration warnings from theme initialization.

### Tailwind Configuration

Ensure dark mode is enabled in `tailwind.config.js`:

```js
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  // ... rest of config
}
```

---

## Color Translation Patterns

### Text Colors

```tsx
// Primary text
<p className="text-gray-900 dark:text-gray-50">
  Main content text
</p>

// Secondary text
<p className="text-gray-600 dark:text-gray-400">
  Supporting text, metadata
</p>

// Tertiary text
<p className="text-gray-500 dark:text-gray-500">
  Placeholders, disabled text
</p>

// Muted text
<p className="text-gray-400 dark:text-gray-600">
  Very subtle text
</p>
```

### Background Colors

```tsx
// Page background
<div className="bg-background dark:bg-gray-900">

// Card/surface background
<div className="bg-white dark:bg-gray-800">

// Elevated surface
<div className="bg-gray-50 dark:bg-gray-700">

// Hover state backgrounds
<div className="hover:bg-gray-100 dark:hover:bg-gray-700">

// Active state backgrounds
<div className="bg-gray-200 dark:bg-gray-600">
```

### Border Colors

```tsx
// Default border
<div className="border border-gray-200 dark:border-gray-700">

// Subtle border
<div className="border border-gray-100 dark:border-gray-800">

// Prominent border
<div className="border border-gray-300 dark:border-gray-600">

// Accent border
<div className="border-l-4 border-primary dark:border-primary-light">
```

### Brand Colors in Dark Mode

```tsx
// Primary button (maintains brand color)
<button className="
  bg-primary hover:bg-primary-dark
  text-white
  dark:bg-primary-light dark:hover:bg-primary
">
  Primary Action
</button>

// Primary text link
<a className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary">
  Learn more
</a>

// Primary background accent
<div className="bg-primary/10 dark:bg-primary-light/10">
  Subtle primary background
</div>

// Secondary accents
<div className="bg-secondary text-gray-900 dark:bg-secondary-dark dark:text-white">
  Secondary element
</div>
```

### Semantic Colors

```tsx
// Success
<div className="
  text-green-700 bg-green-50
  dark:text-green-400 dark:bg-green-900/20
">
  Success message
</div>

// Error
<div className="
  text-red-700 bg-red-50
  dark:text-red-400 dark:bg-red-900/20
">
  Error message
</div>

// Warning
<div className="
  text-yellow-700 bg-yellow-50
  dark:text-yellow-400 dark:bg-yellow-900/20
">
  Warning message
</div>

// Info
<div className="
  text-blue-700 bg-blue-50
  dark:text-blue-400 dark:bg-blue-900/20
">
  Info message
</div>
```

---

## Component Patterns

### Navigation Bar

```tsx
<nav className="
  bg-white dark:bg-gray-900
  border-b border-gray-200 dark:border-gray-800
  sticky top-0 z-50
  backdrop-blur-sm bg-white/90 dark:bg-gray-900/90
">
  <div className="container mx-auto px-4">
    <div className="flex items-center justify-between h-16">
      {/* Logo */}
      <div className="text-primary dark:text-primary-light font-bold text-xl">
        Logo
      </div>

      {/* Navigation Links */}
      <div className="flex space-x-4">
        <a className="
          text-gray-700 hover:text-primary
          dark:text-gray-300 dark:hover:text-primary-light
          px-3 py-2 rounded-md
          transition-colors
        ">
          Link
        </a>
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />
    </div>
  </div>
</nav>
```

### Theme Toggle Button

```tsx
'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-md" aria-label="Toggle theme">
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="
        p-2 rounded-md
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors
      "
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
```

### Card Component

```tsx
<div className="
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-lg shadow-sm
  p-6
  hover:shadow-md dark:hover:shadow-gray-900/30
  transition-shadow duration-200
">
  {/* Card Header */}
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
      Card Title
    </h3>
    <span className="
      text-sm text-gray-500 dark:text-gray-400
    ">
      Metadata
    </span>
  </div>

  {/* Card Body */}
  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
    Card content with comfortable reading experience in both themes.
  </p>

  {/* Card Footer */}
  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
    <button className="
      text-primary hover:text-primary-dark
      dark:text-primary-light dark:hover:text-primary
      font-medium text-sm
    ">
      Action
    </button>
  </div>
</div>
```

### Modal/Dialog

```tsx
<div className="
  fixed inset-0 z-50
  flex items-center justify-center
  bg-black/50 dark:bg-black/70
  backdrop-blur-sm
">
  <div className="
    bg-white dark:bg-gray-800
    border border-gray-200 dark:border-gray-700
    rounded-xl shadow-xl
    max-w-md w-full mx-4
    p-6
  ">
    {/* Modal Header */}
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        Modal Title
      </h2>
      <button className="
        text-gray-500 hover:text-gray-700
        dark:text-gray-400 dark:hover:text-gray-200
        transition-colors
      ">
        <X className="w-6 h-6" />
      </button>
    </div>

    {/* Modal Content */}
    <div className="text-gray-600 dark:text-gray-400 mb-6">
      Modal content goes here
    </div>

    {/* Modal Actions */}
    <div className="flex justify-end space-x-3">
      <button className="
        px-4 py-2 rounded-md
        text-gray-700 dark:text-gray-300
        border border-gray-300 dark:border-gray-600
        hover:bg-gray-50 dark:hover:bg-gray-700
      ">
        Cancel
      </button>
      <button className="
        px-4 py-2 rounded-md
        bg-primary hover:bg-primary-dark
        text-white
        dark:bg-primary-light dark:hover:bg-primary
      ">
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Form Elements

```tsx
<form className="space-y-6">
  {/* Input Field */}
  <div>
    <label className="
      block text-sm font-medium mb-2
      text-gray-700 dark:text-gray-300
    ">
      Label
    </label>
    <input
      type="text"
      className="
        w-full px-4 py-2 rounded-md
        bg-white dark:bg-gray-900
        border border-gray-300 dark:border-gray-600
        text-gray-900 dark:text-gray-100
        placeholder-gray-400 dark:placeholder-gray-500
        focus:outline-none focus:ring-2 focus:ring-primary
        dark:focus:ring-primary-light
        focus:border-transparent
      "
      placeholder="Enter text..."
    />
  </div>

  {/* Select Dropdown */}
  <div>
    <label className="
      block text-sm font-medium mb-2
      text-gray-700 dark:text-gray-300
    ">
      Select Option
    </label>
    <select className="
      w-full px-4 py-2 rounded-md
      bg-white dark:bg-gray-900
      border border-gray-300 dark:border-gray-600
      text-gray-900 dark:text-gray-100
      focus:outline-none focus:ring-2 focus:ring-primary
      dark:focus:ring-primary-light
    ">
      <option>Option 1</option>
      <option>Option 2</option>
    </select>
  </div>

  {/* Checkbox */}
  <label className="
    flex items-center space-x-2 cursor-pointer
    text-gray-700 dark:text-gray-300
  ">
    <input
      type="checkbox"
      className="
        w-5 h-5 rounded
        border-gray-300 dark:border-gray-600
        bg-white dark:bg-gray-900
        text-primary dark:text-primary-light
        focus:ring-2 focus:ring-primary dark:focus:ring-primary-light
      "
    />
    <span>Checkbox label</span>
  </label>

  {/* Submit Button */}
  <button
    type="submit"
    className="
      w-full py-3 rounded-md
      bg-primary hover:bg-primary-dark
      text-white font-medium
      dark:bg-primary-light dark:hover:bg-primary
      transition-colors
    "
  >
    Submit
  </button>
</form>
```

### Data Table

```tsx
<div className="
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-lg overflow-hidden
">
  <table className="w-full">
    <thead className="
      bg-gray-50 dark:bg-gray-900
      border-b border-gray-200 dark:border-gray-700
    ">
      <tr>
        <th className="
          px-6 py-3 text-left text-sm font-semibold
          text-gray-700 dark:text-gray-300
        ">
          Column 1
        </th>
        <th className="
          px-6 py-3 text-left text-sm font-semibold
          text-gray-700 dark:text-gray-300
        ">
          Column 2
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      <tr className="
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        transition-colors
      ">
        <td className="
          px-6 py-4 text-sm
          text-gray-900 dark:text-gray-100
        ">
          Data 1
        </td>
        <td className="
          px-6 py-4 text-sm
          text-gray-600 dark:text-gray-400
        ">
          Data 2
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Sidebar Navigation

```tsx
<aside className="
  w-64 h-screen
  bg-white dark:bg-gray-900
  border-r border-gray-200 dark:border-gray-800
  fixed left-0 top-0
">
  <div className="p-6">
    <h2 className="
      text-lg font-semibold
      text-gray-900 dark:text-gray-50
      mb-4
    ">
      Navigation
    </h2>

    <nav className="space-y-2">
      {/* Active Link */}
      <a className="
        flex items-center space-x-3 px-4 py-3 rounded-lg
        bg-primary/10 dark:bg-primary-light/10
        text-primary dark:text-primary-light
        font-medium
      ">
        <Home className="w-5 h-5" />
        <span>Dashboard</span>
      </a>

      {/* Inactive Link */}
      <a className="
        flex items-center space-x-3 px-4 py-3 rounded-lg
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors
      ">
        <Settings className="w-5 h-5" />
        <span>Settings</span>
      </a>
    </nav>
  </div>
</aside>
```

### Toast Notifications

```tsx
// Success Toast
<div className="
  flex items-center space-x-3 p-4 rounded-lg
  bg-green-50 dark:bg-green-900/20
  border border-green-200 dark:border-green-800
  text-green-800 dark:text-green-400
  shadow-lg
">
  <CheckCircle className="w-5 h-5" />
  <p className="font-medium">Success! Action completed.</p>
</div>

// Error Toast
<div className="
  flex items-center space-x-3 p-4 rounded-lg
  bg-red-50 dark:bg-red-900/20
  border border-red-200 dark:border-red-800
  text-red-800 dark:text-red-400
  shadow-lg
">
  <XCircle className="w-5 h-5" />
  <p className="font-medium">Error! Something went wrong.</p>
</div>
```

---

## Advanced Techniques

### Using CSS Variables

Define CSS variables in `globals.css`:

```css
:root {
  --color-primary: 11 109 65;
  --color-secondary: 255 222 89;
  --color-background: 251 251 238;
  --color-surface: 255 255 255;
  --color-text-primary: 23 23 23;
  --color-text-secondary: 82 82 82;
}

.dark {
  --color-background: 26 26 26;
  --color-surface: 38 38 38;
  --color-text-primary: 250 250 250;
  --color-text-secondary: 163 163 163;
}
```

Use in components:

```tsx
<div className="bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))]">
  Content
</div>
```

### Conditional Rendering Based on Theme

```tsx
'use client';

import { useTheme } from 'next-themes';

export function ThemedComponent() {
  const { theme } = useTheme();

  if (theme === 'dark') {
    return <DarkLogo />;
  }

  return <LightLogo />;
}
```

### System Theme Detection

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function SystemThemeIndicator() {
  const { systemTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isUsingSystem = theme === 'system';
  const effectiveTheme = isUsingSystem ? systemTheme : theme;

  return (
    <div>
      {isUsingSystem && <p>Using system theme: {effectiveTheme}</p>}
    </div>
  );
}
```

### Animated Theme Transitions

```tsx
// Enable smooth transitions when theme changes
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange={false} // Enable transitions
>
  {children}
</ThemeProvider>
```

Add transition classes:

```tsx
<div className="transition-colors duration-200">
  Content with smooth theme transitions
</div>
```

### Images in Dark Mode

```tsx
// Show different images based on theme
<picture>
  <source
    srcSet="/images/hero-dark.png"
    media="(prefers-color-scheme: dark)"
  />
  <img src="/images/hero-light.png" alt="Hero" />
</picture>

// Or adjust image opacity in dark mode
<img
  src="/images/hero.png"
  className="dark:opacity-80"
  alt="Hero"
/>
```

### SVG Icons in Dark Mode

```tsx
// Method 1: Use currentColor
<svg className="w-6 h-6 text-gray-900 dark:text-gray-50">
  <path fill="currentColor" d="..." />
</svg>

// Method 2: Icon library with theme support
import { Home } from 'lucide-react';

<Home className="w-6 h-6 text-gray-900 dark:text-gray-50" />
```

### Gradients in Dark Mode

```tsx
<div className="
  bg-gradient-to-r
  from-primary to-primary-dark
  dark:from-primary-light dark:to-primary
  text-white
  p-8 rounded-lg
">
  Gradient background
</div>
```

### Shadows in Dark Mode

```tsx
// Lighter shadows in dark mode
<div className="
  shadow-lg dark:shadow-gray-900/50
">

// Colored shadows
<div className="
  shadow-primary/20 dark:shadow-primary-light/20
">

// No shadow in dark mode
<div className="
  shadow-md dark:shadow-none
">
```

---

## Testing & Quality Assurance

### Dark Mode Checklist

Before deploying:

- [ ] All text is readable in both themes
- [ ] All borders are visible in both themes
- [ ] No white flashes on page load (use `suppressHydrationWarning`)
- [ ] Icons and images display correctly in both themes
- [ ] Form inputs have proper contrast in both themes
- [ ] Hover and focus states work in both themes
- [ ] Shadows and elevations are appropriate in both themes
- [ ] Brand colors maintain visibility in dark mode
- [ ] All interactive elements have sufficient contrast
- [ ] Theme toggle button works correctly
- [ ] Theme preference persists across sessions
- [ ] System theme detection works properly

### Testing Tools

#### Browser DevTools
```js
// Toggle theme manually in console
document.documentElement.classList.toggle('dark');

// Check system preference
window.matchMedia('(prefers-color-scheme: dark)').matches;
```

#### Contrast Checker
Use online tools to verify contrast ratios:
- WebAIM Contrast Checker
- Coolors Contrast Checker
- Chrome DevTools Lighthouse

### Common Issues & Solutions

#### Issue: White flash on page load
**Solution:** Add `suppressHydrationWarning` to `<html>` tag

```tsx
<html suppressHydrationWarning>
```

#### Issue: Theme toggle not working
**Solution:** Ensure ThemeProvider wraps entire app and verify `darkMode: 'class'` in Tailwind config

#### Issue: Inconsistent colors across components
**Solution:** Use CSS variables or Tailwind color classes consistently, avoid hardcoded colors

#### Issue: Images too bright in dark mode
**Solution:** Apply opacity or brightness filters

```tsx
<img className="dark:opacity-80 dark:brightness-90" />
```

#### Issue: Shadows disappearing in dark mode
**Solution:** Use appropriate shadow colors

```tsx
<div className="shadow-lg dark:shadow-gray-900/50">
```

### Debugging Dark Mode

```tsx
'use client';

import { useTheme } from 'next-themes';

export function ThemeDebugger() {
  const { theme, systemTheme, resolvedTheme } = useTheme();

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-xs">
      <p>Theme: {theme}</p>
      <p>System: {systemTheme}</p>
      <p>Resolved: {resolvedTheme}</p>
    </div>
  );
}
```

---

## Best Practices Summary

1. **Always test both themes** - Build components with dark mode in mind from the start
2. **Use Tailwind dark: variant** - Leverage built-in dark mode utilities
3. **Maintain contrast** - Ensure WCAG AA compliance in both themes
4. **Be consistent** - Use the same color translation patterns across all components
5. **Provide theme toggle** - Make it easy for users to switch themes
6. **Respect system preference** - Default to system theme when possible
7. **Avoid theme-specific logic** - Use CSS classes instead of conditional rendering when possible
8. **Test loading states** - Ensure no theme flashing on initial load
9. **Use semantic colors** - Success, error, warning should have appropriate dark variants
10. **Performance** - Minimize theme-related re-renders with proper memoization

---

**Last Updated:** 2025-01-16
**Version:** 1.0.0
