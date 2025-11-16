/**
 * Chapter Form Component
 *
 * Form for creating and editing Yi chapters.
 * Following Next.js 16 form patterns with Server Actions.
 */

'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createChapter, updateChapter } from '@/app/actions/chapters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Chapter } from '@/types/chapter'

interface ChapterFormProps {
  chapter?: Chapter
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Chapter' : 'Create Chapter'}
    </Button>
  )
}

export function ChapterForm({ chapter }: ChapterFormProps) {
  const router = useRouter()
  const isEdit = !!chapter
  const action = isEdit
    ? updateChapter.bind(null, chapter.id)
    : createChapter

  const [state, formAction] = useActionState(action, { success: false })

  // Handle successful creation/update with redirect
  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message)

      if (state.redirectTo) {
        router.push(state.redirectTo)
      }
    }
  }, [state, router])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Chapter' : 'Create New Chapter'}</CardTitle>
        <CardDescription>
          {isEdit
            ? 'Update chapter information'
            : 'Add a new Yi chapter to the system'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {state.message && !state.success && state.message !== 'NEXT_REDIRECT' && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Chapter Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Chapter Name *</Label>
              <Input
                id="name"
                name="name"
                type="text"
                defaultValue={chapter?.name}
                placeholder="e.g., Yi Coimbatore, Yi Chennai"
                required
                aria-invalid={!!state.errors?.name}
                aria-describedby={state.errors?.name ? 'name-error' : undefined}
              />
              {state.errors?.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {state.errors.name[0]}
                </p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                name="location"
                type="text"
                defaultValue={chapter?.location || ''}
                placeholder="e.g., Coimbatore, Tamil Nadu"
                required
                aria-invalid={!!state.errors?.location}
                aria-describedby={state.errors?.location ? 'location-error' : undefined}
              />
              {state.errors?.location && (
                <p id="location-error" className="text-sm text-destructive">
                  {state.errors.location[0]}
                </p>
              )}
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                name="region"
                type="text"
                defaultValue={chapter?.region || ''}
                placeholder="e.g., South Zone, North Zone"
                aria-invalid={!!state.errors?.region}
                aria-describedby={state.errors?.region ? 'region-error' : undefined}
              />
              {state.errors?.region && (
                <p id="region-error" className="text-sm text-destructive">
                  {state.errors.region[0]}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional: Regional grouping of chapters
              </p>
            </div>

            {/* Established Date */}
            <div className="space-y-2">
              <Label htmlFor="established_date">Established Date</Label>
              <Input
                id="established_date"
                name="established_date"
                type="date"
                defaultValue={chapter?.established_date || ''}
                aria-invalid={!!state.errors?.established_date}
                aria-describedby={
                  state.errors?.established_date ? 'established_date-error' : undefined
                }
              />
              {state.errors?.established_date && (
                <p id="established_date-error" className="text-sm text-destructive">
                  {state.errors.established_date[0]}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional: Date when the chapter was established
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <SubmitButton isEdit={isEdit} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
