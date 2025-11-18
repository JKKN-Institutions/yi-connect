'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createNomination, updateNomination } from '@/app/actions/awards'
import { CreateNominationSchema } from '@/lib/validations/award'
import { NominationStatus } from '@/types/award'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'

type NominationFormValues = z.infer<typeof CreateNominationSchema>

interface NominationFormProps {
  cycleId: string
  nominatorId: string
  members: Array<{
    id: string
    full_name: string
    avatar_url?: string
    company?: string
    designation?: string
  }>
  defaultValues?: {
    id?: string
    nominee_id?: string
    justification?: string
    status?: string
  }
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isEdit ? 'Update Nomination' : 'Create Nomination'}
    </Button>
  )
}

export function NominationForm({
  cycleId,
  nominatorId,
  members,
  defaultValues,
}: NominationFormProps) {
  const isEdit = !!defaultValues?.id

  const [state, formAction] = useActionState(
    isEdit
      ? updateNomination.bind(null, defaultValues.id!)
      : createNomination,
    { success: false }
  )

  const form = useForm<NominationFormValues>({
    resolver: zodResolver(CreateNominationSchema),
    defaultValues: {
      cycle_id: cycleId,
      nominator_id: nominatorId,
      nominee_id: defaultValues?.nominee_id || '',
      justification: defaultValues?.justification || '',
      status: (defaultValues?.status as NominationStatus) || 'draft',
    },
  })

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-6">
        {/* Hidden fields */}
        <input type="hidden" name="cycle_id" value={cycleId} />
        <input type="hidden" name="nominator_id" value={nominatorId} />
        <input type="hidden" name="status" value={form.watch('status')} />

        {/* Error message */}
        {state?.message && !state.success && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {/* Success message */}
        {state?.success && state.message && (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {/* Nominee Selection */}
        <FormField
          control={form.control as any}
          name="nominee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nominee *</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                name="nominee_id"
                disabled={isEdit}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member to nominate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {members
                    .filter(m => m.id !== nominatorId)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{member.full_name}</span>
                          {member.designation && member.company && (
                            <span className="text-sm text-muted-foreground">
                              {member.designation} at {member.company}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the member you want to nominate for this award
              </FormDescription>
              <FormMessage />
              {state?.errors?.nominee_id && (
                <p className="text-sm font-medium text-destructive">
                  {state.errors.nominee_id[0]}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Justification */}
        <FormField
          control={form.control as any}
          name="justification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Justification *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why this member deserves this award... (minimum 50 characters)"
                  className="min-h-[200px]"
                  {...field}
                  name="justification"
                />
              </FormControl>
              <FormDescription>
                Provide detailed justification (50-2000 characters). Include specific examples and achievements.
              </FormDescription>
              <FormMessage />
              {state?.errors?.justification && (
                <p className="text-sm font-medium text-destructive">
                  {state.errors.justification[0]}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue('status', 'draft')
              form.handleSubmit(() => {
                const formData = new FormData()
                Object.entries(form.getValues()).forEach(([key, value]) => {
                  formData.append(key, String(value))
                })
                formAction(formData)
              })()
            }}
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            onClick={() => {
              form.setValue('status', 'submitted')
              form.handleSubmit(() => {
                const formData = new FormData()
                Object.entries(form.getValues()).forEach(([key, value]) => {
                  formData.append(key, String(value))
                })
                formAction(formData)
              })()
            }}
          >
            Submit Nomination
          </Button>
        </div>
      </form>
    </Form>
  )
}
