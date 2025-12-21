/**
 * Mobile Layout
 *
 * Layout for mobile-optimized pages with bottom navigation,
 * PWA components, and safe area handling.
 */

import { unstable_noStore as noStore } from 'next/cache'
import { BottomNav } from '@/components/mobile/bottom-nav'
import { OfflineIndicator } from '@/components/pwa/offline-indicator'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { BugReporterWrapper } from '@/components/bug-reporter-wrapper'
import { getCurrentUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getUserProfileForBugReporter() {
  const user = await getCurrentUser()

  if (!user) return null

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', user.id)
    .single()

  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name
    }
  }

  // Fallback to auth user data
  return {
    id: user.id,
    email: user.email || null,
    full_name: (user.user_metadata?.full_name as string) || null
  }
}

export default async function MobileLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Opt out of static prerendering for authenticated routes
  noStore()

  // Fetch user profile for bug reporter on the server
  const userProfile = await getUserProfileForBugReporter()

  return (
    <BugReporterWrapper userProfile={userProfile}>
      <div className='min-h-screen bg-background'>
        {/* Service Worker Registration */}
        <ServiceWorkerRegister />

        {/* Offline Status Indicator */}
        <OfflineIndicator />

        {/* Main Content */}
        <main className='pb-20'>
          {children}
        </main>

        {/* Bottom Navigation */}
        <BottomNav />

        {/* PWA Install Prompt */}
        <InstallPrompt />

        {/* PWA Update Prompt */}
        <UpdatePrompt />
      </div>
    </BugReporterWrapper>
  )
}
