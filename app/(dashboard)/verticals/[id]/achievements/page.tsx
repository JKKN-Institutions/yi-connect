/**
 * Vertical Achievements Page
 *
 * List and manage achievements for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Plus, Trophy, Award, Star, Target, Lightbulb } from 'lucide-react'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { getVerticalById, getVerticalAchievements, getCurrentFiscalYear } from '@/lib/data/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_CATEGORY_LABELS } from '@/types/vertical'
import { format } from 'date-fns'

export const metadata = {
  title: 'Vertical Achievements',
  description: 'Manage achievements for this vertical',
}

interface PageProps {
  params: Promise<{ id: string }>
}

// Category icons mapping
const categoryIcons = {
  [ACHIEVEMENT_CATEGORIES.AWARD]: Award,
  [ACHIEVEMENT_CATEGORIES.MILESTONE]: Target,
  [ACHIEVEMENT_CATEGORIES.RECOGNITION]: Star,
  [ACHIEVEMENT_CATEGORIES.IMPACT]: Trophy,
  [ACHIEVEMENT_CATEGORIES.INNOVATION]: Lightbulb,
}

export default async function AchievementsPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <AchievementsHeader params={params} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <AchievementsContent params={params} />
      </Suspense>
    </div>
  )
}

async function AchievementsHeader({ params }: PageProps) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground mt-1">
          Awards and milestones for {vertical.name}
        </p>
      </div>
      <Button asChild>
        <Link href={`/verticals/${id}/achievements/new`}>
          <Plus className="h-4 w-4 mr-2" />
          New Achievement
        </Link>
      </Button>
    </div>
  )
}

async function AchievementsContent({ params }: PageProps) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const vertical = await getVerticalById(id)
  if (!vertical) notFound()

  const fiscalYear = getCurrentFiscalYear()
  const achievements = await getVerticalAchievements(id)

  if (achievements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Achievements Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Record your first achievement to start building your success story
          </p>
          <Button asChild>
            <Link href={`/verticals/${id}/achievements/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Record Achievement
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Group by category
  const achievementsByCategory = achievements.reduce((acc, achievement) => {
    const category = achievement.category || ACHIEVEMENT_CATEGORIES.MILESTONE
    if (!acc[category]) acc[category] = []
    acc[category].push(achievement)
    return acc
  }, {} as Record<string, typeof achievements>)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([category, label]) => {
          const Icon = categoryIcons[category as keyof typeof categoryIcons] || Trophy
          const count = achievementsByCategory[category]?.length || 0
          return (
            <Card key={category}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Achievement List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            FY{fiscalYear} Achievements
          </CardTitle>
          <CardDescription>
            {achievements.length} achievements recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {achievements.map((achievement) => {
              const Icon = categoryIcons[achievement.category as keyof typeof categoryIcons] || Trophy
              return (
                <div
                  key={achievement.id}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{achievement.title}</h4>
                      <Badge variant="secondary">
                        {ACHIEVEMENT_CATEGORY_LABELS[achievement.category as keyof typeof ACHIEVEMENT_CATEGORY_LABELS]}
                      </Badge>
                    </div>
                    {achievement.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {achievement.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{format(new Date(achievement.achievement_date), 'dd MMM yyyy')}</span>
                      {achievement.recognition_type && (
                        <span>{achievement.recognition_type}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/verticals/${id}/achievements/${achievement.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-48 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-40" />
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
