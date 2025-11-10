/**
 * Member Form Component
 *
 * Comprehensive form for creating and editing members.
 */

'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createMember, updateMember } from '@/app/actions/members'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { MemberWithProfile } from '@/types/member'
import type { Tables } from '@/types/database'

interface MemberFormProps {
  member?: MemberWithProfile
  chapters?: Tables<'chapters'>[]
  userId?: string
  userEmail?: string
  userName?: string
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isEdit ? 'Update Member' : 'Create Member'}
    </Button>
  )
}

export function MemberForm({ member, chapters = [], userId, userEmail, userName }: MemberFormProps) {
  const isEdit = !!member
  const [state, formAction] = useActionState(
    isEdit ? updateMember : createMember,
    { message: '', errors: {} }
  )

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields */}
      {!isEdit && userId && <input type="hidden" name="id" value={userId} />}
      {!isEdit && userEmail && <input type="hidden" name="email" value={userEmail} />}
      {!isEdit && userName && <input type="hidden" name="full_name" value={userName} />}
      {isEdit && <input type="hidden" name="id" value={member.id} />}

      {state.message && (
        <Alert variant={state.success ? 'default' : 'destructive'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="professional">Professional</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Essential member details and membership information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="chapter_id">Chapter</Label>
                  <Select name="chapter_id" defaultValue={member?.chapter_id || undefined}>
                    <SelectTrigger id="chapter_id">
                      <SelectValue placeholder="Select chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      {chapters.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          {chapter.name} - {chapter.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state.errors?.chapter_id && (
                    <p className="text-sm text-destructive">{state.errors.chapter_id[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="membership_number">Membership Number</Label>
                  <Input
                    id="membership_number"
                    name="membership_number"
                    placeholder="YI-2024-001"
                    defaultValue={member?.membership_number || ''}
                  />
                  {state.errors?.membership_number && (
                    <p className="text-sm text-destructive">{state.errors.membership_number[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member_since">Member Since</Label>
                  <Input
                    id="member_since"
                    name="member_since"
                    type="date"
                    defaultValue={member?.member_since || new Date().toISOString().split('T')[0]}
                  />
                  {state.errors?.member_since && (
                    <p className="text-sm text-destructive">{state.errors.member_since[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="membership_status">Membership Status</Label>
                  <Select
                    name="membership_status"
                    defaultValue={member?.membership_status || 'active'}
                  >
                    <SelectTrigger id="membership_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                    </SelectContent>
                  </Select>
                  {state.errors?.membership_status && (
                    <p className="text-sm text-destructive">{state.errors.membership_status[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    defaultValue={member?.profile?.phone || ''}
                  />
                  {state.errors?.phone && (
                    <p className="text-sm text-destructive">{state.errors.phone[0]}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Info Tab */}
        <TabsContent value="professional" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
              <CardDescription>Career and work-related details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Acme Corporation"
                    defaultValue={member?.company || ''}
                  />
                  {state.errors?.company && (
                    <p className="text-sm text-destructive">{state.errors.company[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    name="designation"
                    placeholder="Software Engineer"
                    defaultValue={member?.designation || ''}
                  />
                  {state.errors?.designation && (
                    <p className="text-sm text-destructive">{state.errors.designation[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    name="industry"
                    placeholder="Technology"
                    defaultValue={member?.industry || ''}
                  />
                  {state.errors?.industry && (
                    <p className="text-sm text-destructive">{state.errors.industry[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="years_of_experience">Years of Experience</Label>
                  <Input
                    id="years_of_experience"
                    name="years_of_experience"
                    type="number"
                    min="0"
                    max="70"
                    placeholder="5"
                    defaultValue={member?.years_of_experience || ''}
                  />
                  {state.errors?.years_of_experience && (
                    <p className="text-sm text-destructive">{state.errors.years_of_experience[0]}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                  <Input
                    id="linkedin_url"
                    name="linkedin_url"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    defaultValue={member?.linkedin_url || ''}
                  />
                  {state.errors?.linkedin_url && (
                    <p className="text-sm text-destructive">{state.errors.linkedin_url[0]}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Personal details and emergency contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    defaultValue={member?.date_of_birth || ''}
                  />
                  {state.errors?.date_of_birth && (
                    <p className="text-sm text-destructive">{state.errors.date_of_birth[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select name="gender" defaultValue={member?.gender || undefined}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  {state.errors?.gender && (
                    <p className="text-sm text-destructive">{state.errors.gender[0]}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    placeholder="123 Main Street"
                    rows={2}
                    defaultValue={member?.address || ''}
                  />
                  {state.errors?.address && (
                    <p className="text-sm text-destructive">{state.errors.address[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Mumbai"
                    defaultValue={member?.city || ''}
                  />
                  {state.errors?.city && (
                    <p className="text-sm text-destructive">{state.errors.city[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="Maharashtra"
                    defaultValue={member?.state || ''}
                  />
                  {state.errors?.state && (
                    <p className="text-sm text-destructive">{state.errors.state[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    placeholder="400001"
                    defaultValue={member?.pincode || ''}
                  />
                  {state.errors?.pincode && (
                    <p className="text-sm text-destructive">{state.errors.pincode[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    placeholder="India"
                    defaultValue={member?.country || 'India'}
                  />
                  {state.errors?.country && (
                    <p className="text-sm text-destructive">{state.errors.country[0]}</p>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      name="emergency_contact_name"
                      placeholder="John Doe"
                      defaultValue={member?.emergency_contact_name || ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                    <Input
                      id="emergency_contact_phone"
                      name="emergency_contact_phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      defaultValue={member?.emergency_contact_phone || ''}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                    <Input
                      id="emergency_contact_relationship"
                      name="emergency_contact_relationship"
                      placeholder="Spouse, Parent, Sibling"
                      defaultValue={member?.emergency_contact_relationship || ''}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences & Communication</CardTitle>
              <CardDescription>Communication preferences and interests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Communication Preferences</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    How would you like to receive communications?
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="comm_email"
                        name="communication_preferences_email"
                        defaultChecked={
                          member?.communication_preferences
                            ? (member.communication_preferences as any).email
                            : true
                        }
                      />
                      <Label htmlFor="comm_email" className="font-normal">
                        Email notifications
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="comm_sms"
                        name="communication_preferences_sms"
                        defaultChecked={
                          member?.communication_preferences
                            ? (member.communication_preferences as any).sms
                            : true
                        }
                      />
                      <Label htmlFor="comm_sms" className="font-normal">
                        SMS notifications
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="comm_whatsapp"
                        name="communication_preferences_whatsapp"
                        defaultChecked={
                          member?.communication_preferences
                            ? (member.communication_preferences as any).whatsapp
                            : true
                        }
                      />
                      <Label htmlFor="comm_whatsapp" className="font-normal">
                        WhatsApp messages
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Any additional information about the member..."
                    rows={4}
                    defaultValue={member?.notes || ''}
                  />
                  {state.errors?.notes && (
                    <p className="text-sm text-destructive">{state.errors.notes[0]}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  )
}
