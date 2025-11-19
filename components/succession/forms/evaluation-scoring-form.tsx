'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { submitEvaluationScores } from '@/app/actions/succession'
import { SubmitEvaluationScoresSchema } from '@/lib/validations/succession'

type FormData = z.infer<typeof SubmitEvaluationScoresSchema>

interface EvaluationScoringFormProps {
  nominationId: string
  evaluatorId: string
  criteria: Array<{
    id: string
    criterion_name: string
    description: string | null
    weight: number
    max_score: number
  }>
  nominee: {
    first_name: string
    last_name: string
  }
  position: {
    title: string
  }
  onSuccess?: () => void
}

export function EvaluationScoringForm({
  nominationId,
  evaluatorId,
  criteria,
  nominee,
  position,
  onSuccess,
}: EvaluationScoringFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(SubmitEvaluationScoresSchema),
    defaultValues: {
      nomination_id: nominationId,
      evaluator_id: evaluatorId,
      scores: criteria.map((c) => ({
        criterion_id: c.id,
        score: 0,
        comments: '',
      })),
    },
  })

  const onSubmit = async (data: FormData) => {
    // Validate all scores are within max_score
    const invalidScores = data.scores.filter((score, index) => {
      const criterion = criteria[index]
      return score.score > criterion.max_score
    })

    if (invalidScores.length > 0) {
      toast.error('Some scores exceed the maximum allowed score')
      return
    }

    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('nomination_id', data.nomination_id)
    formData.append('evaluator_id', data.evaluator_id)
    formData.append('scores', JSON.stringify(data.scores))

    const result = await submitEvaluationScores(formData)

    if (result.success) {
      toast.success('Evaluation scores submitted successfully')
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/succession/evaluations')
        router.refresh()
      }
    } else {
      toast.error(result.error || 'Failed to submit evaluation scores')
    }

    setIsSubmitting(false)
  }

  const calculateTotalWeightedScore = () => {
    const scores = form.watch('scores')
    let total = 0
    scores.forEach((score, index) => {
      const criterion = criteria[index]
      const normalizedScore = (score.score / criterion.max_score) * 100
      const weightedScore = (normalizedScore * criterion.weight) / 100
      total += weightedScore
    })
    return total.toFixed(2)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nominee:</span>{' '}
              <span className="font-medium">
                {nominee.first_name} {nominee.last_name}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Position:</span>{' '}
              <span className="font-medium">{position.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Criteria:</span>{' '}
              <span className="font-medium">{criteria.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weighted Score:</span>{' '}
              <span className="font-medium text-lg">{calculateTotalWeightedScore()}%</span>
            </div>
          </CardContent>
        </Card>

        {criteria.map((criterion, index) => (
          <Card key={criterion.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{criterion.criterion_name}</CardTitle>
                  {criterion.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {criterion.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Weight: {criterion.weight}%</div>
                  <div>Max Score: {criterion.max_score}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name={`scores.${index}.score`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score (0 - {criterion.max_score})</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max={criterion.max_score}
                        step="0.1"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter a score between 0 and {criterion.max_score}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`scores.${index}.comments`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Provide your reasoning for this score..."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional comments to explain your evaluation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/succession/evaluations')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
