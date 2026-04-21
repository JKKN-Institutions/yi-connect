'use client'

import { useActionState } from 'react'
import { createAwardCycle } from '@/app/actions/awards'
import type { AwardCategory } from '@/types/award'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

interface CycleFormProps {
  categories: AwardCategory[]
}

export function CycleForm({ categories }: CycleFormProps) {
  const [state, formAction, isPending] = useActionState(createAwardCycle, {})
  const currentYear = new Date().getFullYear()

  return (
    <form action={formAction} className="space-y-6">
      {state?.message && !state?.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="category_id">Award Category *</Label>
        <Select name="category_id" required>
          <SelectTrigger>
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cycle_name">Cycle Name *</Label>
        <Input id="cycle_name" name="cycle_name" placeholder="e.g., Q1 2026 Impact Awards" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year *</Label>
          <Input id="year" name="year" type="number" defaultValue={currentYear} min="2020" max="2100" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_identifier">Period ID (optional)</Label>
          <Input id="period_identifier" name="period_identifier" placeholder="Q1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input id="start_date" name="start_date" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date *</Label>
          <Input id="end_date" name="end_date" type="date" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nomination_deadline">Nomination Deadline *</Label>
          <Input id="nomination_deadline" name="nomination_deadline" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jury_deadline">Jury Deadline *</Label>
          <Input id="jury_deadline" name="jury_deadline" type="date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Cycle
        </Button>
      </div>
    </form>
  )
}
