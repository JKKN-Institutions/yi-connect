/**
 * Edit Health Card Entry Page
 *
 * View and edit an existing health card activity entry.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Trash2, Calendar, Users, MapPin } from 'lucide-react'
import { requireRole, getCurrentChapterId, getUserProfile } from '@/lib/auth'
import {
  getHealthCardEntryById,
  getChapterById,
  getVerticalsForForm,
} from '@/lib/data/health-card'
import { deleteHealthCardEntry } from '@/app/actions/health-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { REGION_NAMES, SUBMITTER_ROLES, type YiRegion } from '@/types/health-card'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const entry = await getHealthCardEntryById(id)
  return {
    title: entry ? `${entry.activity_name} - Health Card` : 'Health Card Entry',
    description: 'View health card activity entry',
  }
}

export default async function HealthCardEntryPage({ params }: PageProps) {
  const { user, roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Vertical Head',
    'Executive Member',
  ])

  const { id } = await params
  const entry = await getHealthCardEntryById(id)

  if (!entry) {
    notFound()
  }

  const userRoles = roles || []
  const canDelete = userRoles.includes('Chair') || userRoles.includes('Super Admin') || userRoles.includes('National Admin')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pathfinder/health-card">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{entry.activity_name}</h1>
            <p className="text-muted-foreground">
              Logged by {entry.submitter_name}
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
                <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this health card entry? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form
                  action={async () => {
                    'use server'
                    await deleteHealthCardEntry(id)
                    redirect('/pathfinder/health-card')
                  }}
                >
                  <AlertDialogAction type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Entry Details */}
      <div className="space-y-6">
        {/* Activity Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Activity Details</CardTitle>
              <Badge
                variant="outline"
                style={{
                  borderColor: entry.vertical?.color || undefined,
                  color: entry.vertical?.color || undefined,
                }}
              >
                {entry.vertical?.name || 'Unknown Vertical'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(entry.activity_date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Region:</span>
                <span className="font-medium">
                  {REGION_NAMES[entry.region as YiRegion] || entry.region}
                </span>
              </div>
            </div>

            {entry.activity_description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{entry.activity_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {entry.ec_members_count + entry.non_ec_members_count}
                </div>
                <p className="text-sm text-muted-foreground">Total Participants</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold">{entry.ec_members_count}</div>
                <p className="text-sm text-muted-foreground">EC Members</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold">{entry.non_ec_members_count}</div>
                <p className="text-sm text-muted-foreground">Non-EC Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vertical-Specific Data */}
        {entry.vertical_specific_data && Object.keys(entry.vertical_specific_data).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{entry.vertical?.name} Details</CardTitle>
              <CardDescription>
                Activity-specific metrics for {entry.vertical?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(entry.vertical_specific_data).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submitter Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submitter Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{entry.submitter_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">
                  {SUBMITTER_ROLES.find((r) => r.value === entry.submitter_role)?.label ||
                    entry.submitter_role}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{entry.email}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Chapter</p>
                <p className="font-medium">{entry.chapter?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {new Date(entry.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
