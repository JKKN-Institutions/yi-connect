/**
 * Industry Portal Server Actions
 *
 * Server actions for industry portal operations including
 * profile updates, user management, and security settings.
 */

'use server';

import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { FormState } from '@/types';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateIndustryProfileSchema = z.object({
  industry_id: z.string().uuid(),
  company_name: z.string().min(1, 'Company name is required'),
  industry_sector: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  website: z.string().url().optional().or(z.literal('')),
  employee_count: z.coerce.number().optional(),
  has_csr_program: z.boolean().optional(),
  csr_focus_areas: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const upsertPortalUserSchema = z.object({
  industry_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  email: z.string().email('Valid email is required'),
  full_name: z.string().optional(),
  role: z.enum(['admin', 'manager', 'user']).optional(),
  status: z.enum(['invited', 'active', 'inactive', 'suspended']).optional(),
  permissions: z.object({
    add_slot: z.boolean(),
    edit_slot: z.boolean(),
    cancel_slot: z.boolean(),
    view_bookings: z.boolean(),
    export_attendees: z.boolean(),
  }),
});

const changePasswordSchema = z.object({
  email: z.string().email(),
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

// ============================================================================
// Industry Profile Actions
// ============================================================================

/**
 * Update industry profile
 */
export async function updateIndustryProfile(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { message: 'You must be logged in to update the profile.' };
    }

    // Parse CSR focus areas
    const csrFocusAreas = formData.getAll('csr_focus_areas').filter(Boolean) as string[];

    const validation = updateIndustryProfileSchema.safeParse({
      industry_id: formData.get('industry_id'),
      company_name: formData.get('company_name'),
      industry_sector: formData.get('industry_sector') || undefined,
      address_line1: formData.get('address_line1') || undefined,
      city: formData.get('city'),
      state: formData.get('state'),
      website: formData.get('website') || undefined,
      employee_count: formData.get('employee_count') ? Number(formData.get('employee_count')) : undefined,
      has_csr_program: formData.get('has_csr_program') === 'on',
      csr_focus_areas: csrFocusAreas.length > 0 ? csrFocusAreas : undefined,
      notes: formData.get('notes') || undefined,
    });

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.',
      };
    }

    const { industry_id, ...updateData } = validation.data;

    // Update industry
    const { error } = await supabase
      .from('industries')
      .update({
        company_name: updateData.company_name,
        industry_sector: updateData.industry_sector,
        address_line1: updateData.address_line1,
        city: updateData.city,
        state: updateData.state,
        website: updateData.website,
        employee_count: updateData.employee_count,
        has_csr_program: updateData.has_csr_program,
        csr_focus_areas: updateData.csr_focus_areas,
        notes: updateData.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', industry_id);

    if (error) {
      return { message: error.message || 'Failed to update profile.' };
    }

    revalidatePath('/industry-portal/settings');

    return {
      success: true,
      message: 'Company profile updated successfully!',
    };
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}

// ============================================================================
// Portal User Management Actions
// ============================================================================

/**
 * Add or update industry portal user
 */
export async function upsertIndustryPortalUser(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { message: 'You must be logged in to manage users.' };
    }

    // Build permissions object
    const permissions = {
      add_slot: formData.get('permission_add_slot') === 'on',
      edit_slot: formData.get('permission_edit_slot') === 'on',
      cancel_slot: formData.get('permission_cancel_slot') === 'on',
      view_bookings: formData.get('permission_view_bookings') === 'on',
      export_attendees: formData.get('permission_export_attendees') === 'on',
    };

    const validation = upsertPortalUserSchema.safeParse({
      industry_id: formData.get('industry_id'),
      user_id: formData.get('user_id') || undefined,
      email: formData.get('email'),
      full_name: formData.get('full_name') || undefined,
      role: formData.get('role') || 'user',
      status: formData.get('status') || 'invited',
      permissions,
    });

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.',
      };
    }

    const { user_id, ...data } = validation.data;
    const isEditing = !!user_id;

    if (isEditing) {
      // Update existing user
      const { error } = await supabase
        .from('industry_portal_users')
        .update({
          full_name: data.full_name,
          role: data.role,
          status: data.status,
          permissions: data.permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (error) {
        return { message: error.message || 'Failed to update user.' };
      }

      revalidatePath('/industry-portal/settings');

      return {
        success: true,
        message: 'User updated successfully!',
      };
    } else {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('industry_portal_users')
        .select('id')
        .eq('email', data.email)
        .eq('industry_id', data.industry_id)
        .single();

      if (existing) {
        return { message: 'This email is already associated with your portal.' };
      }

      // Create new portal user
      const { error } = await supabase
        .from('industry_portal_users')
        .insert({
          industry_id: data.industry_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          status: 'invited',
          permissions: data.permissions,
          invitation_sent_at: new Date().toISOString(),
          created_by: user.id,
        });

      if (error) {
        return { message: error.message || 'Failed to invite user.' };
      }

      // TODO: Send invitation email

      revalidatePath('/industry-portal/settings');

      return {
        success: true,
        message: `Invitation sent to ${data.email}!`,
      };
    }
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}

// ============================================================================
// Security Actions
// ============================================================================

/**
 * Change user password
 */
export async function changePassword(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createClient();

    const validation = changePasswordSchema.safeParse({
      email: formData.get('email'),
      current_password: formData.get('current_password'),
      new_password: formData.get('new_password'),
      confirm_password: formData.get('confirm_password'),
    });

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.',
      };
    }

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.current_password,
    });

    if (signInError) {
      return {
        errors: { current_password: ['Current password is incorrect'] },
        message: 'Current password is incorrect.',
      };
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: validation.data.new_password,
    });

    if (updateError) {
      return { message: updateError.message || 'Failed to update password.' };
    }

    return {
      success: true,
      message: 'Password updated successfully!',
    };
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}
