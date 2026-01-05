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

import { BugReporterProvider } from '@boobalan_jkkn/bug-reporter-sdk'
import { useEffect } from 'react'

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
    </BugReporterProvider>
  )
}
