/**
 * Trainer Profile Server Actions
 *
 * Server actions for Trainer Profile mutations.
 * All mutations use Zod validation and cache invalidation.
 */

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { FormState } from '@/types';
import type { CreateTrainerProfileInput, UpdateTrainerProfileInput } from '@/types/trainer';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createTrainerProfileSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  chapter_id: z.string().uuid('Invalid chapter ID'),
  is_trainer_eligible: z.boolean().default(true),
  eligible_verticals: z.array(z.string()).optional().default([]),
  eligible_session_types: z.array(z.string()).optional().default([]),
  preferred_session_types: z.array(z.string()).optional().default([]),
  preferred_age_groups: z.array(z.string()).optional().default([]),
  max_sessions_per_month: z.number().min(1).max(30).optional().nullable(),
});

const updateTrainerProfileSchema = z.object({
  id: z.string().uuid('Invalid trainer profile ID'),
  is_trainer_eligible: z.boolean().optional(),
  eligible_verticals: z.array(z.string()).optional(),
  eligible_session_types: z.array(z.string()).optional(),
  distribution_status: z.enum(['active', 'inactive', 'on_leave', 'maxed_out']).optional(),
  preferred_session_types: z.array(z.string()).optional(),
  preferred_age_groups: z.array(z.string()).optional(),
  max_sessions_per_month: z.number().min(1).max(30).optional().nullable(),
});

const addTrainerCertificationSchema = z.object({
  trainer_profile_id: z.string().uuid('Invalid trainer profile ID'),
  certification_name: z.string().min(2, 'Certification name is required'),
  issuing_organization: z.string().min(2, 'Issuing organization is required'),
  certificate_number: z.string().optional().nullable(),
  issued_date: z.string().min(1, 'Issue date is required'),
  expiry_date: z.string().optional().nullable(),
  document_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// TRAINER PROFILE ACTIONS
// ============================================================================

/**
 * Create a trainer profile for a member
 */
export async function createTrainerProfile(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  // Parse form data
  const formDataObject = {
    member_id: formData.get('member_id') as string,
    chapter_id: formData.get('chapter_id') as string,
    is_trainer_eligible: formData.get('is_trainer_eligible') === 'true',
    eligible_verticals: formData.get('eligible_verticals')
      ? JSON.parse(formData.get('eligible_verticals') as string)
      : [],
    eligible_session_types: formData.get('eligible_session_types')
      ? JSON.parse(formData.get('eligible_session_types') as string)
      : [],
    preferred_session_types: formData.get('preferred_session_types')
      ? JSON.parse(formData.get('preferred_session_types') as string)
      : [],
    preferred_age_groups: formData.get('preferred_age_groups')
      ? JSON.parse(formData.get('preferred_age_groups') as string)
      : [],
    max_sessions_per_month: formData.get('max_sessions_per_month')
      ? Number(formData.get('max_sessions_per_month'))
      : null,
  };

  // Validate input
  const validation = createTrainerProfileSchema.safeParse(formDataObject);

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.',
    };
  }

  // Check if trainer profile already exists
  const { data: existing } = await supabase
    .from('trainer_profiles')
    .select('id')
    .eq('member_id', validation.data.member_id)
    .single();

  if (existing) {
    return {
      message: 'A trainer profile already exists for this member.',
    };
  }

  // Create trainer profile
  const { data, error } = await supabase
    .from('trainer_profiles')
    .insert({
      member_id: validation.data.member_id,
      chapter_id: validation.data.chapter_id,
      is_trainer_eligible: validation.data.is_trainer_eligible,
      eligible_verticals: validation.data.eligible_verticals,
      eligible_session_types: validation.data.eligible_session_types,
      preferred_session_types: validation.data.preferred_session_types,
      preferred_age_groups: validation.data.preferred_age_groups,
      max_sessions_per_month: validation.data.max_sessions_per_month,
      distribution_status: 'active',
      total_sessions: 0,
      total_students_impacted: 0,
      sessions_this_month: 0,
      sessions_this_quarter: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating trainer profile:', error);
    return {
      message: error.message || 'Failed to create trainer profile. Please try again.',
    };
  }

  // Revalidate caches
  revalidatePath(`/members/${validation.data.member_id}`);
  revalidateTag('trainers', 'max');
  revalidateTag('members-list', 'max');

  return {
    success: true,
    message: 'Trainer profile created successfully!',
    data: { id: data.id },
  };
}

/**
 * Update a trainer profile
 */
export async function updateTrainerProfile(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const formDataObject = {
    id: formData.get('id') as string,
    is_trainer_eligible: formData.get('is_trainer_eligible')
      ? formData.get('is_trainer_eligible') === 'true'
      : undefined,
    eligible_verticals: formData.get('eligible_verticals')
      ? JSON.parse(formData.get('eligible_verticals') as string)
      : undefined,
    eligible_session_types: formData.get('eligible_session_types')
      ? JSON.parse(formData.get('eligible_session_types') as string)
      : undefined,
    distribution_status: formData.get('distribution_status') as any || undefined,
    preferred_session_types: formData.get('preferred_session_types')
      ? JSON.parse(formData.get('preferred_session_types') as string)
      : undefined,
    preferred_age_groups: formData.get('preferred_age_groups')
      ? JSON.parse(formData.get('preferred_age_groups') as string)
      : undefined,
    max_sessions_per_month: formData.get('max_sessions_per_month')
      ? Number(formData.get('max_sessions_per_month'))
      : undefined,
  };

  const validation = updateTrainerProfileSchema.safeParse(formDataObject);

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.',
    };
  }

  // Build update object with only defined fields
  const updateData: Record<string, any> = {};
  if (validation.data.is_trainer_eligible !== undefined) {
    updateData.is_trainer_eligible = validation.data.is_trainer_eligible;
  }
  if (validation.data.eligible_verticals !== undefined) {
    updateData.eligible_verticals = validation.data.eligible_verticals;
  }
  if (validation.data.eligible_session_types !== undefined) {
    updateData.eligible_session_types = validation.data.eligible_session_types;
  }
  if (validation.data.distribution_status !== undefined) {
    updateData.distribution_status = validation.data.distribution_status;
  }
  if (validation.data.preferred_session_types !== undefined) {
    updateData.preferred_session_types = validation.data.preferred_session_types;
  }
  if (validation.data.preferred_age_groups !== undefined) {
    updateData.preferred_age_groups = validation.data.preferred_age_groups;
  }
  if (validation.data.max_sessions_per_month !== undefined) {
    updateData.max_sessions_per_month = validation.data.max_sessions_per_month;
  }

  const { error } = await supabase
    .from('trainer_profiles')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    console.error('Error updating trainer profile:', error);
    return {
      message: error.message || 'Failed to update trainer profile. Please try again.',
    };
  }

  // Revalidate caches
  revalidateTag('trainers', 'max');
  revalidateTag('members-list', 'max');

  return {
    success: true,
    message: 'Trainer profile updated successfully!',
  };
}

/**
 * Add a certification to a trainer profile
 */
export async function addTrainerCertification(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const formDataObject = {
    trainer_profile_id: formData.get('trainer_profile_id') as string,
    certification_name: formData.get('certification_name') as string,
    issuing_organization: formData.get('issuing_organization') as string,
    certificate_number: formData.get('certificate_number') as string || null,
    issued_date: formData.get('issued_date') as string,
    expiry_date: formData.get('expiry_date') as string || null,
    document_url: formData.get('document_url') as string || null,
    notes: formData.get('notes') as string || null,
  };

  const validation = addTrainerCertificationSchema.safeParse(formDataObject);

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.',
    };
  }

  const { error } = await supabase
    .from('trainer_certifications')
    .insert({
      trainer_profile_id: validation.data.trainer_profile_id,
      certification_name: validation.data.certification_name,
      issuing_organization: validation.data.issuing_organization,
      certificate_number: validation.data.certificate_number,
      issued_date: validation.data.issued_date,
      expiry_date: validation.data.expiry_date,
      document_url: validation.data.document_url,
      notes: validation.data.notes,
      is_verified: false,
    });

  if (error) {
    console.error('Error adding trainer certification:', error);
    return {
      message: error.message || 'Failed to add certification. Please try again.',
    };
  }

  // Revalidate caches
  revalidateTag('trainers', 'max');

  return {
    success: true,
    message: 'Certification added successfully!',
  };
}

/**
 * Delete a trainer profile
 */
export async function deleteTrainerProfile(
  profileId: string
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  // First delete all certifications
  await supabase
    .from('trainer_certifications')
    .delete()
    .eq('trainer_profile_id', profileId);

  // Then delete the profile
  const { error } = await supabase
    .from('trainer_profiles')
    .delete()
    .eq('id', profileId);

  if (error) {
    console.error('Error deleting trainer profile:', error);
    return {
      message: error.message || 'Failed to delete trainer profile. Please try again.',
    };
  }

  // Revalidate caches
  revalidateTag('trainers', 'max');
  revalidateTag('members-list', 'max');

  return {
    success: true,
    message: 'Trainer profile deleted successfully!',
  };
}
