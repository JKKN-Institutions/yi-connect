/**
 * Member Form Component
 *
 * Multi-step form for creating and editing members with data persistence.
 * Supports two modes:
 * - "apply": Public membership application (calls submitMemberRequest)
 * - "create": Admin member creation (calls createMember)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createMember, updateMember } from '@/app/actions/members';
import { submitMemberRequest } from '@/app/actions/member-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { MemberWithProfile } from '@/types/member';
import type { ChapterOption } from '@/types/chapter';

interface MemberFormProps {
  member?: MemberWithProfile;
  chapters?: ChapterOption[];
  userId?: string;
  userEmail?: string;
  userName?: string;
  mode?: 'create' | 'apply'; // New prop to determine form mode
}

interface FormData {
  // Basic Info
  full_name: string; // For apply mode
  email: string; // For apply mode
  chapter_id: string;
  membership_number: string;
  member_since: string;
  membership_status: string;
  phone: string;

  // Professional Info
  company: string;
  designation: string;
  industry: string;
  years_of_experience: string;
  linkedin_url: string;

  // Personal Info
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;

  // Application Info (apply mode only)
  motivation: string;
  how_did_you_hear: string;

  // Preferences
  communication_preferences_email: boolean;
  communication_preferences_sms: boolean;
  communication_preferences_whatsapp: boolean;
  notes: string;
}

const CREATE_STEPS = [
  { number: 1, title: 'Basic Info', description: 'Essential member details' },
  { number: 2, title: 'Professional', description: 'Career information' },
  { number: 3, title: 'Personal', description: 'Personal details' },
  { number: 4, title: 'Preferences', description: 'Communication preferences' }
];

const APPLY_STEPS = [
  { number: 1, title: 'Basic Info', description: 'Your contact details' },
  { number: 2, title: 'Professional', description: 'Your career background' },
  { number: 3, title: 'Personal', description: 'Your personal information' },
  { number: 4, title: 'About You', description: 'Why join Yi?' }
];

export function MemberForm({
  member,
  chapters = [],
  userId,
  userEmail,
  userName,
  mode = 'create' // Default to create mode
}: MemberFormProps) {
  const router = useRouter();
  const isEdit = !!member;
  const isApplyMode = mode === 'apply';
  const STEPS = isApplyMode ? APPLY_STEPS : CREATE_STEPS;
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Initialize form data
  const [formData, setFormData] = useState<FormData>({
    // Basic Info
    full_name: userName || member?.profile?.full_name || '',
    email: userEmail || member?.profile?.email || '',
    chapter_id: member?.chapter_id || '',
    membership_number: member?.membership_number || '',
    member_since:
      member?.member_since || new Date().toISOString().split('T')[0],
    membership_status: member?.membership_status || 'active',
    phone: member?.profile?.phone || '',

    // Professional Info
    company: member?.company || '',
    designation: member?.designation || '',
    industry: member?.industry || '',
    years_of_experience: member?.years_of_experience?.toString() || '',
    linkedin_url: member?.linkedin_url || '',

    // Personal Info
    date_of_birth: member?.date_of_birth || '',
    gender: member?.gender || '',
    address: member?.address || '',
    city: member?.city || '',
    state: member?.state || '',
    pincode: member?.pincode || '',
    country: member?.country || 'India',
    emergency_contact_name: member?.emergency_contact_name || '',
    emergency_contact_phone: member?.emergency_contact_phone || '',
    emergency_contact_relationship:
      member?.emergency_contact_relationship || '',

    // Application Info (apply mode)
    motivation: '',
    how_did_you_hear: '',

    // Preferences
    communication_preferences_email: member?.communication_preferences
      ? (member.communication_preferences as any).email
      : true,
    communication_preferences_sms: member?.communication_preferences
      ? (member.communication_preferences as any).sms
      : true,
    communication_preferences_whatsapp: member?.communication_preferences
      ? (member.communication_preferences as any).whatsapp
      : true,
    notes: member?.notes || ''
  });

  // Update form data
  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user updates it
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Navigate to next step
  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Navigate to previous step
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Submit form
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      // Create FormData object for server action
      const submitData = new FormData();

      // Add hidden fields
      if (!isEdit) {
        if (userId) {
          submitData.append('id', userId);
          if (userEmail) submitData.append('email', userEmail);
          if (userName) submitData.append('full_name', userName);
        }
        // For admin creating new member without userId, email and full_name come from formData
      } else {
        submitData.append('id', member.id);
      }

      // Add all form fields
      Object.entries(formData).forEach(([key, value]) => {
        // Skip individual communication preference fields - we'll combine them
        if (
          key === 'communication_preferences_email' ||
          key === 'communication_preferences_sms' ||
          key === 'communication_preferences_whatsapp'
        ) {
          return;
        }

        // Map chapter_id to preferred_chapter_id for apply mode
        const fieldName =
          isApplyMode && key === 'chapter_id' ? 'preferred_chapter_id' : key;

        if (typeof value === 'boolean') {
          submitData.append(fieldName, value ? 'on' : '');
        } else {
          submitData.append(fieldName, value?.toString() || '');
        }
      });

      // Add combined communication preferences as JSON
      submitData.append(
        'communication_preferences',
        JSON.stringify({
          email: formData.communication_preferences_email,
          sms: formData.communication_preferences_sms,
          whatsapp: formData.communication_preferences_whatsapp
        })
      );

      // Debug: Log form data being submitted
      console.log('📤 Submitting form data:', {
        mode: isApplyMode ? 'apply' : 'create',
        fields: Array.from(submitData.entries()).map(([key, value]) => ({
          key,
          value:
            typeof value === 'string' && value.length > 50
              ? value.substring(0, 50) + '...'
              : value
        }))
      });

      // Call appropriate server action based on mode
      let result;
      if (isApplyMode) {
        // Public membership application
        result = await submitMemberRequest(submitData);
      } else {
        // Admin member creation/update
        result = isEdit
          ? await updateMember({ message: '', errors: {} }, submitData)
          : await createMember({ message: '', errors: {} }, submitData);
      }

      // Debug: Log result
      console.log('📥 Form submission result:', {
        success: result.success,
        message: result.message,
        errors: result.errors,
        hasRedirect: !!result.redirectTo
      });

      if (result.success) {
        toast.success(result.message);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
      } else {
        if (result.errors) {
          // Map preferred_chapter_id error back to chapter_id for apply mode
          const mappedErrors = { ...result.errors } as Record<string, string[]>;
          if (isApplyMode && mappedErrors.preferred_chapter_id) {
            console.log('📝 Mapping preferred_chapter_id error to chapter_id');
            mappedErrors.chapter_id = mappedErrors.preferred_chapter_id;
            delete mappedErrors.preferred_chapter_id;
          }

          console.log('📝 Setting errors:', mappedErrors);
          setErrors(mappedErrors);
          // Find which step has errors and navigate to it
          const errorFields = Object.keys(mappedErrors);
          if (
            errorFields.some((f) =>
              [
                'chapter_id',
                'membership_number',
                'member_since',
                'membership_status',
                'phone'
              ].includes(f)
            )
          ) {
            setCurrentStep(1);
          } else if (
            errorFields.some((f) =>
              [
                'company',
                'designation',
                'industry',
                'years_of_experience',
                'linkedin_url'
              ].includes(f)
            )
          ) {
            setCurrentStep(2);
          } else if (
            errorFields.some((f) =>
              [
                'date_of_birth',
                'gender',
                'address',
                'city',
                'state',
                'pincode',
                'country'
              ].includes(f)
            )
          ) {
            setCurrentStep(3);
          } else {
            setCurrentStep(4);
          }
        }
        toast.error(result.message || 'Failed to save member');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Progress Indicator */}
      <div className='relative'>
        <div className='flex items-center justify-between mb-8'>
          {STEPS.map((step, index) => (
            <div key={step.number} className='flex-1'>
              <div className='flex items-center'>
                <div className='flex flex-col items-center relative w-full'>
                  {/* Step Circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold z-10 transition-colors ${
                      currentStep > step.number
                        ? 'bg-primary text-primary-foreground'
                        : currentStep === step.number
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.number}
                  </div>

                  {/* Step Label */}
                  <div className='mt-2 text-center'>
                    <div
                      className={`text-sm font-medium ${
                        currentStep >= step.number
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className='text-xs text-muted-foreground hidden sm:block'>
                      {step.description}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div className='flex-1 h-0.5 -mt-12 mx-2'>
                    <div
                      className={`h-full transition-colors ${
                        currentStep > step.number ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className='space-y-6'>
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Essential member details and membership information
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                {/* Full Name (Apply Mode or New Member in Create Mode) */}
                {(isApplyMode || (!isEdit && !userId)) && (
                  <div className='space-y-2'>
                    <Label htmlFor='full_name'>Full Name *</Label>
                    <Input
                      id='full_name'
                      value={formData.full_name}
                      onChange={(e) =>
                        updateFormData('full_name', e.target.value)
                      }
                      placeholder={
                        isApplyMode
                          ? 'Enter your full name'
                          : 'Enter member full name'
                      }
                      required
                    />
                    {errors?.full_name && (
                      <p className='text-sm text-destructive'>
                        {errors.full_name[0]}
                      </p>
                    )}
                  </div>
                )}

                {/* Email (Apply Mode or New Member in Create Mode) */}
                {(isApplyMode || (!isEdit && !userId)) && (
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Email *</Label>
                    <Input
                      id='email'
                      type='email'
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      placeholder={
                        isApplyMode
                          ? 'your.email@gmail.com'
                          : 'member.email@gmail.com'
                      }
                      required
                    />
                    {errors?.email && (
                      <p className='text-sm text-destructive'>
                        {errors.email[0]}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {isApplyMode
                        ? "Use your Google email - you'll use this to login after approval"
                        : "Member's Google email - they will use this to login"}
                    </p>
                  </div>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='chapter_id'>
                    {isApplyMode ? 'Preferred Chapter *' : 'Chapter *'}
                  </Label>
                  <Select
                    value={formData.chapter_id}
                    onValueChange={(value) =>
                      updateFormData('chapter_id', value)
                    }
                  >
                    <SelectTrigger id='chapter_id' className='w-full'>
                      <SelectValue placeholder='Select chapter' />
                    </SelectTrigger>
                    <SelectContent>
                      {chapters.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          {chapter.name} - {chapter.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors?.chapter_id && (
                    <p className='text-sm text-destructive'>
                      {errors.chapter_id[0]}
                    </p>
                  )}
                </div>

                {/* Admin-only fields (hidden in apply mode) */}
                {!isApplyMode && (
                  <>
                    <div className='space-y-2'>
                      <Label htmlFor='membership_number'>
                        Membership Number
                      </Label>
                      <Input
                        id='membership_number'
                        value={formData.membership_number}
                        onChange={(e) =>
                          updateFormData('membership_number', e.target.value)
                        }
                        placeholder='YI-2024-001'
                      />
                      {errors?.membership_number && (
                        <p className='text-sm text-destructive'>
                          {errors.membership_number[0]}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='member_since'>Member Since</Label>
                      <Input
                        id='member_since'
                        type='date'
                        value={formData.member_since}
                        onChange={(e) =>
                          updateFormData('member_since', e.target.value)
                        }
                      />
                      {errors?.member_since && (
                        <p className='text-sm text-destructive'>
                          {errors.member_since[0]}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='membership_status'>
                        Membership Status
                      </Label>
                      <Select
                        value={formData.membership_status}
                        onValueChange={(value) =>
                          updateFormData('membership_status', value)
                        }
                      >
                        <SelectTrigger
                          id='membership_status'
                          className='w-full'
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='active'>Active</SelectItem>
                          <SelectItem value='inactive'>Inactive</SelectItem>
                          <SelectItem value='suspended'>Suspended</SelectItem>
                          <SelectItem value='alumni'>Alumni</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors?.membership_status && (
                        <p className='text-sm text-destructive'>
                          {errors.membership_status[0]}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='phone'>
                    Phone Number{isApplyMode && ' *'}
                  </Label>
                  <Input
                    id='phone'
                    type='tel'
                    value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)}
                    placeholder='+91 9876543210'
                    required={isApplyMode}
                  />
                  {errors?.phone && (
                    <p className='text-sm text-destructive'>
                      {errors.phone[0]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Professional Information */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
              <CardDescription>Career and work-related details</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='company'>Company</Label>
                  <Input
                    id='company'
                    value={formData.company}
                    onChange={(e) => updateFormData('company', e.target.value)}
                    placeholder='Acme Corporation'
                  />
                  {errors?.company && (
                    <p className='text-sm text-destructive'>
                      {errors.company[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='designation'>Designation</Label>
                  <Input
                    id='designation'
                    value={formData.designation}
                    onChange={(e) =>
                      updateFormData('designation', e.target.value)
                    }
                    placeholder='Software Engineer'
                  />
                  {errors?.designation && (
                    <p className='text-sm text-destructive'>
                      {errors.designation[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='industry'>Industry</Label>
                  <Input
                    id='industry'
                    value={formData.industry}
                    onChange={(e) => updateFormData('industry', e.target.value)}
                    placeholder='Technology'
                  />
                  {errors?.industry && (
                    <p className='text-sm text-destructive'>
                      {errors.industry[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='years_of_experience'>
                    Years of Experience
                  </Label>
                  <Input
                    id='years_of_experience'
                    type='number'
                    min='0'
                    max='70'
                    value={formData.years_of_experience}
                    onChange={(e) =>
                      updateFormData('years_of_experience', e.target.value)
                    }
                    placeholder='5'
                  />
                  {errors?.years_of_experience && (
                    <p className='text-sm text-destructive'>
                      {errors.years_of_experience[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='linkedin_url'>LinkedIn Profile</Label>
                  <Input
                    id='linkedin_url'
                    type='url'
                    value={formData.linkedin_url}
                    onChange={(e) =>
                      updateFormData('linkedin_url', e.target.value)
                    }
                    placeholder='https://linkedin.com/in/username'
                  />
                  {errors?.linkedin_url && (
                    <p className='text-sm text-destructive'>
                      {errors.linkedin_url[0]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Personal Information */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Personal details and emergency contact
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='date_of_birth'>Date of Birth</Label>
                  <Input
                    id='date_of_birth'
                    type='date'
                    value={formData.date_of_birth}
                    onChange={(e) =>
                      updateFormData('date_of_birth', e.target.value)
                    }
                  />
                  {errors?.date_of_birth && (
                    <p className='text-sm text-destructive'>
                      {errors.date_of_birth[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='gender'>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => updateFormData('gender', value)}
                  >
                    <SelectTrigger id='gender' className='w-full'>
                      <SelectValue placeholder='Select gender' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='male'>Male</SelectItem>
                      <SelectItem value='female'>Female</SelectItem>
                      <SelectItem value='other'>Other</SelectItem>
                      <SelectItem value='prefer_not_to_say'>
                        Prefer not to say
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors?.gender && (
                    <p className='text-sm text-destructive'>
                      {errors.gender[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='address'>Address</Label>
                  <Textarea
                    id='address'
                    value={formData.address}
                    onChange={(e) => updateFormData('address', e.target.value)}
                    placeholder='123 Main Street'
                    rows={2}
                  />
                  {errors?.address && (
                    <p className='text-sm text-destructive'>
                      {errors.address[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='city'>City{isApplyMode && ' *'}</Label>
                  <Input
                    id='city'
                    value={formData.city}
                    onChange={(e) => updateFormData('city', e.target.value)}
                    placeholder='Mumbai'
                    required={isApplyMode}
                  />
                  {errors?.city && (
                    <p className='text-sm text-destructive'>{errors.city[0]}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='state'>State{isApplyMode && ' *'}</Label>
                  <Input
                    id='state'
                    value={formData.state}
                    onChange={(e) => updateFormData('state', e.target.value)}
                    placeholder='Maharashtra'
                    required={isApplyMode}
                  />
                  {errors?.state && (
                    <p className='text-sm text-destructive'>
                      {errors.state[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='pincode'>Pincode</Label>
                  <Input
                    id='pincode'
                    value={formData.pincode}
                    onChange={(e) => updateFormData('pincode', e.target.value)}
                    placeholder='400001'
                  />
                  {errors?.pincode && (
                    <p className='text-sm text-destructive'>
                      {errors.pincode[0]}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='country'>Country</Label>
                  <Input
                    id='country'
                    value={formData.country}
                    onChange={(e) => updateFormData('country', e.target.value)}
                    placeholder='India'
                  />
                  {errors?.country && (
                    <p className='text-sm text-destructive'>
                      {errors.country[0]}
                    </p>
                  )}
                </div>
              </div>

              <div className='pt-4'>
                <h3 className='text-lg font-semibold mb-4'>
                  Emergency Contact
                </h3>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='emergency_contact_name'>Contact Name</Label>
                    <Input
                      id='emergency_contact_name'
                      value={formData.emergency_contact_name}
                      onChange={(e) =>
                        updateFormData('emergency_contact_name', e.target.value)
                      }
                      placeholder='John Doe'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='emergency_contact_phone'>
                      Contact Phone
                    </Label>
                    <Input
                      id='emergency_contact_phone'
                      type='tel'
                      value={formData.emergency_contact_phone}
                      onChange={(e) =>
                        updateFormData(
                          'emergency_contact_phone',
                          e.target.value
                        )
                      }
                      placeholder='+91 9876543210'
                    />
                  </div>

                  <div className='space-y-2 sm:col-span-2'>
                    <Label htmlFor='emergency_contact_relationship'>
                      Relationship
                    </Label>
                    <Input
                      id='emergency_contact_relationship'
                      value={formData.emergency_contact_relationship}
                      onChange={(e) =>
                        updateFormData(
                          'emergency_contact_relationship',
                          e.target.value
                        )
                      }
                      placeholder='Spouse, Parent, Sibling'
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preferences or About You */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isApplyMode ? 'About You' : 'Preferences & Communication'}
              </CardTitle>
              <CardDescription>
                {isApplyMode
                  ? 'Tell us about yourself and your interest in Yi'
                  : 'Communication preferences and interests'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {isApplyMode ? (
                /* Apply Mode: Motivation & How Did You Hear */
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='motivation'>
                      Why do you want to join Young Indians? *
                    </Label>
                    <Textarea
                      id='motivation'
                      value={formData.motivation}
                      onChange={(e) =>
                        updateFormData('motivation', e.target.value)
                      }
                      placeholder='Tell us about your interest in Young Indians, what you hope to contribute, and what you hope to gain from membership...'
                      rows={6}
                      required
                    />
                    {errors?.motivation && (
                      <p className='text-sm text-destructive'>
                        {errors.motivation[0]}
                      </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      Minimum 20 characters
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='how_did_you_hear'>
                      How did you hear about Young Indians?
                    </Label>
                    <Input
                      id='how_did_you_hear'
                      value={formData.how_did_you_hear}
                      onChange={(e) =>
                        updateFormData('how_did_you_hear', e.target.value)
                      }
                      placeholder='e.g., Friend referral, Social media, Website, Event...'
                    />
                    {errors?.how_did_you_hear && (
                      <p className='text-sm text-destructive'>
                        {errors.how_did_you_hear[0]}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Create Mode: Communication Preferences */
                <div className='space-y-4'>
                  <div>
                    <Label className='text-base'>
                      Communication Preferences
                    </Label>
                    <p className='text-sm text-muted-foreground mb-4'>
                      How would you like to receive communications?
                    </p>
                    <div className='space-y-3'>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='comm_email'
                          checked={formData.communication_preferences_email}
                          onCheckedChange={(checked) =>
                            updateFormData(
                              'communication_preferences_email',
                              checked
                            )
                          }
                        />
                        <Label htmlFor='comm_email' className='font-normal'>
                          Email notifications
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='comm_sms'
                          checked={formData.communication_preferences_sms}
                          onCheckedChange={(checked) =>
                            updateFormData(
                              'communication_preferences_sms',
                              checked
                            )
                          }
                        />
                        <Label htmlFor='comm_sms' className='font-normal'>
                          SMS notifications
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='comm_whatsapp'
                          checked={formData.communication_preferences_whatsapp}
                          onCheckedChange={(checked) =>
                            updateFormData(
                              'communication_preferences_whatsapp',
                              checked
                            )
                          }
                        />
                        <Label htmlFor='comm_whatsapp' className='font-normal'>
                          WhatsApp messages
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='notes'>Notes</Label>
                    <Textarea
                      id='notes'
                      value={formData.notes}
                      onChange={(e) => updateFormData('notes', e.target.value)}
                      placeholder='Any additional information about the member...'
                      rows={4}
                    />
                    {errors?.notes && (
                      <p className='text-sm text-destructive'>
                        {errors.notes[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className='flex justify-between gap-4'>
          <Button
            type='button'
            variant='outline'
            onClick={handlePrevious}
            disabled={currentStep === 1 || isSubmitting}
          >
            <ChevronLeft className='mr-2 h-4 w-4' />
            Previous
          </Button>

          <div className='flex gap-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            {currentStep < STEPS.length ? (
              <Button
                type='button'
                onClick={handleNext}
                disabled={isSubmitting}
              >
                Save & Next
                <ChevronRight className='ml-2 h-4 w-4' />
              </Button>
            ) : (
              <Button
                type='button'
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                )}
                {isApplyMode
                  ? 'Submit Application'
                  : isEdit
                  ? 'Update Member'
                  : 'Create Member'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
