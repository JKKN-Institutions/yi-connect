'use client'

import { useActionState } from 'react'
import { createAwardCategory } from '@/app/actions/awards'
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

interface CategoryFormProps {
  chapterId: string
}

export function CategoryForm({ chapterId }: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(createAwardCategory, {})

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="chapter_id" value={chapterId} />

      {state?.message && !state?.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Category Name *</Label>
        <Input id="name" name="name" placeholder="e.g., Community Impact" required />
        {state?.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe what this category recognizes..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency *</Label>
        <Select name="frequency" defaultValue="quarterly" required>
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="one_time">One Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="icon">Icon (optional)</Label>
          <Input id="icon" name="icon" placeholder="trophy" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color (optional)</Label>
          <Input id="color" name="color" placeholder="blue" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort Order (optional)</Label>
        <Input id="sort_order" name="sort_order" type="number" placeholder="0" min="0" />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Category
        </Button>
      </div>
    </form>
  )
}
