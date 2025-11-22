/**
 * Mobile Layout
 *
 * Layout for mobile-optimized pages with bottom navigation,
 * PWA components, and safe area handling.
 */

import { BottomNav } from '@/components/mobile/bottom-nav'
import { OfflineIndicator } from '@/components/pwa/offline-indicator'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'

export default function MobileLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
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
  )
}
