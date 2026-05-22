'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createSpeakerFAQ, updateSpeakerFAQ } from '@/app/actions/speakers'
import type { SpeakerFAQ } from '@/types/stakeholder'

interface SpeakerFAQFormProps {
  speakerId: string
  faq?: SpeakerFAQ
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SpeakerFAQForm({
  speakerId,
  faq,
  open,
  onOpenChange,
  onSuccess,
}: SpeakerFAQFormProps) {
  const isEdit = Boolean(faq)
  const [question, setQuestion] = useState(faq?.question ?? '')
  const [answer, setAnswer] = useState(faq?.answer ?? '')
  const [isPublic, setIsPublic] = useState(faq?.is_public ?? true)
  const [isPending, startTransition] = useTransition()

  // Reset fields when faq prop changes (editing a different FAQ)
  // Using key prop from parent is cleaner, but reset on open works too
  function handleOpenChange(next: boolean) {
    if (!next) {
      // Defer field reset to next tick to avoid flicker
      setTimeout(() => {
        setQuestion(faq?.question ?? '')
        setAnswer(faq?.answer ?? '')
        setIsPublic(faq?.is_public ?? true)
      }, 150)
    }
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (question.trim().length < 3) {
      toast.error('Question must be at least 3 characters')
      return
    }
    if (answer.trim().length < 1) {
      toast.error('Answer is required')
      return
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateSpeakerFAQ({
            id: faq!.id,
            question: question.trim(),
            answer: answer.trim(),
            is_public: isPublic,
          })
        : await createSpeakerFAQ({
            speaker_id: speakerId,
            question: question.trim(),
            answer: answer.trim(),
            is_public: isPublic,
          })

      if (result.success) {
        toast.success(isEdit ? 'FAQ updated' : 'FAQ added')
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error ?? 'Failed to save FAQ')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this FAQ entry for the speaker profile.'
              : 'Add a question and answer to help attendees learn about this speaker.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="faq-question">Question *</Label>
            <Input
              id="faq-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What topics do you cover?"
              maxLength={500}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="faq-answer">Answer *</Label>
            <Textarea
              id="faq-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a detailed answer..."
              rows={5}
              maxLength={5000}
              required
            />
            <p className="text-xs text-muted-foreground">
              {answer.length}/5000 characters
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="faq-public">Public FAQ</Label>
              <p className="text-xs text-muted-foreground">
                Visible on the public speaker profile page.
              </p>
            </div>
            <Switch
              id="faq-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
