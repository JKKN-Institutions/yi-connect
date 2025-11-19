'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, X, FileText } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { submitApplication } from '@/app/actions/succession'
import { CreateApplicationSchema } from '@/lib/validations/succession'
import toast from 'react-hot-toast'

type FormData = Omit<z.infer<typeof CreateApplicationSchema>, 'member_id'>

interface ApplicationFormProps {
  cycleId: string
  positions: Array<{
    id: string
    title: string
    description: string | null
    hierarchy_level: number
    eligibility_criteria: any
  }>
}

interface DocumentFile {
  name: string
  url: string
  size: number
  type: string
  uploaded_at: string
}

export function ApplicationForm({ cycleId, positions }: ApplicationFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [documents, setDocuments] = useState<DocumentFile[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(CreateApplicationSchema.omit({ member_id: true })),
    defaultValues: {
      cycle_id: cycleId,
      position_id: '',
      personal_statement: '',
    },
  })

  const selectedPositionId = form.watch('position_id')
  const selectedPosition = positions.find((p) => p.id === selectedPositionId)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ]
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed')
      return
    }

    setUploadingFile(true)

    try {
      // In a real app, upload to Supabase Storage
      // For now, simulate upload with a data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const document: DocumentFile = {
          name: file.name,
          url: reader.result as string, // In production, this would be the storage URL
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        }
        setDocuments([...documents, document])
        toast.success('Document uploaded successfully')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Failed to upload document')
    } finally {
      setUploadingFile(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
    toast.success('Document removed')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const onSubmit = async (data: FormData) => {
    if (documents.length === 0) {
      toast.error('Please upload at least one supporting document')
      return
    }

    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('position_id', data.position_id)
    formData.append('personal_statement', data.personal_statement)
    formData.append('supporting_documents', JSON.stringify(documents))

    const result = await submitApplication(formData)

    if (result.success) {
      toast.success('Application submitted successfully')
      router.push('/succession/applications')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to submit application')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="position_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a position to apply for" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.title} (Level {position.hierarchy_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the leadership position you want to apply for
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedPosition && (
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Position Details</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedPosition.description || 'No description available'}
              </p>
              {selectedPosition.eligibility_criteria && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Eligibility Requirements:</h5>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {selectedPosition.eligibility_criteria.minimum_tenure_years > 0 && (
                      <li>
                        Minimum {selectedPosition.eligibility_criteria.minimum_tenure_years} years
                        of membership
                      </li>
                    )}
                    {selectedPosition.eligibility_criteria.minimum_events_attended > 0 && (
                      <li>
                        At least {selectedPosition.eligibility_criteria.minimum_events_attended}{' '}
                        events attended
                      </li>
                    )}
                    {selectedPosition.eligibility_criteria.requires_leadership_experience && (
                      <li>Prior leadership experience required</li>
                    )}
                    {selectedPosition.eligibility_criteria.required_skills?.length > 0 && (
                      <li>
                        Required skills:{' '}
                        {selectedPosition.eligibility_criteria.required_skills.join(', ')}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <FormField
          control={form.control}
          name="personal_statement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Statement</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Explain why you are applying for this position, your relevant experience, and what you hope to contribute..."
                  rows={10}
                  className="resize-none"
                />
              </FormControl>
              <FormDescription>
                Provide a detailed statement about your qualifications and motivation (minimum 100
                characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div>
            <FormLabel>Supporting Documents</FormLabel>
            <FormDescription className="mb-3">
              Upload relevant documents (resume, certificates, letters of recommendation, etc.)
            </FormDescription>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploadingFile}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingFile ? 'Uploading...' : 'Upload Document'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Max 10MB • PDF, DOC, DOCX, JPG, PNG
              </span>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <Card key={index}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.size)} • Uploaded{' '}
                          {new Date(doc.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/succession/applications')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
