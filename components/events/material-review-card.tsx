'use client'

/**
 * Material Review Card Component
 *
 * Card for reviewing and approving/requesting revisions for materials.
 * Used by Chapter Chairs and Vertical Chairs.
 */

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  X,
  FileText,
  FileVideo,
  FileSpreadsheet,
  Download,
  Clock,
  User,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  History,
  Loader2,
} from 'lucide-react'
import { reviewMaterial } from '@/app/actions/event-materials'
import {
  MATERIAL_TYPES,
  MATERIAL_APPROVAL_STATUSES,
  getMaterialApprovalStatusVariant,
  type EventMaterialWithUploader,
  type MaterialType,
  type MaterialApprovalStatus,
} from '@/types/event'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface MaterialReviewCardProps {
  material: EventMaterialWithUploader
  onReviewComplete?: () => void
  showActions?: boolean
}

const MATERIAL_TYPE_ICONS: Record<MaterialType, React.ReactNode> = {
  presentation: <FileText className="h-5 w-5" />,
  handout: <FileText className="h-5 w-5" />,
  worksheet: <FileSpreadsheet className="h-5 w-5" />,
  video: <FileVideo className="h-5 w-5" />,
  assessment: <FileSpreadsheet className="h-5 w-5" />,
  certificate_template: <FileText className="h-5 w-5" />,
  other: <FileText className="h-5 w-5" />,
}

function StatusBadge({ status }: { status: MaterialApprovalStatus }) {
  const variant = getMaterialApprovalStatusVariant(status)
  const variantClasses: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    secondary: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    destructive: 'bg-red-100 text-red-700 border-red-200',
  }

  return (
    <Badge variant="outline" className={variantClasses[variant]}>
      {MATERIAL_APPROVAL_STATUSES[status]}
    </Badge>
  )
}

export function MaterialReviewCard({
  material,
  onReviewComplete,
  showActions = true,
}: MaterialReviewCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isExpanded, setIsExpanded] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'request_revision'>('approve')
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const isPendingReview = material.status === 'pending_review'

  const uploaderInitials = material.uploader?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const handleReview = () => {
    if (reviewAction === 'request_revision' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for requesting revisions')
      return
    }

    startTransition(async () => {
      try {
        const result = await reviewMaterial({
          material_id: material.id,
          action: reviewAction,
          review_notes: reviewNotes || undefined,
          rejection_reason: reviewAction === 'request_revision' ? rejectionReason : undefined,
        })

        if (result.success) {
          toast.success(
            reviewAction === 'approve'
              ? 'Material approved successfully'
              : 'Revision requested successfully'
          )
          setReviewDialogOpen(false)
          setReviewNotes('')
          setRejectionReason('')
          onReviewComplete?.()
        } else {
          toast.error(result.error || 'Failed to review material')
        }
      } catch (error) {
        console.error('Error reviewing material:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  const openReviewDialog = (action: 'approve' | 'request_revision') => {
    setReviewAction(action)
    setReviewDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              {MATERIAL_TYPE_ICONS[material.material_type as MaterialType]}
            </div>
            <div>
              <CardTitle className="text-base">{material.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {MATERIAL_TYPES[material.material_type as MaterialType]}
                </Badge>
                <span>v{material.version}</span>
                {material.file_size_kb && (
                  <span>{(material.file_size_kb / 1024).toFixed(2)} MB</span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={material.status as MaterialApprovalStatus} />
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Description */}
        {material.description && (
          <p className="text-sm text-muted-foreground mb-3">{material.description}</p>
        )}

        {/* Uploader Info */}
        <div className="flex items-center gap-2 text-sm">
          <Avatar className="h-6 w-6">
            <AvatarImage src={material.uploader?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{uploaderInitials}</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground">
            Uploaded by {material.uploader?.full_name || 'Unknown'}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(material.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Tags */}
        {material.tags && material.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {material.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-3">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <Separator />

            {/* File Info */}
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File Name:</span>
                <span className="font-medium">{material.file_name}</span>
              </div>
              {material.mime_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{material.mime_type}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Downloads:</span>
                <span>{material.download_count}</span>
              </div>
            </div>

            {/* Review Info (if reviewed) */}
            {material.reviewed_at && material.reviewer && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Review</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Reviewed by {material.reviewer.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNow(new Date(material.reviewed_at), { addSuffix: true })}
                    </span>
                  </div>
                  {material.review_notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5" />
                        <span>{material.review_notes}</span>
                      </div>
                    </div>
                  )}
                  {material.rejection_reason && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                      <div className="flex items-start gap-2">
                        <X className="h-4 w-4 mt-0.5" />
                        <div>
                          <span className="font-medium">Revision needed:</span>
                          <p>{material.rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Version Info */}
            {material.version > 1 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span>This is version {material.version} of this material</span>
                </div>
                {material.version_notes && (
                  <p className="text-sm pl-6">{material.version_notes}</p>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-3">
        {/* Preview/Download */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={material.file_url} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={material.file_url} download={material.file_name}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
          </Button>
        </div>

        {/* Review Actions */}
        {showActions && isPendingReview && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => openReviewDialog('request_revision')}
            >
              <X className="h-4 w-4 mr-1" />
              Request Revision
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openReviewDialog('approve')}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        )}
      </CardFooter>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Material' : 'Request Revision'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'This material will be approved and available for use.'
                : 'The uploader will be notified and can submit a revised version.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {reviewAction === 'request_revision' && (
              <div className="space-y-2">
                <Label htmlFor="rejection_reason">Reason for Revision *</Label>
                <Textarea
                  id="rejection_reason"
                  placeholder="Explain what needs to be changed..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="review_notes">
                {reviewAction === 'approve' ? 'Notes (Optional)' : 'Additional Notes'}
              </Label>
              <Textarea
                id="review_notes"
                placeholder="Any additional feedback..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={isPending}
              className={cn(
                reviewAction === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : reviewAction === 'approve' ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Request Revision
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default MaterialReviewCard
