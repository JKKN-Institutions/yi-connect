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
 */

import { BugReporterProvider } from '@boobalan_jkkn/bug-reporter-sdk'

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

  console.log('[BugReporter] Config check:', {
    hasApiKey: !!apiKey,
    hasApiUrl: !!apiUrl,
    apiKey: apiKey,
    hasUserProfile: !!userProfile,
    userProfile: userProfile
  })

  // If not configured or no user, just render children (no bug reporter)
  if (!apiKey || !apiUrl || apiKey === 'app_your_api_key_here' || !userProfile) {
    console.log('[BugReporter] Not rendering - missing config or user profile')
    return <>{children}</>
  }

  console.log('[BugReporter] Rendering with user:', {
    userId: userProfile.id,
    name: userProfile.full_name || userProfile.email?.split('@')[0] || 'Unknown User'
  })

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
