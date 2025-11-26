'use client'

/**
 * Materials Page Content Component
 *
 * Client component for materials upload and review.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Clock, CheckCircle } from 'lucide-react'
import { MaterialUploadForm } from '@/components/events/material-upload-form'
import { MaterialReviewCard } from '@/components/events/material-review-card'
import { MaterialsList } from '@/components/events/materials-list'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { EventMaterialWithUploader } from '@/types/event'

interface MaterialsPageContentProps {
  eventId: string
  materials: EventMaterialWithUploader[]
  canUpload: boolean
  canReview: boolean
  pendingCount: number
}

export function MaterialsPageContent({
  eventId,
  materials,
  canUpload,
  canReview,
  pendingCount,
}: MaterialsPageContentProps) {
  const router = useRouter()
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(canReview && pendingCount > 0 ? 'pending' : 'all')

  const handleUploadSuccess = () => {
    setUploadSheetOpen(false)
    router.refresh()
  }

  const handleReviewComplete = () => {
    router.refresh()
  }

  // Filter materials by status
  const pendingMaterials = materials.filter((m) => m.status === 'pending_review')
  const approvedMaterials = materials.filter((m) => m.status === 'approved')
  const draftMaterials = materials.filter((m) => m.status === 'draft')
  const revisionMaterials = materials.filter((m) => m.status === 'revision_requested')

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <FileText className="h-4 w-4" />
              All Materials
              <Badge variant="secondary" className="ml-1">
                {materials.length}
              </Badge>
            </TabsTrigger>
            {canReview && (
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending Review
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
              <Badge variant="secondary" className="ml-1">
                {approvedMaterials.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {canUpload && (
            <Button onClick={() => setUploadSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload Material
            </Button>
          )}
        </div>

        {/* All Materials Tab */}
        <TabsContent value="all" className="mt-6">
          <MaterialsList
            materials={materials}
            onUpload={() => setUploadSheetOpen(true)}
            canUpload={canUpload}
            canReview={canReview}
          />
        </TabsContent>

        {/* Pending Review Tab */}
        {canReview && (
          <TabsContent value="pending" className="mt-6">
            {pendingMaterials.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">
                    No materials pending review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {pendingMaterials.length} material(s) awaiting your review
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingMaterials.map((material) => (
                    <MaterialReviewCard
                      key={material.id}
                      material={material}
                      onReviewComplete={handleReviewComplete}
                      showActions={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Approved Tab */}
        <TabsContent value="approved" className="mt-6">
          {approvedMaterials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No approved materials yet</p>
                <p className="text-muted-foreground">
                  Materials will appear here once approved.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {approvedMaterials.map((material) => (
                <MaterialReviewCard
                  key={material.id}
                  material={material}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Sheet */}
      <Sheet open={uploadSheetOpen} onOpenChange={setUploadSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Upload Material</SheetTitle>
            <SheetDescription>
              Upload training materials for this event
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            <MaterialUploadForm
              eventId={eventId}
              onSuccess={handleUploadSuccess}
              onCancel={() => setUploadSheetOpen(false)}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
