/**
 * Profile Form Component
 *
 * Form for editing user profile information
 */

'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { ProfileWithRole } from '@/types/profile'

interface ProfileFormProps {
  profile: ProfileWithRole
}

export function ProfileForm({ profile }: ProfileFormProps) {
  // Use isPending from useActionState instead of useFormStatus to avoid React Error #419
  const [state, formAction, isPending] = useActionState(updateProfile, { success: false })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
          Update your personal details. Your email cannot be changed here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                defaultValue={profile.full_name || ''}
                placeholder="John Doe"
                required
                aria-invalid={!!state.errors?.full_name}
                aria-describedby={state.errors?.full_name ? 'full_name-error' : undefined}
              />
              {state.errors?.full_name && (
                <p id="full_name-error" className="text-sm text-destructive">
                  {state.errors.full_name[0]}
                </p>
              )}
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update your email.
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone || ''}
                placeholder="+91 98765 43210"
                aria-invalid={!!state.errors?.phone}
                aria-describedby={state.errors?.phone ? 'phone-error' : undefined}
              />
              {state.errors?.phone && (
                <p id="phone-error" className="text-sm text-destructive">
                  {state.errors.phone[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
