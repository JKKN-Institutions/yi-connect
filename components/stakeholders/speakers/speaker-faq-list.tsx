'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { SpeakerFAQForm } from './speaker-faq-form'
import { deleteSpeakerFAQ } from '@/app/actions/speakers'
import type { SpeakerFAQ } from '@/types/stakeholder'

interface SpeakerFAQListProps {
  speakerId: string
  faqs: SpeakerFAQ[]
  canManage: boolean
}

export function SpeakerFAQList({
  speakerId,
  faqs,
  canManage,
}: SpeakerFAQListProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editFAQ, setEditFAQ] = useState<SpeakerFAQ | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(faqId: string) {
    startTransition(async () => {
      const result = await deleteSpeakerFAQ(faqId, speakerId)
      if (result.success) {
        toast.success('FAQ deleted')
      } else {
        toast.error(result.error ?? 'Failed to delete FAQ')
      }
    })
  }

  if (faqs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-medium">No FAQs yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManage
            ? 'Add frequently-asked questions to help attendees understand this speaker.'
            : 'No FAQs have been added for this speaker.'}
        </p>
        {canManage && (
          <>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add first FAQ
            </Button>
            <SpeakerFAQForm
              speakerId={speakerId}
              open={addOpen}
              onOpenChange={setAddOpen}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {faqs.length} {faqs.length === 1 ? 'question' : 'questions'}
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>
        </div>
      )}

      <Accordion type="multiple" className="w-full">
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <div className="flex items-start gap-2">
              <AccordionTrigger className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span>{faq.question}</span>
                  {!faq.is_public && (
                    <Badge variant="outline" className="text-xs">
                      <EyeOff className="mr-1 h-3 w-3" />
                      Private
                    </Badge>
                  )}
                  {faq.is_public && (
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="mr-1 h-3 w-3" />
                      Public
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
            </div>
            <AccordionContent>
              <div className="space-y-3">
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {faq.answer}
                </p>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditFAQ(faq)}
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={isPending}
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this FAQ from the
                            speaker profile. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(faq.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {canManage && (
        <>
          <SpeakerFAQForm
            speakerId={speakerId}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
          {editFAQ && (
            <SpeakerFAQForm
              speakerId={speakerId}
              faq={editFAQ}
              open={Boolean(editFAQ)}
              onOpenChange={(open) => {
                if (!open) setEditFAQ(null)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
