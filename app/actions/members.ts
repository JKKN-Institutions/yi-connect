/**
 * Member Server Actions
 *
 * Server actions for Member Intelligence Hub mutations.
 * All mutations use Zod validation and cache invalidation.
 */

'use server';

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import {
  createMemberSchema,
  updateMemberSchema,
  addMemberSkillSchema,
  updateMemberSkillSchema,
  deleteMemberSkillSchema,
  addMemberCertificationSchema,
  updateMemberCertificationSchema,
  deleteMemberCertificationSchema,
  setAvailabilitySchema,
  deleteAvailabilitySchema,
  createSkillSchema,
  updateSkillSchema,
  deleteSkillSchema,
  createCertificationSchema,
  updateCertificationSchema,
  deleteCertificationSchema
} from '@/lib/validations/member';
import type { FormState } from '@/types';

// ============================================================================
// Member Actions
// ============================================================================

/**
 * Create a new member
 */
export async function createMember(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  // Check if this is an admin creating a new member (no id provided)
  let userId = formData.get('id') as string | null;
  const email = formData.get('email') as string;
  // Always store full_name in UPPERCASE
  const fullName = (formData.get('full_name') as string)?.toUpperCase().trim() || '';
  let isNewUser = false;

  // If no userId provided, create a new auth user (admin creating member)
  if (!userId && email && fullName) {
    isNewUser = true;
    console.log('Admin creating new member - creating auth user first');

    // Get the chapter_id from form data to add to approved_emails
    const chapterId = formData.get('chapter_id') as string;

    // Get current user for approved_by field
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // 1. Add email to approved_emails whitelist (required by handle_new_user trigger)
    const { error: whitelistError } = await supabase.from('approved_emails').insert({
      email,
      assigned_chapter_id: chapterId || null,
      approved_by: currentUser?.id || null,
      approved_at: new Date().toISOString(),
      is_active: true,
      member_created: false
    });

    if (whitelistError) {
      console.error('Failed to add email to whitelist:', whitelistError);
      // Continue anyway - email might already be in whitelist
    }

    // Use admin client to create user (requires service role key)
    const adminClient = createAdminSupabaseClient();

    // 2. Create a new auth user via Admin API (this will trigger handle_new_user())
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName
      }
    });

    if (createUserError || !newUser.user) {
      console.error('Failed to create auth user:', createUserError);
      return {
        message: createUserError?.message || 'Failed to create user account. Please try again.'
      };
    }

    userId = newUser.user.id;
    console.log('Created new auth user with ID:', userId);

    // Note: Profile is automatically created by handle_new_user() trigger

    // 3. Send password reset email so the user can set their password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback?type=recovery`
    });

    if (resetError) {
      console.error('Failed to send password reset email:', resetError);
      // Don't fail the whole operation if email fails
    }
  }

  const formDataObject = {
    id: userId,
    email,
    full_name: fullName,
    phone: formData.get('phone'),
    chapter_id: formData.get('chapter_id'),
    membership_number: formData.get('membership_number'),
    member_since: formData.get('member_since'),
    membership_status: formData.get('membership_status'),
    company: formData.get('company'),
    designation: formData.get('designation'),
    industry: formData.get('industry'),
    years_of_experience: formData.get('years_of_experience')
      ? Number(formData.get('years_of_experience'))
      : undefined,
    linkedin_url: formData.get('linkedin_url'),
    date_of_birth: formData.get('date_of_birth'),
    gender: formData.get('gender'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
    pincode: formData.get('pincode'),
    emergency_contact_name: formData.get('emergency_contact_name'),
    emergency_contact_phone: formData.get('emergency_contact_phone'),
    emergency_contact_relationship: formData.get(
      'emergency_contact_relationship'
    ),
    interests: formData.get('interests')
      ? JSON.parse(formData.get('interests') as string)
      : undefined,
    preferred_event_types: formData.get('preferred_event_types')
      ? JSON.parse(formData.get('preferred_event_types') as string)
      : undefined,
    communication_preferences: formData.get('communication_preferences')
      ? JSON.parse(formData.get('communication_preferences') as string)
      : undefined,
    notes: formData.get('notes')
  };

  const validation = createMemberSchema.safeParse(formDataObject);

  if (!validation.success) {
    console.error('Validation failed:', validation.error.flatten());
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const { error } = await supabase.from('members').insert({
    id: validation.data.id,
    chapter_id: validation.data.chapter_id || null,
    membership_number: validation.data.membership_number || null,
    member_since:
      validation.data.member_since || new Date().toISOString().split('T')[0],
    membership_status: validation.data.membership_status || 'active',
    company: validation.data.company || null,
    designation: validation.data.designation || null,
    industry: validation.data.industry || null,
    years_of_experience: validation.data.years_of_experience || null,
    linkedin_url: validation.data.linkedin_url || null,
    date_of_birth: validation.data.date_of_birth || null,
    gender: validation.data.gender || null,
    address: validation.data.address || null,
    city: validation.data.city || null,
    state: validation.data.state || null,
    country: validation.data.country || 'India',
    pincode: validation.data.pincode || null,
    emergency_contact_name: validation.data.emergency_contact_name || null,
    emergency_contact_phone: validation.data.emergency_contact_phone || null,
    emergency_contact_relationship:
      validation.data.emergency_contact_relationship || null,
    interests: validation.data.interests || null,
    preferred_event_types: validation.data.preferred_event_types || null,
    communication_preferences: validation.data.communication_preferences || {
      email: true,
      sms: true,
      whatsapp: true
    },
    notes: validation.data.notes || null
  });

  if (error) {
    return {
      message: error.message || 'Failed to create member. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag(`member-${validation.data.id}`, 'max');
  revalidateTag('analytics-all', 'max');
  if (validation.data.chapter_id) {
    revalidateTag(`analytics-${validation.data.chapter_id}`, 'max');
  }

  const successMessage = isNewUser
    ? 'Member created successfully! A password reset email has been sent to the member.'
    : 'Member created successfully!';

  return {
    success: true,
    message: successMessage,
    redirectTo: '/members'
  };
}

/**
 * Update an existing member
 */
export async function updateMember(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = updateMemberSchema.safeParse({
    id: formData.get('id'),
    chapter_id: formData.get('chapter_id'),
    membership_number: formData.get('membership_number'),
    member_since: formData.get('member_since'),
    membership_status: formData.get('membership_status'),
    company: formData.get('company'),
    designation: formData.get('designation'),
    industry: formData.get('industry'),
    years_of_experience: formData.get('years_of_experience')
      ? Number(formData.get('years_of_experience'))
      : undefined,
    linkedin_url: formData.get('linkedin_url'),
    date_of_birth: formData.get('date_of_birth'),
    gender: formData.get('gender'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
    pincode: formData.get('pincode'),
    emergency_contact_name: formData.get('emergency_contact_name'),
    emergency_contact_phone: formData.get('emergency_contact_phone'),
    emergency_contact_relationship: formData.get(
      'emergency_contact_relationship'
    ),
    interests: formData.get('interests')
      ? JSON.parse(formData.get('interests') as string)
      : undefined,
    preferred_event_types: formData.get('preferred_event_types')
      ? JSON.parse(formData.get('preferred_event_types') as string)
      : undefined,
    communication_preferences: formData.get('communication_preferences')
      ? JSON.parse(formData.get('communication_preferences') as string)
      : undefined,
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Build update object (only include defined fields)
  const updateData: any = {};
  Object.entries(validation.data).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      updateData[key] = value;
    }
  });

  const { error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    return {
      message: error.message || 'Failed to update member. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag(`member-${validation.data.id}`, 'max');
  revalidateTag('analytics-all', 'max');
  if (validation.data.chapter_id) {
    revalidateTag(`analytics-${validation.data.chapter_id}`, 'max');
  }

  return {
    success: true,
    message: 'Member updated successfully!',
    redirectTo: `/members/${validation.data.id}`
  };
}

/**
 * Delete a member (soft delete by setting is_active = false)
 * Used from member detail page - redirects after deletion
 */
export async function deleteMember(memberId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('members')
    .update({ is_active: false })
    .eq('id', memberId);

  if (error) {
    return {
      message: error.message || 'Failed to delete member. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag(`member-${memberId}`, 'max');
  revalidateTag('analytics-all', 'max');

  redirect('/members');
}

/**
 * Deactivate a member (soft disable in both members and profiles tables)
 * The member can no longer login but data is preserved
 * Super Admin, National Admin, Chair, and Co-Chair can perform this action
 */
export async function deactivateMemberFromTable(
  memberId: string
): Promise<{ success: boolean; message: string }> {
  // Check permission - Super Admin, National Admin, Chair, Co-Chair can deactivate
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);
  } catch {
    return {
      success: false,
      message: 'You do not have permission to deactivate members.'
    };
  }

  const adminClient = createAdminSupabaseClient();

  // First get member info for the message
  const { data: member } = await adminClient
    .from('members')
    .select('id, profiles!inner(full_name, email)')
    .eq('id', memberId)
    .single();

  if (!member) {
    return {
      success: false,
      message: 'Member not found.'
    };
  }

  const memberName = (member?.profiles as any)?.full_name || 'Member';
  const memberEmail = (member?.profiles as any)?.email;

  // Deactivate in members table
  const { error: memberError } = await adminClient
    .from('members')
    .update({ is_active: false, membership_status: 'inactive' })
    .eq('id', memberId);

  if (memberError) {
    return {
      success: false,
      message: memberError.message || 'Failed to deactivate member.'
    };
  }

  // Deactivate in profiles table
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: false })
    .eq('id', memberId);

  if (profileError) {
    console.error('Failed to deactivate profile:', profileError);
  }

  // Deactivate in approved_emails table
  if (memberEmail) {
    await adminClient
      .from('approved_emails')
      .update({ is_active: false })
      .eq('email', memberEmail);
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag(`member-${memberId}`, 'max');
  revalidateTag('analytics-all', 'max');

  return {
    success: true,
    message: `${memberName} has been deactivated successfully.`
  };
}

/**
 * Reactivate a member (re-enable in both members and profiles tables)
 * The member can login again after reactivation
 * Super Admin, National Admin, Chair, and Co-Chair can perform this action
 */
export async function reactivateMemberFromTable(
  memberId: string
): Promise<{ success: boolean; message: string }> {
  // Check permission - Super Admin, National Admin, Chair, Co-Chair can reactivate
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);
  } catch {
    return {
      success: false,
      message: 'You do not have permission to reactivate members.'
    };
  }

  const adminClient = createAdminSupabaseClient();

  // First get member info for the message
  const { data: member } = await adminClient
    .from('members')
    .select('id, profiles!inner(full_name, email)')
    .eq('id', memberId)
    .single();

  if (!member) {
    return {
      success: false,
      message: 'Member not found.'
    };
  }

  const memberName = (member?.profiles as any)?.full_name || 'Member';
  const memberEmail = (member?.profiles as any)?.email;

  // Reactivate in members table
  const { error: memberError } = await adminClient
    .from('members')
    .update({ is_active: true, membership_status: 'active' })
    .eq('id', memberId);

  if (memberError) {
    return {
      success: false,
      message: memberError.message || 'Failed to reactivate member.'
    };
  }

  // Reactivate in profiles table
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .eq('id', memberId);

  if (profileError) {
    console.error('Failed to reactivate profile:', profileError);
  }

  // Reactivate in approved_emails table
  if (memberEmail) {
    await adminClient
      .from('approved_emails')
      .update({ is_active: true })
      .eq('email', memberEmail);
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag(`member-${memberId}`, 'max');
  revalidateTag('analytics-all', 'max');

  return {
    success: true,
    message: `${memberName} has been reactivated successfully.`
  };
}

/**
 * Permanently delete a member (removes from members, profiles, and auth)
 * WARNING: This action cannot be undone
 * Only Super Admin and National Admin can perform this action
 */
export async function deleteMemberPermanently(
  memberId: string
): Promise<{ success: boolean; message: string }> {
  // Check permission - only Super Admin and National Admin can delete
  try {
    await requireRole(['Super Admin', 'National Admin']);
  } catch {
    return {
      success: false,
      message: 'You do not have permission to delete members.'
    };
  }

  const adminClient = createAdminSupabaseClient();

  // First get member info for the message
  const { data: member } = await adminClient
    .from('members')
    .select('id, profiles!inner(full_name, email)')
    .eq('id', memberId)
    .single();

  if (!member) {
    return {
      success: false,
      message: 'Member not found.'
    };
  }

  const memberName = (member?.profiles as any)?.full_name || 'Member';
  const memberEmail = (member?.profiles as any)?.email;

  try {
    // 1. First, handle approved_emails foreign key constraint
    // Update approved_emails to remove the reference to this member
    if (memberEmail) {
      await adminClient
        .from('approved_emails')
        .update({ created_member_id: null, member_created: false })
        .eq('email', memberEmail);
    }

    // Also update any approved_emails where this member was the created_member_id
    await adminClient
      .from('approved_emails')
      .update({ created_member_id: null })
      .eq('created_member_id', memberId);

    // 2. Delete from members table (this will cascade delete skills, certifications, etc.)
    const { error: memberError } = await adminClient
      .from('members')
      .delete()
      .eq('id', memberId);

    if (memberError) {
      throw new Error(memberError.message);
    }

    // 3. Delete from profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', memberId);

    if (profileError) {
      console.error('Failed to delete profile:', profileError);
    }

    // 4. Delete from approved_emails table (the email whitelist entry)
    if (memberEmail) {
      await adminClient
        .from('approved_emails')
        .delete()
        .eq('email', memberEmail);
    }

    // 5. Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(memberId);

    if (authError) {
      console.error('Failed to delete auth user:', authError);
    }

    // Invalidate caches
    revalidateTag('members-list', 'max');
    revalidateTag(`member-${memberId}`, 'max');
    revalidateTag('analytics-all', 'max');
    revalidateTag('approved-emails', 'max');

    return {
      success: true,
      message: `${memberName} has been permanently deleted.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to delete member permanently.'
    };
  }
}

/**
 * Bulk delete members permanently (removes from members, profiles, and auth)
 * WARNING: This action cannot be undone
 * Only Super Admin and National Admin can perform this action
 */
export async function bulkDeleteMembers(
  memberIds: string[]
): Promise<{ success: boolean; message: string; deletedCount: number; failedCount: number }> {
  // Check permission - only Super Admin and National Admin can delete
  try {
    await requireRole(['Super Admin', 'National Admin']);
  } catch {
    return {
      success: false,
      message: 'You do not have permission to delete members.',
      deletedCount: 0,
      failedCount: memberIds.length
    };
  }

  if (!memberIds.length) {
    return {
      success: false,
      message: 'No members selected for deletion.',
      deletedCount: 0,
      failedCount: 0
    };
  }

  const adminClient = createAdminSupabaseClient();
  let deletedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Get all members info for processing
  const { data: members } = await adminClient
    .from('members')
    .select('id, profiles!inner(full_name, email)')
    .in('id', memberIds);

  if (!members || members.length === 0) {
    return {
      success: false,
      message: 'No valid members found for deletion.',
      deletedCount: 0,
      failedCount: memberIds.length
    };
  }

  // Process each member
  for (const member of members) {
    const memberEmail = (member?.profiles as any)?.email;

    try {
      // 1. Handle approved_emails foreign key constraint
      if (memberEmail) {
        await adminClient
          .from('approved_emails')
          .update({ created_member_id: null, member_created: false })
          .eq('email', memberEmail);
      }

      // Also update any approved_emails where this member was the created_member_id
      await adminClient
        .from('approved_emails')
        .update({ created_member_id: null })
        .eq('created_member_id', member.id);

      // 2. Delete from members table (cascades to skills, certifications, etc.)
      const { error: memberError } = await adminClient
        .from('members')
        .delete()
        .eq('id', member.id);

      if (memberError) {
        throw new Error(memberError.message);
      }

      // 3. Delete from profiles table
      await adminClient
        .from('profiles')
        .delete()
        .eq('id', member.id);

      // 4. Delete from approved_emails table
      if (memberEmail) {
        await adminClient
          .from('approved_emails')
          .delete()
          .eq('email', memberEmail);
      }

      // 5. Delete auth user
      await adminClient.auth.admin.deleteUser(member.id);

      deletedCount++;
    } catch (error: any) {
      failedCount++;
      errors.push(`Failed to delete ${(member?.profiles as any)?.full_name || member.id}: ${error.message}`);
      console.error(`Failed to delete member ${member.id}:`, error);
    }
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag('analytics-all', 'max');
  revalidateTag('approved-emails', 'max');

  if (failedCount === 0) {
    return {
      success: true,
      message: `Successfully deleted ${deletedCount} member${deletedCount > 1 ? 's' : ''}.`,
      deletedCount,
      failedCount
    };
  } else if (deletedCount === 0) {
    return {
      success: false,
      message: `Failed to delete all members. ${errors[0]}`,
      deletedCount,
      failedCount
    };
  } else {
    return {
      success: true,
      message: `Deleted ${deletedCount} member${deletedCount > 1 ? 's' : ''}, ${failedCount} failed.`,
      deletedCount,
      failedCount
    };
  }
}

/**
 * Bulk deactivate members (soft disable)
 * Super Admin, National Admin, Chair, and Co-Chair can perform this action
 */
export async function bulkDeactivateMembers(
  memberIds: string[]
): Promise<{ success: boolean; message: string; deactivatedCount: number; failedCount: number }> {
  // Check permission
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);
  } catch {
    return {
      success: false,
      message: 'You do not have permission to deactivate members.',
      deactivatedCount: 0,
      failedCount: memberIds.length
    };
  }

  if (!memberIds.length) {
    return {
      success: false,
      message: 'No members selected for deactivation.',
      deactivatedCount: 0,
      failedCount: 0
    };
  }

  const adminClient = createAdminSupabaseClient();
  let deactivatedCount = 0;
  let failedCount = 0;

  // Get all members info
  const { data: members } = await adminClient
    .from('members')
    .select('id, profiles!inner(full_name, email)')
    .in('id', memberIds);

  if (!members || members.length === 0) {
    return {
      success: false,
      message: 'No valid members found for deactivation.',
      deactivatedCount: 0,
      failedCount: memberIds.length
    };
  }

  // Process each member
  for (const member of members) {
    const memberEmail = (member?.profiles as any)?.email;

    try {
      // Deactivate in members table
      const { error: memberError } = await adminClient
        .from('members')
        .update({ is_active: false, membership_status: 'inactive' })
        .eq('id', member.id);

      if (memberError) {
        throw new Error(memberError.message);
      }

      // Deactivate in profiles table
      await adminClient
        .from('profiles')
        .update({ is_active: false })
        .eq('id', member.id);

      // Deactivate in approved_emails table
      if (memberEmail) {
        await adminClient
          .from('approved_emails')
          .update({ is_active: false })
          .eq('email', memberEmail);
      }

      deactivatedCount++;
    } catch (error: any) {
      failedCount++;
      console.error(`Failed to deactivate member ${member.id}:`, error);
    }
  }

  // Invalidate caches
  revalidateTag('members-list', 'max');
  revalidateTag('analytics-all', 'max');

  if (failedCount === 0) {
    return {
      success: true,
      message: `Successfully deactivated ${deactivatedCount} member${deactivatedCount > 1 ? 's' : ''}.`,
      deactivatedCount,
      failedCount
    };
  } else {
    return {
      success: true,
      message: `Deactivated ${deactivatedCount} member${deactivatedCount > 1 ? 's' : ''}, ${failedCount} failed.`,
      deactivatedCount,
      failedCount
    };
  }
}

// ============================================================================
// Member Skills Actions
// ============================================================================

/**
 * Add a skill to a member
 */
export async function addMemberSkill(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = addMemberSkillSchema.safeParse({
    member_id: formData.get('member_id'),
    skill_id: formData.get('skill_id'),
    proficiency: formData.get('proficiency'),
    years_of_experience: formData.get('years_of_experience')
      ? Number(formData.get('years_of_experience'))
      : undefined,
    is_willing_to_mentor: formData.get('is_willing_to_mentor') === 'true',
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('member_skills').insert({
    member_id: validation.data.member_id,
    skill_id: validation.data.skill_id,
    proficiency: validation.data.proficiency,
    years_of_experience: validation.data.years_of_experience || null,
    is_willing_to_mentor: validation.data.is_willing_to_mentor || false,
    notes: validation.data.notes || null
  });

  if (error) {
    return {
      message: error.message || 'Failed to add skill. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag(`member-${validation.data.member_id}`, 'max');
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill added successfully!'
  };
}

/**
 * Update a member skill
 */
export async function updateMemberSkill(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = updateMemberSkillSchema.safeParse({
    id: formData.get('id'),
    proficiency: formData.get('proficiency'),
    years_of_experience: formData.get('years_of_experience')
      ? Number(formData.get('years_of_experience'))
      : undefined,
    is_willing_to_mentor:
      formData.get('is_willing_to_mentor') !== null
        ? formData.get('is_willing_to_mentor') === 'true'
        : undefined,
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Get member_id for cache invalidation
  const { data: memberSkill } = await supabase
    .from('member_skills')
    .select('member_id')
    .eq('id', validation.data.id)
    .single();

  // Build update object
  const updateData: any = {};
  Object.entries(validation.data).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      updateData[key] = value;
    }
  });

  const { error } = await supabase
    .from('member_skills')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    return {
      message: error.message || 'Failed to update skill. Please try again.'
    };
  }

  // Invalidate caches
  if (memberSkill) {
    revalidateTag(`member-${memberSkill.member_id}`, 'max');
  }
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill updated successfully!'
  };
}

/**
 * Delete a member skill
 */
export async function deleteMemberSkill(id: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  // Get member_id for cache invalidation
  const { data: memberSkill } = await supabase
    .from('member_skills')
    .select('member_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('member_skills').delete().eq('id', id);

  if (error) {
    return {
      message: error.message || 'Failed to delete skill. Please try again.'
    };
  }

  // Invalidate caches
  if (memberSkill) {
    revalidateTag(`member-${memberSkill.member_id}`, 'max');
  }
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill removed successfully!'
  };
}

// ============================================================================
// Member Certifications Actions
// ============================================================================

/**
 * Add a certification to a member
 */
export async function addMemberCertification(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = addMemberCertificationSchema.safeParse({
    member_id: formData.get('member_id'),
    certification_id: formData.get('certification_id'),
    certificate_number: formData.get('certificate_number'),
    issued_date: formData.get('issued_date'),
    expiry_date: formData.get('expiry_date'),
    document_url: formData.get('document_url'),
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('member_certifications').insert({
    member_id: validation.data.member_id,
    certification_id: validation.data.certification_id,
    certificate_number: validation.data.certificate_number || null,
    issued_date: validation.data.issued_date,
    expiry_date: validation.data.expiry_date || null,
    document_url: validation.data.document_url || null,
    notes: validation.data.notes || null
  });

  if (error) {
    return {
      message: error.message || 'Failed to add certification. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag(`member-${validation.data.member_id}`, 'max');

  return {
    success: true,
    message: 'Certification added successfully!'
  };
}

/**
 * Update a member certification
 */
export async function updateMemberCertification(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = updateMemberCertificationSchema.safeParse({
    id: formData.get('id'),
    certificate_number: formData.get('certificate_number'),
    issued_date: formData.get('issued_date'),
    expiry_date: formData.get('expiry_date'),
    document_url: formData.get('document_url'),
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Get member_id for cache invalidation
  const { data: memberCert } = await supabase
    .from('member_certifications')
    .select('member_id')
    .eq('id', validation.data.id)
    .single();

  // Build update object
  const updateData: any = {};
  Object.entries(validation.data).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      updateData[key] = value;
    }
  });

  const { error } = await supabase
    .from('member_certifications')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    return {
      message:
        error.message || 'Failed to update certification. Please try again.'
    };
  }

  // Invalidate caches
  if (memberCert) {
    revalidateTag(`member-${memberCert.member_id}`, 'max');
  }

  return {
    success: true,
    message: 'Certification updated successfully!'
  };
}

/**
 * Delete a member certification
 */
export async function deleteMemberCertification(
  id: string
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  // Get member_id for cache invalidation
  const { data: memberCert } = await supabase
    .from('member_certifications')
    .select('member_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('member_certifications')
    .delete()
    .eq('id', id);

  if (error) {
    return {
      message:
        error.message || 'Failed to delete certification. Please try again.'
    };
  }

  // Invalidate caches
  if (memberCert) {
    revalidateTag(`member-${memberCert.member_id}`, 'max');
  }

  return {
    success: true,
    message: 'Certification removed successfully!'
  };
}

// ============================================================================
// Availability Actions
// ============================================================================

/**
 * Set member availability for a date
 */
export async function setAvailability(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = setAvailabilitySchema.safeParse({
    member_id: formData.get('member_id'),
    date: formData.get('date'),
    status: formData.get('status'),
    time_slots: formData.get('time_slots')
      ? JSON.parse(formData.get('time_slots') as string)
      : undefined,
    notes: formData.get('notes')
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Upsert availability (update if exists, insert if not)
  const { error } = await supabase.from('availability').upsert(
    {
      member_id: validation.data.member_id,
      date: validation.data.date,
      status: validation.data.status,
      time_slots: validation.data.time_slots || null,
      notes: validation.data.notes || null
    },
    {
      onConflict: 'member_id,date'
    }
  );

  if (error) {
    return {
      message: error.message || 'Failed to set availability. Please try again.'
    };
  }

  return {
    success: true,
    message: 'Availability updated successfully!'
  };
}

/**
 * Delete availability entry
 */
export async function deleteAvailability(id: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('availability').delete().eq('id', id);

  if (error) {
    return {
      message:
        error.message || 'Failed to delete availability. Please try again.'
    };
  }

  return {
    success: true,
    message: 'Availability removed successfully!'
  };
}

// ============================================================================
// Score Recalculation Actions
// ============================================================================

/**
 * Recalculate engagement score for a member
 */
export async function recalculateEngagementScore(
  memberId: string
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc('calculate_engagement_score', {
    p_member_id: memberId
  });

  if (error) {
    return {
      message:
        error.message ||
        'Failed to recalculate engagement score. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag(`member-${memberId}`, 'max');
  revalidateTag('members-list', 'max');

  return {
    success: true,
    message: 'Engagement score recalculated successfully!'
  };
}

/**
 * Recalculate leadership readiness for a member
 */
export async function recalculateLeadershipReadiness(
  memberId: string
): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc('calculate_leadership_readiness', {
    p_member_id: memberId
  });

  if (error) {
    return {
      message:
        error.message ||
        'Failed to recalculate leadership readiness. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag(`member-${memberId}`, 'max');
  revalidateTag('members-list', 'max');

  return {
    success: true,
    message: 'Leadership readiness recalculated successfully!'
  };
}

// ============================================================================
// Admin: Skills Management
// ============================================================================

/**
 * Create a new skill (admin only)
 */
export async function createSkill(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = createSkillSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category'),
    description: formData.get('description'),
    is_active: formData.get('is_active') === 'true'
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('skills').insert({
    name: validation.data.name,
    category: validation.data.category,
    description: validation.data.description || null,
    is_active: validation.data.is_active ?? true
  });

  if (error) {
    return {
      message: error.message || 'Failed to create skill. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('skills-list', 'max');
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill created successfully!'
  };
}

/**
 * Update a skill (admin only)
 */
export async function updateSkill(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = updateSkillSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    category: formData.get('category'),
    description: formData.get('description'),
    is_active:
      formData.get('is_active') !== null
        ? formData.get('is_active') === 'true'
        : undefined
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Build update object
  const updateData: any = {};
  Object.entries(validation.data).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      updateData[key] = value;
    }
  });

  const { error } = await supabase
    .from('skills')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    return {
      message: error.message || 'Failed to update skill. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('skills-list', 'max');
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill updated successfully!'
  };
}

/**
 * Delete a skill (admin only)
 */
export async function deleteSkill(id: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('skills').delete().eq('id', id);

  if (error) {
    return {
      message: error.message || 'Failed to delete skill. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('skills-list', 'max');
  revalidateTag('skills-with-members', 'max');

  return {
    success: true,
    message: 'Skill deleted successfully!'
  };
}

// ============================================================================
// Admin: Certifications Management
// ============================================================================

/**
 * Create a new certification (admin only)
 */
export async function createCertification(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = createCertificationSchema.safeParse({
    name: formData.get('name'),
    issuing_organization: formData.get('issuing_organization'),
    description: formData.get('description'),
    validity_period_months: formData.get('validity_period_months')
      ? Number(formData.get('validity_period_months'))
      : undefined,
    is_active: formData.get('is_active') === 'true'
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('certifications').insert({
    name: validation.data.name,
    issuing_organization: validation.data.issuing_organization,
    description: validation.data.description || null,
    validity_period_months: validation.data.validity_period_months || null,
    is_active: validation.data.is_active ?? true
  });

  if (error) {
    return {
      message:
        error.message || 'Failed to create certification. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('certifications-list', 'max');

  return {
    success: true,
    message: 'Certification created successfully!'
  };
}

/**
 * Update a certification (admin only)
 */
export async function updateCertification(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = updateCertificationSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    issuing_organization: formData.get('issuing_organization'),
    description: formData.get('description'),
    validity_period_months: formData.get('validity_period_months')
      ? Number(formData.get('validity_period_months'))
      : undefined,
    is_active:
      formData.get('is_active') !== null
        ? formData.get('is_active') === 'true'
        : undefined
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

  // Build update object
  const updateData: any = {};
  Object.entries(validation.data).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      updateData[key] = value;
    }
  });

  const { error } = await supabase
    .from('certifications')
    .update(updateData)
    .eq('id', validation.data.id);

  if (error) {
    return {
      message:
        error.message || 'Failed to update certification. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('certifications-list', 'max');

  return {
    success: true,
    message: 'Certification updated successfully!'
  };
}

/**
 * Delete a certification (admin only)
 */
export async function deleteCertification(id: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('certifications').delete().eq('id', id);

  if (error) {
    return {
      message:
        error.message || 'Failed to delete certification. Please try again.'
    };
  }

  // Invalidate caches
  revalidateTag('certifications-list', 'max');

  return {
    success: true,
    message: 'Certification deleted successfully!'
  };
}
