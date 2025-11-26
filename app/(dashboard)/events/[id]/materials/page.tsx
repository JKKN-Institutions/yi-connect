/**
 * Event Materials Page
 *
 * Upload and manage training materials for service events.
 * Includes approval workflow for Chapter/Vertical Chairs.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { ArrowLeft, FileText, Upload, CheckCircle, Clock } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { getServiceEventById } from '@/lib/data/service-events'
import { getMaterials, getPendingApprovalMaterials } from '@/lib/data/event-materials'
import { MaterialsPageContent } from './materials-page-content'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EventMaterialsPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member'])

  return (
    <Suspense fallback={<MaterialsPageSkeleton />}>
      <MaterialsPageServerContent params={params} />
    </Suspense>
  )
}

async function MaterialsPageServerContent({ params }: PageProps) {
  const user = await getCurrentUser()
  const { id } = await params

  if (!user) {
    redirect('/login')
  }

  // Fetch event details
  const event = await getServiceEventById(id)

  if (!event) {
    notFound()
  }

  // Fetch materials
  const materialsResult = await getMaterials({ filters: { event_id: id } })
  const materials = materialsResult.data

  // Check if user can review materials (Chair or Vertical Chair)
  const canReview = ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'].includes(
    user.role || ''
  )

  // Get pending materials count for review tab
  const pendingMaterials = canReview
    ? materials.filter((m) => m.status === 'pending_review')
    : []

  // Check if user can upload (trainer assigned to this event or admin)
  const canUpload = true // Simplified - in production, check trainer assignments

  // Count by status
  const statusCounts = {
    draft: materials.filter((m) => m.status === 'draft').length,
    pending: materials.filter((m) => m.status === 'pending_review').length,
    approved: materials.filter((m) => m.status === 'approved').length,
    revision: materials.filter((m) => m.status === 'revision_requested').length,
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/events">Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${id}`}>{event.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Materials</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Event Materials
          </h1>
          <p className="text-muted-foreground mt-1">
            {event.title}
            {event.service_type && ` - ${event.service_type.toUpperCase()}`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{materials.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold text-gray-600">{statusCounts.draft}</p>
              </div>
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials Content */}
      <MaterialsPageContent
        eventId={id}
        materials={materials}
        canUpload={canUpload}
        canReview={canReview}
        pendingCount={statusCounts.pending}
      />
    </div>
  )
}

function MaterialsPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
