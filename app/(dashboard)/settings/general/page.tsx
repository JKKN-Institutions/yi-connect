/**
 * General Settings Page
 *
 * Allows users to manage general application preferences
 * including theme, notifications, and display settings
 */

import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GeneralSettingsForm } from '@/components/settings/general-settings-form'

export const metadata = {
  title: 'General Settings - Yi Connect',
  description: 'Manage your general application preferences',
}

async function GeneralSettingsContent() {
  // Ensure user is authenticated
  await requireAuth()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left Column - Appearance & Display */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how Yi Connect looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm section="appearance" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language & Region</CardTitle>
            <CardDescription>
              Set your preferred language and regional settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm section="language" />
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Notifications & Privacy */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm section="notifications" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data & Privacy</CardTitle>
            <CardDescription>
              Manage your data and privacy preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm section="privacy" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function GeneralSettingsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Appearance Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Language Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Notifications Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Privacy Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and customize your experience
        </p>
      </div>

      {/* Settings Content with Suspense */}
      <Suspense fallback={<GeneralSettingsSkeleton />}>
        <GeneralSettingsContent />
      </Suspense>
    </div>
  )
}
