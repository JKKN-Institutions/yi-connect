/**
 * New Health Card Entry Page
 *
 * Form to submit a new health card activity entry.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { requireRole, getCurrentChapterId, getUserProfile } from '@/lib/auth'
import { getChapterById, getVerticalsForForm } from '@/lib/data/health-card'
import { Button } from '@/components/ui/button'
import { HealthCardForm } from '@/components/pathfinder/health-card-form'
import type { SubmitterRole } from '@/types/health-card'

export const metadata = {
  title: 'Log Activity',
  description: 'Submit a new health card activity entry',
}

export default async function NewHealthCardPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Vertical Head', 'Executive Member'])

  const chapterId = await getCurrentChapterId()

  if (!chapterId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Chapter Found</h2>
          <p className="text-muted-foreground">
            You need to be associated with a chapter to submit health card entries.
          </p>
        </div>
      </div>
    )
  }

  const [chapter, verticals, profile] = await Promise.all([
    getChapterById(chapterId),
    getVerticalsForForm(),
    getUserProfile(),
  ])

  if (!chapter) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Chapter Not Found</h2>
          <p className="text-muted-foreground">Unable to load chapter information.</p>
        </div>
      </div>
    )
  }

  // Determine default role based on user's actual role
  const userRoles = profile?.roles?.map((r: { role_name: string }) => r.role_name) || []
  let defaultRole: SubmitterRole = 'member'
  if (userRoles.includes('Chair')) defaultRole = 'chair'
  else if (userRoles.includes('Co-Chair')) defaultRole = 'co_chair'
  else if (userRoles.includes('Vertical Head')) defaultRole = 'vertical_head'
  else if (userRoles.includes('Executive Member')) defaultRole = 'chapter_em'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pathfinder/health-card">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log Activity</h1>
          <p className="text-muted-foreground">
            Submit a new health card entry for {chapter.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <HealthCardForm
        chapterId={chapterId}
        chapterName={chapter.name}
        verticals={verticals}
        defaultEmail={profile?.email || ''}
        defaultName={profile?.full_name || ''}
        defaultRole={defaultRole}
      />
    </div>
  )
}
