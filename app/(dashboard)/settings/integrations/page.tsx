/**
 * Integrations Settings Page
 *
 * Manage external service integrations like Yi Creative Studio
 */

import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { YiCreativeSettings } from '@/components/settings/yi-creative-settings'
import { IntegrationsWrapper } from '@/components/settings/integrations-wrapper'
import { getChapterYiCreativeConnection } from '@/lib/data/yi-creative-connections'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Integrations - Yi Connect',
  description: 'Manage external service integrations',
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

async function IntegrationsContent() {
  await requireAuth()

  const supabase = await createServerSupabaseClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  // Get user's chapter
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('id', user.id)
    .single()

  // Get user's hierarchy level and check if National Admin
  const [{ data: hierarchyLevel }, { data: isNationalAdminResult }] = await Promise.all([
    supabase.rpc('get_user_hierarchy_level', { p_user_id: user.id }),
    supabase.rpc('is_national_admin'),
  ])

  // Use the same is_national_admin RPC that the client-side context uses
  const isNationalAdmin = !!isNationalAdminResult
  // National Admin can always manage integrations, others need hierarchy level >= 4 (Chair)
  const canManageIntegrations = isNationalAdmin || (hierarchyLevel as number) >= 4

  // For regular users (not National Admin), check direct chapter assignment
  if (!isNationalAdmin && !member?.chapter_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to enhance your chapter's capabilities
          </p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            You need to be assigned to a chapter to manage integrations.
          </p>
        </div>
      </div>
    )
  }

  // For National Admin users without direct chapter_id, use client-side chapter context
  if (isNationalAdmin && !member?.chapter_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to enhance your chapter's capabilities
          </p>
        </div>
        {/* IntegrationsWrapper uses useAdminChapter context to get selected chapter */}
        <IntegrationsWrapper canManage={canManageIntegrations} />
      </div>
    )
  }

  // Regular user or National Admin with direct chapter assignment
  const chapterId = member?.chapter_id as string
  const connection = await getChapterYiCreativeConnection(chapterId)

  if (!canManageIntegrations) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to enhance your chapter's capabilities
          </p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Only Chapter Chair or higher can manage integrations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your chapter's capabilities
        </p>
      </div>
      <YiCreativeSettings
        connection={connection}
        chapterId={chapterId}
        canManage={canManageIntegrations}
      />
    </div>
  )
}

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <IntegrationsContent />
    </Suspense>
  )
}
