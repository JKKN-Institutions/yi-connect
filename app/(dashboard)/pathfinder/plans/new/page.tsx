/**
 * New AAA Plan Page
 *
 * Create a new AAA plan for a vertical.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { getCurrentCalendarYear } from '@/lib/data/aaa'
import { getAAADefaults } from '@/lib/data/aaa-defaults'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AAAPlanForm } from '@/components/pathfinder/aaa-plan-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Create AAA Plan',
  description: 'Create a new AAA plan for your vertical',
}

interface PageProps {
  searchParams: Promise<{ vertical?: string; chapter?: string }>
}

export default async function NewAAAPlanPage({ searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member'])

  const { vertical: verticalId, chapter: chapterIdParam } = await searchParams

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/pathfinder">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create AAA Plan</h1>
        <p className="text-muted-foreground mt-1">
          Plan your vertical's Awareness → Action → Advocacy activities
        </p>
      </div>

      {/* Content */}
      <Suspense fallback={<FormSkeleton />}>
        <NewPlanContent verticalId={verticalId} chapterIdParam={chapterIdParam} />
      </Suspense>
    </div>
  )
}

async function NewPlanContent({
  verticalId,
  chapterIdParam
}: {
  verticalId?: string
  chapterIdParam?: string
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get user roles (same pattern as dashboard-sidebar and requireRole)
  const { data: userRoles } = await supabase.rpc('get_user_roles', {
    p_user_id: user.id
  })
  const roles = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []

  // Admin check - Super Admin or National Admin can create for any chapter
  const isAdmin = roles.includes('Super Admin') || roles.includes('National Admin')

  // Get user's chapter from member record
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, chapter_id')
    .eq('user_id', user.id)
    .single()

  // Determine which chapter to use
  // Admin can use chapter from URL param, regular users use their member chapter
  let chapterId = member?.chapter_id

  if (isAdmin && chapterIdParam) {
    // Admin with chapter param - verify chapter exists
    const { data: chapter } = await supabase
      .from('chapters')
      .select('id')
      .eq('id', chapterIdParam)
      .single()

    if (chapter) {
      chapterId = chapterIdParam
    }
  }

  // If still no chapter and user is admin, show chapter selector
  if (!chapterId && isAdmin) {
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, name, location')
      .eq('status', 'active')
      .order('name')

    if (chapters && chapters.length > 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Select a Chapter</CardTitle>
            <CardDescription>
              As an admin, choose which chapter to create an AAA plan for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((c) => (
                <Link
                  key={c.id}
                  href={`/pathfinder/plans/new?chapter=${c.id}`}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <span className="text-xl">🏛️</span>
                  </div>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            You need to be associated with a chapter to create an AAA plan.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Get verticals for this chapter
  const { data: verticals } = await supabase
    .from('verticals')
    .select('id, name, slug, color, icon')
    .eq('chapter_id', chapterId)
    .eq('is_active', true)
    .order('display_order')

  if (!verticals || verticals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No verticals found for this chapter.
          </p>
        </CardContent>
      </Card>
    )
  }

  // If no vertical selected, show selector
  if (!verticalId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a Vertical</CardTitle>
          <CardDescription>
            Choose the vertical you want to create an AAA plan for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {verticals.map((v) => (
              <Link
                key={v.id}
                href={`/pathfinder/plans/new?vertical=${v.id}${chapterIdParam ? `&chapter=${chapterIdParam}` : ''}`}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${v.color}20` || '#6366f120' }}
                >
                  <span className="text-xl">{v.icon || '📊'}</span>
                </div>
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-muted-foreground">{v.slug}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get selected vertical
  const selectedVertical = verticals.find((v) => v.id === verticalId)
  if (!selectedVertical) {
    notFound()
  }

  // Check if plan already exists for this vertical and year
  const calendarYear = getCurrentCalendarYear()
  const { data: existingPlan } = await supabase
    .from('aaa_plans')
    .select('id')
    .eq('vertical_id', verticalId)
    .eq('calendar_year', calendarYear)
    .single()

  if (existingPlan) {
    redirect(`/pathfinder/plans/${existingPlan.id}`)
  }

  // Get AAA defaults for this vertical (suggestions from Pathfinder 2026)
  const defaults = getAAADefaults(selectedVertical.slug, selectedVertical.name)

  return (
    <AAAPlanForm
      verticalId={verticalId}
      verticalName={selectedVertical.name}
      chapterId={chapterId}
      calendarYear={calendarYear}
      defaults={defaults}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[200px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
