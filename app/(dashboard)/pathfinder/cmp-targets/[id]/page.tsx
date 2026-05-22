/**
 * CMP Target Detail/Edit Page
 *
 * View and edit an existing CMP target.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Target, Trash2, Calendar, Users, TrendingUp } from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getCMPTargetById, getVerticalsForCMPTargets, hasTargetsForYear } from '@/lib/data/cmp-targets'
import { deleteCMPTargetAction } from '@/app/actions/cmp-targets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CMPTargetEditForm } from '@/components/pathfinder/cmp-target-edit-form'
import { formatCalendarYear, CALENDAR_YEAR_OPTIONS } from '@/types/cmp-targets'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const target = await getCMPTargetById(id)
  return {
    title: target
      ? `Edit ${target.vertical?.name || 'CMP'} Target - Pathfinder`
      : 'CMP Target',
    description: 'Edit CMP target settings',
  }
}

export default async function CMPTargetDetailPage({ params }: PageProps) {
  const { user, roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
  ])

  const { id } = await params

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <TargetHeader targetId={id} roles={roles || []} />
      </Suspense>

      {/* Edit Form */}
      <Suspense fallback={<FormSkeleton />}>
        <TargetEditContent targetId={id} />
      </Suspense>
    </div>
  )
}

async function TargetHeader({
  targetId,
  roles,
}: {
  targetId: string
  roles: string[]
}) {
  const target = await getCMPTargetById(targetId)

  if (!target) {
    notFound()
  }

  const canDelete =
    roles.includes('Super Admin') || roles.includes('National Admin')

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pathfinder/cmp-targets">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {target.vertical?.name || 'CMP Target'}
            </h1>
            {target.is_national_target && (
              <Badge variant="outline">National</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {formatCalendarYear(target.calendar_year)} Target
          </p>
        </div>
      </div>

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Target</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this CMP target for{' '}
                {target.vertical?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form
                action={async () => {
                  'use server'
                  await deleteCMPTargetAction(targetId)
                  redirect('/pathfinder/cmp-targets')
                }}
              >
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

async function TargetEditContent({ targetId }: { targetId: string }) {
  const target = await getCMPTargetById(targetId)

  if (!target) {
    notFound()
  }

  // Get verticals for display
  const verticals = await getVerticalsForCMPTargets()
  const currentVertical = verticals.find((v) => v.id === target.vertical_id)

  return (
    <div className="space-y-6">
      {/* Current Values Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Current Targets
            </CardTitle>
            <div
              className="w-4 h-4 rounded-full"
              style={{
                backgroundColor: target.vertical?.color || '#6b7280',
              }}
            />
          </div>
          <CardDescription>
            Minimum requirements for {formatCalendarYear(target.calendar_year)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-primary">
                {target.min_activities}
              </div>
              <p className="text-sm text-muted-foreground">Activities</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{target.min_participants}</div>
              <p className="text-sm text-muted-foreground">Participants</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">
                {target.min_ec_participation}
              </div>
              <p className="text-sm text-muted-foreground">EC Members</p>
            </div>
          </div>

          {/* AAA Breakdown */}
          {(target.min_awareness_activities !== null ||
            target.min_action_activities !== null ||
            target.min_advocacy_activities !== null) && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  AAA Breakdown
                </p>
                <div className="flex gap-3">
                  {target.min_awareness_activities !== null && (
                    <Badge variant="secondary">
                      Awareness: {target.min_awareness_activities}
                    </Badge>
                  )}
                  {target.min_action_activities !== null && (
                    <Badge variant="secondary">
                      Action: {target.min_action_activities}
                    </Badge>
                  )}
                  {target.min_advocacy_activities !== null && (
                    <Badge variant="secondary">
                      Advocacy: {target.min_advocacy_activities}
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {target.description && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{target.description}</p>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Chapter</p>
              <p className="font-medium">
                {target.is_national_target
                  ? 'All Chapters (National)'
                  : target.chapter?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(target.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <CMPTargetEditForm
        target={target}
        verticalName={currentVertical?.name || target.vertical?.name || 'Unknown'}
      />
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="h-10 w-10 rounded-md" />
      <div>
        <Skeleton className="h-8 w-48 mb-1" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[250px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
