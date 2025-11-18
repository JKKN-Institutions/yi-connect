'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { submitJuryScore, updateJuryScore } from '@/app/actions/awards'
import { CreateJuryScoreSchema } from '@/lib/validations/award'
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
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { NominationWithDetails } from '@/types/award'

type JuryScoreFormValues = z.infer<typeof CreateJuryScoreSchema>

interface JuryScoringFormProps {
  nomination: NominationWithDetails
  juryMemberId: string
  defaultValues?: {
    id?: string
    impact_score?: number
    innovation_score?: number
    participation_score?: number
    consistency_score?: number
    leadership_score?: number
    comments?: string
  }
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isEdit ? 'Update Score' : 'Submit Score'}
    </Button>
  )
}

const SCORING_CRITERIA = [
  {
    key: 'impact_score',
    label: 'Impact',
    description: 'Measurable positive impact on the chapter or community',
    weight: 30,
  },
  {
    key: 'innovation_score',
    label: 'Innovation',
    description: 'Creative thinking and novel approaches to challenges',
    weight: 25,
  },
  {
    key: 'participation_score',
    label: 'Participation',
    description: 'Active involvement in chapter activities and events',
    weight: 20,
  },
  {
    key: 'consistency_score',
    label: 'Consistency',
    description: 'Regular and reliable contribution over time',
    weight: 15,
  },
  {
    key: 'leadership_score',
    label: 'Leadership',
    description: 'Demonstrating leadership qualities and mentoring others',
    weight: 10,
  },
] as const

export function JuryScoringForm({
  nomination,
  juryMemberId,
  defaultValues,
}: JuryScoringFormProps) {
  const isEdit = !!defaultValues?.id

  const [state, formAction] = useActionState(
    isEdit
      ? updateJuryScore.bind(null, defaultValues.id!)
      : submitJuryScore,
    { success: false }
  )

  const form = useForm<JuryScoreFormValues>({
    resolver: zodResolver(CreateJuryScoreSchema),
    defaultValues: {
      nomination_id: nomination.id,
      jury_member_id: juryMemberId,
      impact_score: defaultValues?.impact_score || 5,
      innovation_score: defaultValues?.innovation_score || 5,
      participation_score: defaultValues?.participation_score || 5,
      consistency_score: defaultValues?.consistency_score || 5,
      leadership_score: defaultValues?.leadership_score || 5,
      comments: defaultValues?.comments || '',
    },
  })

  const scores = form.watch([
    'impact_score',
    'innovation_score',
    'participation_score',
    'consistency_score',
    'leadership_score',
  ])

  // Calculate weighted score
  const weightedScore = SCORING_CRITERIA.reduce((sum, criteria, index) => {
    return sum + (scores[index] || 0) * (criteria.weight / 100)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Nomination Details */}
      <Card>
        <CardHeader>
          <CardTitle>Nomination Details</CardTitle>
          <CardDescription>
            Review the nomination before scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">Nominee</h4>
            <p className="text-sm text-muted-foreground">
              {nomination.nominee?.full_name}
              {nomination.nominee?.designation && nomination.nominee?.company && (
                <span> - {nomination.nominee.designation} at {nomination.nominee.company}</span>
              )}
            </p>
          </div>
          <div>
            <h4 className="font-semibold">Justification</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {nomination.justification}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Form */}
      <Form {...form}>
        <form action={formAction} className="space-y-6">
          {/* Hidden fields */}
          <input type="hidden" name="nomination_id" value={nomination.id} />
          <input type="hidden" name="jury_member_id" value={juryMemberId} />

          {/* Error/Success messages */}
          {state?.message && !state.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {state?.success && state.message && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {/* Scoring Criteria */}
          <Card>
            <CardHeader>
              <CardTitle>Scoring Criteria</CardTitle>
              <CardDescription>
                Rate each criterion from 1 to 10 (0.5 increments allowed)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {SCORING_CRITERIA.map((criteria) => (
                <FormField
                  key={criteria.key}
                  control={form.control}
                  name={criteria.key as any}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-base">
                          {criteria.label}
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({criteria.weight}% weight)
                          </span>
                        </FormLabel>
                        <span className="text-2xl font-bold tabular-nums">
                          {field.value?.toFixed(1)}
                        </span>
                      </div>
                      <FormDescription>{criteria.description}</FormDescription>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={1}
                            max={10}
                            step={0.5}
                            value={[field.value || 5]}
                            onValueChange={([value]) => field.onChange(value)}
                            className="w-full"
                          />
                          <input
                            type="hidden"
                            name={criteria.key}
                            value={field.value || 5}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Poor (1)</span>
                            <span>Average (5)</span>
                            <span>Excellent (10)</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          {/* Weighted Score Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Weighted Score</CardTitle>
              <CardDescription>
                Calculated based on criteria weights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">
                  {weightedScore.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  out of 10.00
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <FormField
            control={form.control}
            name="comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comments (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any additional comments or observations..."
                    className="min-h-[120px]"
                    {...field}
                    name="comments"
                  />
                </FormControl>
                <FormDescription>
                  Provide context for your scores (max 1000 characters)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <SubmitButton isEdit={isEdit} />
        </form>
      </Form>
    </div>
  )
}
