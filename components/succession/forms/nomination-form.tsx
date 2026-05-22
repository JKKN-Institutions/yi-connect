'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { submitNomination } from '@/app/actions/succession'
import { NominationFormSchema } from '@/lib/validations/succession'
import type { SuccessionPosition } from '@/lib/types/succession'
import { toast } from 'react-hot-toast'

type FormData = z.infer<typeof NominationFormSchema>

interface NominationFormProps {
  cycleId: string
  positions: SuccessionPosition[]
  members: Array<{ id: string; first_name: string; last_name: string; email: string }>
}

export function NominationForm({ cycleId, positions, members }: NominationFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [evidenceList, setEvidenceList] = useState<
    Array<{ type: string; title: string; content: string; url?: string }>
  >([])
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [newEvidence, setNewEvidence] = useState({
    type: 'note',
    title: '',
    content: '',
    url: '',
  })

  const form = useForm<FormData>({
    resolver: zodResolver(NominationFormSchema),
    defaultValues: {
      cycle_id: cycleId,
      position_id: '',
      nominee_id: '',
      justification: '',
    },
  })

  const addEvidence = () => {
    if (!newEvidence.title || !newEvidence.content) {
      toast.error('Please provide both title and content for evidence')
      return
    }

    const evidence = {
      type: newEvidence.type,
      title: newEvidence.title,
      content: newEvidence.content,
      ...(newEvidence.url && { url: newEvidence.url }),
    }

    setEvidenceList([...evidenceList, evidence])
    setNewEvidence({ type: 'note', title: '', content: '', url: '' })
    setShowEvidenceForm(false)
  }

  const removeEvidence = (index: number) => {
    setEvidenceList(evidenceList.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('position_id', data.position_id)
    formData.append('nominee_id', data.nominee_id)
    formData.append('justification', data.justification)
    if (evidenceList.length > 0) {
      formData.append('supporting_evidence', JSON.stringify(evidenceList))
    }

    const result = await submitNomination(formData)

    if (result.success) {
      toast.success('Nomination submitted successfully')
      router.push('/succession/nominations')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to submit nomination')
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a position" />
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
                Select the leadership position for this nomination
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nominee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nominee</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member to nominate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                The member you want to nominate for this position
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="justification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Justification</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why this member is qualified for this position. Include their relevant experience, skills, achievements, and leadership qualities..."
                  rows={8}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Minimum 100 characters. Be specific about their qualifications.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Supporting Evidence Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Supporting Evidence (Optional)</h3>
              <p className="text-sm text-muted-foreground">
                Add documents, links, or notes to support this nomination
              </p>
            </div>
            {!showEvidenceForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEvidenceForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Evidence
              </Button>
            )}
          </div>

          {showEvidenceForm && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newEvidence.type}
                    onValueChange={(value) =>
                      setNewEvidence({ ...newEvidence, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Previous Leadership Role"
                    value={newEvidence.title}
                    onChange={(e) =>
                      setNewEvidence({ ...newEvidence, title: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  placeholder="Describe the evidence..."
                  rows={3}
                  value={newEvidence.content}
                  onChange={(e) =>
                    setNewEvidence({ ...newEvidence, content: e.target.value })
                  }
                />
              </div>

              {(newEvidence.type === 'link' || newEvidence.type === 'document') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={newEvidence.url}
                    onChange={(e) =>
                      setNewEvidence({ ...newEvidence, url: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addEvidence}>
                  Add Evidence
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEvidenceForm(false)
                    setNewEvidence({ type: 'note', title: '', content: '', url: '' })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {evidenceList.length > 0 && (
            <div className="space-y-2">
              {evidenceList.map((evidence, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between border rounded-lg p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {evidence.type}
                      </span>
                      <span className="text-sm font-medium">{evidence.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {evidence.content}
                    </p>
                    {evidence.url && (
                      <a
                        href={evidence.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {evidence.url}
                      </a>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEvidence(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Nomination
          </Button>
        </div>
      </form>
    </Form>
  )
}
