'use client'

/**
 * Bug Reporter Wrapper Component
 *
 * Wraps the dashboard with JKKN Bug Reporter SDK provider.
 * Used ONLY in dashboard layout (protected routes).
 *
 * Features:
 * - Floating bug report button (bottom-right)
 * - Mandatory screenshot capture (v1.1.0+)
 * - Automatic console logs capture (v1.1.0+)
 * - User context tracking from Supabase profiles table
 *
 * Note: User profile is fetched on the server and passed as a prop
 * to avoid client-side authentication hanging issues.
 *
 * Mobile positioning: Bug reporter button is moved up on mobile to avoid
 * conflict with bottom navbar (80px from bottom on mobile, 16px on desktop).
 */

import { BugReporterProvider, MyBugsPanel } from '@boobalan_jkkn/bug-reporter-sdk'
import { useEffect, useState } from 'react'

interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
}

interface BugReporterWrapperProps {
  children: React.ReactNode
  userProfile: UserProfile | null
}

export function BugReporterWrapper({ children, userProfile }: BugReporterWrapperProps) {
  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL

  // If not configured or no user, just render children (no bug reporter)
  if (!apiKey || !apiUrl || apiKey === 'app_your_api_key_here' || !userProfile) {
    return <>{children}</>
  }

  // Adjust bug reporter button position on mobile to avoid bottom navbar conflict
  useEffect(() => {
    const adjustBugReporterPosition = () => {
      const bugButton = document.querySelector('[data-bug-reporter-button]') as HTMLElement;
      if (bugButton) {
        // On mobile (< 1024px), move button up to avoid bottom navbar
        if (window.innerWidth < 1024) {
          bugButton.style.bottom = '80px'; // Above bottom navbar
          bugButton.style.zIndex = '70'; // Below navbar (z-80) and backdrop (z-75)
        } else {
          bugButton.style.bottom = '16px'; // Default desktop position
          bugButton.style.zIndex = '50'; // Default z-index
        }
      }
    };

    // Initial adjustment
    const timer = setTimeout(adjustBugReporterPosition, 100);

    // Re-adjust on window resize
    window.addEventListener('resize', adjustBugReporterPosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', adjustBugReporterPosition);
    };
  }, []);

  return (
    <BugReporterProvider
      apiKey={apiKey}
      apiUrl={apiUrl}
      enabled={true}
      debug={process.env.NODE_ENV === 'development'}
      userContext={{
        userId: userProfile.id,
        name: userProfile.full_name || userProfile.email?.split('@')[0] || 'Unknown User',
        email: userProfile.email || undefined
      }}
    >
      {children}
      <MyBugsDrawer />
    </BugReporterProvider>
  )
}

function MyBugsDrawer() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View my submitted bugs"
        className="fixed bottom-20 right-6 z-[60] flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        My Bugs
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="My submitted bugs"
          className="fixed inset-0 z-[70] flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Submitted Bugs</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
            </div>
            <MyBugsPanel />
          </div>
        </div>
      )}
    </>
  )
}
