/**
 * Settings Page
 *
 * Main settings page with links to different settings sections
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { User, Bell, Shield, Palette, Key } from 'lucide-react'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Settings - Yi Connect',
  description: 'Manage your account settings',
}

const settingsSections = [
  {
    title: 'Profile',
    description: 'Manage your personal information and profile details',
    icon: User,
    href: '/settings/profile',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    title: 'Notifications',
    description: 'Configure email, SMS, and push notifications',
    icon: Bell,
    href: '/settings/notifications',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    disabled: true,
  },
  {
    title: 'Security',
    description: 'Update password and manage security settings',
    icon: Shield,
    href: '/settings/security',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    disabled: true,
  },
  {
    title: 'Preferences',
    description: 'Customize your experience and appearance',
    icon: Palette,
    href: '/settings/preferences',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    disabled: true,
  },
  {
    title: 'Privacy',
    description: 'Control your data and privacy settings',
    icon: Key,
    href: '/settings/privacy',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    disabled: true,
  },
]

// Content component that performs auth check and redirects
async function SettingsContent() {
  await requireAuth()

  // Redirect to profile settings by default
  redirect('/settings/profile')

  return null // This is never reached due to redirect
}

// Loading skeleton (shown briefly during auth check)
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}

// Unreachable JSX below (kept for reference but never executed)
function UnusedSettingsLayout() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon
          const content = (
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                section.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 ${section.bgColor}`}>
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )

          if (section.disabled) {
            return <div key={section.title}>{content}</div>
          }

          return (
            <Link key={section.title} href={section.href}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
