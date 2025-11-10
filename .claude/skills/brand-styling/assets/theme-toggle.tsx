'use client';

/**
 * Theme Toggle Component
 *
 * A button component to toggle between light and dark themes.
 * Includes proper icons and accessibility support.
 *
 * Installation Requirements:
 * npm install next-themes lucide-react
 *
 * Usage:
 * import { ThemeToggle } from '@/components/theme-toggle';
 *
 * function Navigation() {
 *   return (
 *     <nav>
 *       {/* ... other nav items ... *\/}
 *       <ThemeToggle />
 *     </nav>
 *   );
 * }
 */

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-md ${className}`}
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const currentTheme = theme === 'system' ? systemTheme : theme;

  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-block ${className}`}>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="
            appearance-none
            px-4 py-2 pr-8
            bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-600
            rounded-md
            text-gray-900 dark:text-gray-100
            text-sm font-medium
            cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            transition-colors
          "
          aria-label="Select theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    );
  }

  // Icon variant (default)
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`
        p-2 rounded-md
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        dark:focus:ring-offset-gray-900
        ${className}
      `}
      aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {currentTheme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}

/**
 * Theme Toggle with All Options
 *
 * A more advanced toggle that includes light, dark, and system options.
 */
export function ThemeToggleAdvanced({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className={`p-2 rounded-md ${className}`} disabled>
        <div className="w-5 h-5" />
      </button>
    );
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const currentTheme = themes.find((t) => t.value === theme);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center space-x-2
          px-3 py-2 rounded-md
          text-gray-700 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-800
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
          dark:focus:ring-offset-gray-900
        "
        aria-label="Select theme"
      >
        {currentTheme && <currentTheme.icon className="w-5 h-5" />}
        <span className="text-sm font-medium">{currentTheme?.label}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="
            absolute right-0 mt-2 z-20
            w-40
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            overflow-hidden
          ">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                onClick={() => {
                  setTheme(themeOption.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3
                  text-left text-sm
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors
                  ${
                    theme === themeOption.value
                      ? 'text-primary dark:text-primary-light bg-primary/5 dark:bg-primary-light/5'
                      : 'text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                <themeOption.icon className="w-5 h-5" />
                <span className="font-medium">{themeOption.label}</span>
                {theme === themeOption.value && (
                  <span className="ml-auto text-primary dark:text-primary-light">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact Theme Toggle (for mobile)
 */
export function ThemeToggleCompact({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={cycleTheme}
      className={`
        p-2 rounded-full
        bg-gray-100 dark:bg-gray-800
        text-gray-700 dark:text-gray-300
        hover:bg-gray-200 dark:hover:bg-gray-700
        active:scale-95
        transition-all duration-200
        ${className}
      `}
      aria-label="Cycle theme"
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4" />
      ) : theme === 'system' ? (
        <Monitor className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
    </button>
  );
}
