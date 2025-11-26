'use client'

/**
 * Materials List Component
 *
 * Displays event materials grouped by type with filtering and actions.
 */

import { useState } from 'react'
import {
  FileText,
  FileVideo,
  FileSpreadsheet,
  Filter,
  Plus,
  History,
  Download,
  Eye,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  Share2,
} from 'lucide-react'
import {
  MATERIAL_TYPES,
  MATERIAL_APPROVAL_STATUSES,
  getMaterialApprovalStatusVariant,
  type EventMaterialWithUploader,
  type MaterialType,
  type MaterialApprovalStatus,
} from '@/types/event'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface MaterialsListProps {
  materials: EventMaterialWithUploader[]
  onUpload?: () => void
  onViewVersions?: (materialId: string) => void
  onShare?: (materialId: string) => void
  canUpload?: boolean
  canReview?: boolean
}

const MATERIAL_TYPE_ICONS: Record<MaterialType, React.ReactNode> = {
  presentation: <FileText className="h-4 w-4" />,
  handout: <FileText className="h-4 w-4" />,
  worksheet: <FileSpreadsheet className="h-4 w-4" />,
  video: <FileVideo className="h-4 w-4" />,
  assessment: <FileSpreadsheet className="h-4 w-4" />,
  certificate_template: <FileText className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
}

const STATUS_ICONS: Record<MaterialApprovalStatus, React.ReactNode> = {
  draft: <FileText className="h-4 w-4 text-gray-500" />,
  pending_review: <Clock className="h-4 w-4 text-yellow-500" />,
  approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  revision_requested: <AlertCircle className="h-4 w-4 text-red-500" />,
  superseded: <History className="h-4 w-4 text-blue-500" />,
}

function MaterialItem({
  material,
  onViewVersions,
  onShare,
}: {
  material: EventMaterialWithUploader
  onViewVersions?: (id: string) => void
  onShare?: (id: string) => void
}) {
  const uploaderInitials = material.uploader?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const statusVariant = getMaterialApprovalStatusVariant(material.status as MaterialApprovalStatus)

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="p-2 rounded-md bg-muted">
        {MATERIAL_TYPE_ICONS[material.material_type as MaterialType]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium truncate">{material.title}</h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{MATERIAL_TYPES[material.material_type as MaterialType]}</span>
              <span>•</span>
              <span>v{material.version}</span>
              {material.file_size_kb && (
                <>
                  <span>•</span>
                  <span>{(material.file_size_kb / 1024).toFixed(1)} MB</span>
                </>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            {STATUS_ICONS[material.status as MaterialApprovalStatus]}
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                statusVariant === 'success' && 'bg-green-50 text-green-700 border-green-200',
                statusVariant === 'warning' && 'bg-yellow-50 text-yellow-700 border-yellow-200',
                statusVariant === 'destructive' && 'bg-red-50 text-red-700 border-red-200'
              )}
            >
              {MATERIAL_APPROVAL_STATUSES[material.status as MaterialApprovalStatus]}
            </Badge>
          </div>
        </div>

        {/* Description */}
        {material.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {material.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={material.uploader?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">{uploaderInitials}</AvatarFallback>
            </Avatar>
            <span>{material.uploader?.full_name}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(material.created_at), { addSuffix: true })}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={material.file_url} download={material.file_name}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onViewVersions?.(material.id)}>
                  <History className="h-4 w-4 mr-2" />
                  View Versions
                </DropdownMenuItem>
                {material.status === 'approved' && (
                  <DropdownMenuItem onClick={() => onShare?.(material.id)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(material.file_url)}
                >
                  Copy Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MaterialsList({
  materials,
  onUpload,
  onViewVersions,
  onShare,
  canUpload = false,
  canReview = false,
}: MaterialsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Filter current versions only
  const currentMaterials = materials.filter((m) => m.is_current_version)

  // Apply filters
  const filteredMaterials = currentMaterials.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (typeFilter !== 'all' && m.material_type !== typeFilter) return false
    return true
  })

  // Group by type for tabs
  const groupedByType = currentMaterials.reduce(
    (acc, m) => {
      const type = m.material_type as MaterialType
      if (!acc[type]) acc[type] = []
      acc[type].push(m)
      return acc
    },
    {} as Record<MaterialType, EventMaterialWithUploader[]>
  )

  // Count by status
  const statusCounts = currentMaterials.reduce(
    (acc, m) => {
      acc[m.status as MaterialApprovalStatus] = (acc[m.status as MaterialApprovalStatus] || 0) + 1
      return acc
    },
    {} as Record<MaterialApprovalStatus, number>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Event Materials</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {statusCounts.approved && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {statusCounts.approved} Approved
                </Badge>
              )}
              {statusCounts.pending_review && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  {statusCounts.pending_review} Pending
                </Badge>
              )}
              {statusCounts.revision_requested && (
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {statusCounts.revision_requested} Needs Revision
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filters */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(MATERIAL_APPROVAL_STATUSES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(MATERIAL_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Upload Button */}
            {canUpload && onUpload && (
              <Button onClick={onUpload}>
                <Plus className="h-4 w-4 mr-2" />
                Upload
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No materials found</p>
            {canUpload && (
              <Button variant="outline" className="mt-4" onClick={onUpload}>
                <Plus className="h-4 w-4 mr-2" />
                Upload First Material
              </Button>
            )}
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">
                All ({filteredMaterials.length})
              </TabsTrigger>
              {Object.entries(groupedByType).map(([type, items]) => (
                <TabsTrigger key={type} value={type}>
                  <span className="flex items-center gap-1">
                    {MATERIAL_TYPE_ICONS[type as MaterialType]}
                    {MATERIAL_TYPES[type as MaterialType]} ({items.length})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredMaterials.map((material) => (
                    <MaterialItem
                      key={material.id}
                      material={material}
                      onViewVersions={onViewVersions}
                      onShare={onShare}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {Object.entries(groupedByType).map(([type, items]) => (
              <TabsContent key={type} value={type} className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {items
                      .filter((m) => {
                        if (statusFilter !== 'all' && m.status !== statusFilter) return false
                        return true
                      })
                      .map((material) => (
                        <MaterialItem
                          key={material.id}
                          material={material}
                          onViewVersions={onViewVersions}
                          onShare={onShare}
                        />
                      ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

export default MaterialsList
