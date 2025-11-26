'use client'

/**
 * Material Upload Form Component
 *
 * Form for uploading event materials with metadata.
 * Supports file upload, type selection, and tagging.
 */

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Upload,
  FileText,
  FileVideo,
  FileSpreadsheet,
  X,
  Tag,
} from 'lucide-react'
import { uploadMaterial } from '@/app/actions/event-materials'
import { uploadMaterialSchema, type UploadMaterialInput } from '@/lib/validations/event'
import { MATERIAL_TYPES, type MaterialType } from '@/types/event'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import toast from 'react-hot-toast'

interface MaterialUploadFormProps {
  eventId: string
  trainerAssignmentId?: string
  onSuccess?: (materialId: string) => void
  onCancel?: () => void
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

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
]

export function MaterialUploadForm({
  eventId,
  trainerAssignmentId,
  onSuccess,
  onCancel,
}: MaterialUploadFormProps) {
  const [isPending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const form = useForm<UploadMaterialInput>({
    resolver: zodResolver(uploadMaterialSchema) as any,
    defaultValues: {
      event_id: eventId,
      trainer_assignment_id: trainerAssignmentId,
      title: '',
      description: '',
      material_type: 'presentation',
      file_url: '',
      file_name: '',
      file_size_kb: undefined,
      mime_type: '',
      tags: [],
    },
  })

  const tags = form.watch('tags') || []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setFileError(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError('File size must be less than 50MB')
      return
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setFileError('Invalid file type. Allowed: PDF, PPT, PPTX, DOC, DOCX, MP4, WEBM, JPEG, PNG')
      return
    }

    setFile(selectedFile)
    form.setValue('file_name', selectedFile.name)
    form.setValue('file_size_kb', Math.round(selectedFile.size / 1024))
    form.setValue('mime_type', selectedFile.type)

    // Auto-detect material type from file
    if (selectedFile.type.includes('video')) {
      form.setValue('material_type', 'video')
    } else if (
      selectedFile.type.includes('powerpoint') ||
      selectedFile.type.includes('presentation')
    ) {
      form.setValue('material_type', 'presentation')
    }
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      form.setValue('tags', [...tags, tag])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    form.setValue('tags', tags.filter((t) => t !== tagToRemove))
  }

  const onSubmit = async (data: UploadMaterialInput) => {
    if (!file) {
      setFileError('Please select a file to upload')
      return
    }

    startTransition(async () => {
      try {
        // In a real implementation, you would upload the file to storage first
        // For now, we'll simulate with a placeholder URL
        const fileUrl = `https://storage.example.com/materials/${eventId}/${file.name}`

        const result = await uploadMaterial({
          ...data,
          file_url: fileUrl,
        })

        if (result.success && result.data) {
          toast.success('Material uploaded successfully')
          onSuccess?.(result.data.id)
        } else {
          toast.error(result.error || 'Failed to upload material')
        }
      } catch (error) {
        console.error('Error uploading material:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Material</CardTitle>
        <CardDescription>
          Upload training materials for this event. Materials will be reviewed before approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <FormLabel>File *</FormLabel>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center
                  hover:border-primary/50 transition-colors
                  ${file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted'}
                  ${fileError ? 'border-destructive' : ''}
                `}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFile(null)
                        form.setValue('file_name', '')
                        form.setValue('file_size_kb', undefined)
                        form.setValue('mime_type', '')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, PPT, PPTX, DOC, DOCX, MP4, WEBM (max 50MB)
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept={ALLOWED_TYPES.join(',')}
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
              {fileError && (
                <p className="text-sm text-destructive">{fileError}</p>
              )}
            </div>

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Masoom Session Presentation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Material Type */}
            <FormField
              control={form.control}
              name="material_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(MATERIAL_TYPES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            {MATERIAL_TYPE_ICONS[value as MaterialType]}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the material content..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to help reviewers understand the content
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Info Alert */}
            <Alert>
              <AlertDescription>
                Materials will be saved as drafts and require review by a Chapter Chair
                or Vertical Chair before they are approved.
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending || !file}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Material
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default MaterialUploadForm
