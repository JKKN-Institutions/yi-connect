/**
 * Profile Settings Page
 *
 * Allows users to view and edit their profile information
 */

import { Suspense } from 'react'
import { requireAuth, getUserProfile } from '@/lib/auth'
import { ProfileOverview } from '@/components/settings/profile-overview'
import { ProfileForm } from '@/components/settings/profile-form'
import { AvatarUpload } from '@/components/settings/avatar-upload'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata = {
  title: 'Profile Settings - Yi Connect',
  description: 'Manage your profile information',
}

async function ProfileContent() {
  // Get current user (guaranteed to exist due to requireAuth)
  await requireAuth()

  // Get profile with roles and chapter
  const profile = await getUserProfile()

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left Column - Profile Overview and Avatar Upload */}
      <div className="space-y-6">
        <AvatarUpload profile={profile} />
        <ProfileOverview profile={profile} />
      </div>

      {/* Right Column - Edit Form */}
      <div className="space-y-6">
        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Avatar Upload Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Profile Overview Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Profile Form Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ProfilePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and view your roles
        </p>
      </div>

      {/* Profile Content with Suspense */}
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  )
}
