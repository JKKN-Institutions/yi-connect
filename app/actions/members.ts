/**
 * Member Server Actions
 *
 * Server actions for Member Intelligence Hub mutations.
 * All mutations use Zod validation and cache invalidation.
 */

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
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
  const validation = createMemberSchema.safeParse({
    id: formData.get('id'),
    email: formData.get('email'),
    full_name: formData.get('full_name'),
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
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.'
    };
  }

  const supabase = await createServerSupabaseClient();

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

  return {
    success: true,
    message: 'Member created successfully!',
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
