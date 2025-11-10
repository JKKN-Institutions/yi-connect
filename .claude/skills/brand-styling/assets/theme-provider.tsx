'use client';

/**
 * Theme Provider Component
 *
 * Wraps the application with next-themes ThemeProvider to enable dark mode support.
 *
 * Installation:
 * npm install next-themes
 *
 * Usage:
 * Import this component in your root layout and wrap your application:
 *
 * import { ThemeProvider } from '@/components/providers/theme-provider';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="en" suppressHydrationWarning>
 *       <body>
 *         <ThemeProvider>
 *           {children}
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Theme Toggle Hook
 *
 * Custom hook to access theme functionality in any component
 *
 * Usage:
 * import { useTheme } from '@/components/providers/theme-provider';
 *
 * function MyComponent() {
 *   const { theme, setTheme, systemTheme } = useTheme();
 *
 *   return (
 *     <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
 *       Toggle Theme
 *     </button>
 *   );
 * }
 */
export { useTheme } from 'next-themes';
