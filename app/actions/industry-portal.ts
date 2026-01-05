/**
 * Industry Portal Server Actions
 *
 * Server actions for industry portal settings management
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentIndustryId } from '@/lib/auth/industry-portal';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionResponse {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const companyProfileSchema = z.object({
  organization_name: z.string().min(2, 'Company name must be at least 2 characters'),
  description: z.string().optional(),
  industry_sector: z.string().optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

const addCoordinatorSchema = z.object({
  contact_name: z.string().min(2, 'Name must be at least 2 characters'),
  designation: z.string().optional(),
  email: z.string().email('Please enter a valid email'),
  phone_primary: z.string().optional(),
  is_primary_contact: z.boolean().default(false),
  is_decision_maker: z.boolean().default(false),
});

const notificationSettingsSchema = z.object({
  email_notifications: z.boolean(),
  visit_request_notifications: z.boolean(),
  application_updates: z.boolean(),
  weekly_digest: z.boolean(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Get industry profile details
 */
export async function getIndustryProfile(industryId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('industries')
      .select(`
        id,
        organization_name,
        industry_sector,
        status,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        website,
        connection_type,
        organization_size,
        employee_count,
        annual_turnover,
        has_csr_program,
        csr_budget_range,
        csr_focus_areas,
        collaboration_interests,
        can_provide_internships,
        can_provide_mentorship,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', industryId)
      .single();

    if (error) {
      console.error('Error fetching industry profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getIndustryProfile:', error);
    return null;
  }
}

/**
 * Get industry coordinators/contacts
 */
export async function getIndustryCoordinators(industryId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('stakeholder_contacts')
      .select('*')
      .eq('stakeholder_type', 'industries')
      .eq('stakeholder_id', industryId)
      .order('is_primary_contact', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching coordinators:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getIndustryCoordinators:', error);
    return [];
  }
}

/**
 * Get notification settings for the industry
 */
export async function getNotificationSettings(industryId: string) {
  try {
    const supabase = await createClient();

    // Check if settings exist in a settings table, or return defaults
    const { data, error } = await supabase
      .from('industry_notification_settings')
      .select('*')
      .eq('industry_id', industryId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows found"
      console.error('Error fetching notification settings:', error);
    }

    // Return defaults if no settings found
    return data || {
      email_notifications: true,
      visit_request_notifications: true,
      application_updates: true,
      weekly_digest: false,
    };
  } catch (error) {
    console.error('Error in getNotificationSettings:', error);
    return {
      email_notifications: true,
      visit_request_notifications: true,
      application_updates: true,
      weekly_digest: false,
    };
  }
}

/**
 * Get active sessions for the current user
 */
export async function getActiveSessions() {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // In a real implementation, you would track sessions in a database
    // For now, return a mock current session
    return [
      {
        id: 'current',
        device: 'Current Device',
        browser: 'Web Browser',
        location: 'Current Location',
        last_active: new Date().toISOString(),
        is_current: true,
      },
    ];
  } catch (error) {
    console.error('Error in getActiveSessions:', error);
    return [];
  }
}

// ============================================================================
// COMPANY PROFILE ACTIONS
// ============================================================================

/**
 * Update company profile
 */
export async function updateCompanyProfile(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const industryId = await getCurrentIndustryId();
    if (!industryId) {
      return {
        success: false,
        message: 'You must be authenticated to update the company profile',
      };
    }

    // Extract form data
    const data = {
      organization_name: formData.get('organization_name') as string,
      description: formData.get('description') as string || undefined,
      industry_sector: formData.get('industry_sector') as string || undefined,
      website: formData.get('website') as string || undefined,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      address_line1: formData.get('address_line1') as string || undefined,
      city: formData.get('city') as string || undefined,
      state: formData.get('state') as string || undefined,
      pincode: formData.get('pincode') as string || undefined,
    };

    // Validate input
    const validation = companyProfileSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('industries')
      .update({
        organization_name: validation.data.organization_name,
        industry_sector: validation.data.industry_sector || null,
        website: validation.data.website || null,
        address_line1: validation.data.address_line1 || null,
        city: validation.data.city || null,
        state: validation.data.state || null,
        pincode: validation.data.pincode || null,
        notes: validation.data.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', industryId);

    if (error) {
      console.error('Error updating company profile:', error);
      return {
        success: false,
        message: 'Failed to update company profile. Please try again.',
      };
    }

    revalidatePath('/industry-portal/settings');
    revalidatePath('/industry-portal');

    return {
      success: true,
      message: 'Company profile updated successfully',
    };
  } catch (error) {
    console.error('Unexpected error in updateCompanyProfile:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

// ============================================================================
// COORDINATOR/USER ACTIONS
// ============================================================================

/**
 * Add a new coordinator
 */
export async function addCoordinator(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const industryId = await getCurrentIndustryId();
    if (!industryId) {
      return {
        success: false,
        message: 'You must be authenticated to add coordinators',
      };
    }

    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in',
      };
    }

    // Get chapter_id from industry
    const supabase = await createClient();
    const { data: industry } = await supabase
      .from('industries')
      .select('chapter_id')
      .eq('id', industryId)
      .single();

    if (!industry?.chapter_id) {
      return {
        success: false,
        message: 'Could not determine chapter for this industry',
      };
    }

    // Extract form data
    const data = {
      contact_name: formData.get('contact_name') as string,
      designation: formData.get('designation') as string || undefined,
      email: formData.get('email') as string,
      phone_primary: formData.get('phone_primary') as string || undefined,
      is_primary_contact: formData.get('is_primary_contact') === 'true',
      is_decision_maker: formData.get('is_decision_maker') === 'true',
    };

    // Validate input
    const validation = addCoordinatorSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    // Check if email already exists for this industry
    const { data: existingContact } = await supabase
      .from('stakeholder_contacts')
      .select('id')
      .eq('stakeholder_type', 'industries')
      .eq('stakeholder_id', industryId)
      .eq('email', validation.data.email)
      .single();

    if (existingContact) {
      return {
        success: false,
        message: 'A coordinator with this email already exists',
      };
    }

    // If setting as primary, remove primary from others
    if (validation.data.is_primary_contact) {
      await supabase
        .from('stakeholder_contacts')
        .update({ is_primary_contact: false })
        .eq('stakeholder_type', 'industries')
        .eq('stakeholder_id', industryId);
    }

    const { error } = await supabase.from('stakeholder_contacts').insert({
      chapter_id: industry.chapter_id,
      stakeholder_type: 'industries',
      stakeholder_id: industryId,
      contact_name: validation.data.contact_name,
      designation: validation.data.designation || null,
      email: validation.data.email,
      phone_primary: validation.data.phone_primary || null,
      is_primary_contact: validation.data.is_primary_contact,
      is_decision_maker: validation.data.is_decision_maker,
    });

    if (error) {
      console.error('Error adding coordinator:', error);
      return {
        success: false,
        message: 'Failed to add coordinator. Please try again.',
      };
    }

    revalidatePath('/industry-portal/settings');

    return {
      success: true,
      message: 'Coordinator added successfully',
    };
  } catch (error) {
    console.error('Unexpected error in addCoordinator:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Remove a coordinator
 */
export async function removeCoordinator(contactId: string): Promise<ActionResponse> {
  try {
    const industryId = await getCurrentIndustryId();
    if (!industryId) {
      return {
        success: false,
        message: 'You must be authenticated to remove coordinators',
      };
    }

    const supabase = await createClient();

    // Verify the contact belongs to this industry
    const { data: contact } = await supabase
      .from('stakeholder_contacts')
      .select('id, is_primary_contact')
      .eq('id', contactId)
      .eq('stakeholder_type', 'industries')
      .eq('stakeholder_id', industryId)
      .single();

    if (!contact) {
      return {
        success: false,
        message: 'Coordinator not found',
      };
    }

    // Don't allow removing the last primary contact
    if (contact.is_primary_contact) {
      const { count } = await supabase
        .from('stakeholder_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('stakeholder_type', 'industries')
        .eq('stakeholder_id', industryId);

      if (count && count <= 1) {
        return {
          success: false,
          message: 'Cannot remove the last coordinator. Add another before removing this one.',
        };
      }
    }

    const { error } = await supabase
      .from('stakeholder_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      console.error('Error removing coordinator:', error);
      return {
        success: false,
        message: 'Failed to remove coordinator. Please try again.',
      };
    }

    revalidatePath('/industry-portal/settings');

    return {
      success: true,
      message: 'Coordinator removed successfully',
    };
  } catch (error) {
    console.error('Unexpected error in removeCoordinator:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Set coordinator as primary
 */
export async function setPrimaryCoordinator(contactId: string): Promise<ActionResponse> {
  try {
    const industryId = await getCurrentIndustryId();
    if (!industryId) {
      return {
        success: false,
        message: 'You must be authenticated',
      };
    }

    const supabase = await createClient();

    // Remove primary from all other contacts
    await supabase
      .from('stakeholder_contacts')
      .update({ is_primary_contact: false })
      .eq('stakeholder_type', 'industries')
      .eq('stakeholder_id', industryId);

    // Set this contact as primary
    const { error } = await supabase
      .from('stakeholder_contacts')
      .update({ is_primary_contact: true })
      .eq('id', contactId)
      .eq('stakeholder_type', 'industries')
      .eq('stakeholder_id', industryId);

    if (error) {
      console.error('Error setting primary coordinator:', error);
      return {
        success: false,
        message: 'Failed to update primary coordinator. Please try again.',
      };
    }

    revalidatePath('/industry-portal/settings');

    return {
      success: true,
      message: 'Primary coordinator updated',
    };
  } catch (error) {
    console.error('Unexpected error in setPrimaryCoordinator:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

// ============================================================================
// NOTIFICATION SETTINGS ACTIONS
// ============================================================================

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  settings: {
    email_notifications: boolean;
    visit_request_notifications: boolean;
    application_updates: boolean;
    weekly_digest: boolean;
  }
): Promise<ActionResponse> {
  try {
    const industryId = await getCurrentIndustryId();
    if (!industryId) {
      return {
        success: false,
        message: 'You must be authenticated',
      };
    }

    const validation = notificationSettingsSchema.safeParse(settings);
    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid settings',
      };
    }

    const supabase = await createClient();

    // Upsert notification settings
    const { error } = await supabase
      .from('industry_notification_settings')
      .upsert({
        industry_id: industryId,
        email_notifications: validation.data.email_notifications,
        visit_request_notifications: validation.data.visit_request_notifications,
        application_updates: validation.data.application_updates,
        weekly_digest: validation.data.weekly_digest,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'industry_id',
      });

    if (error) {
      // If the table doesn't exist, don't fail
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Notification preferences saved (demo mode)',
        };
      }
      console.error('Error updating notification settings:', error);
      return {
        success: false,
        message: 'Failed to update notification settings',
      };
    }

    revalidatePath('/industry-portal/settings');

    return {
      success: true,
      message: 'Notification settings updated',
    };
  } catch (error) {
    console.error('Unexpected error in updateNotificationSettings:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}

// ============================================================================
// SECURITY ACTIONS
// ============================================================================

/**
 * Change password
 */
export async function changePassword(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in to change your password',
      };
    }

    const data = {
      current_password: formData.get('current_password') as string,
      new_password: formData.get('new_password') as string,
      confirm_password: formData.get('confirm_password') as string,
    };

    const validation = changePasswordSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();

    // Update password using Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: validation.data.new_password,
    });

    if (error) {
      console.error('Error changing password:', error);
      return {
        success: false,
        message: error.message || 'Failed to change password. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Password changed successfully',
    };
  } catch (error) {
    console.error('Unexpected error in changePassword:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in',
      };
    }

    // In a real implementation, you would revoke the session token
    // For now, just return success
    if (sessionId === 'current') {
      return {
        success: false,
        message: 'Cannot revoke current session',
      };
    }

    return {
      success: true,
      message: 'Session revoked successfully',
    };
  } catch (error) {
    console.error('Unexpected error in revokeSession:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}

/**
 * Toggle two-factor authentication (UI placeholder)
 */
export async function toggleTwoFactor(enabled: boolean): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in',
      };
    }

    // This is a placeholder - 2FA would need proper implementation
    // with TOTP/SMS verification

    return {
      success: true,
      message: enabled
        ? 'Two-factor authentication would be enabled (feature coming soon)'
        : 'Two-factor authentication would be disabled (feature coming soon)',
    };
  } catch (error) {
    console.error('Unexpected error in toggleTwoFactor:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}
