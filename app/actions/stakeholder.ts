/**
 * Stakeholder Relationship CRM Server Actions
 *
 * Server Actions for Module 2: Stakeholder Relationship CRM
 * Handles CRUD operations for all 7 stakeholder types and shared relationships
 */

'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentChapterId } from '@/lib/auth'
import {
  schoolFormSchema,
  collegeFormSchema,
  industryFormSchema,
  governmentStakeholderFormSchema,
  ngoFormSchema,
  vendorFormSchema,
  speakerFormSchema,
  contactFormSchema,
  interactionFormSchema,
  mouFormSchema,
  documentFormSchema,
  type SchoolFormInput,
  type CollegeFormInput,
  type IndustryFormInput,
  type GovernmentStakeholderFormInput,
  type NGOFormInput,
  type VendorFormInput,
  type SpeakerFormInput,
  type ContactFormInput,
  type InteractionFormInput,
  type MouFormInput,
  type DocumentFormInput,
} from '@/lib/validations/stakeholder'

export type FormState = {
  errors?: Record<string, string[]>
  success?: boolean
  message?: string
}

// ============================================================================
// SCHOOL ACTIONS
// ============================================================================

export async function createSchool(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized - No chapter found for user' }
  }

  // Parse and validate form data
  const rawData = Object.fromEntries(formData)

  // Handle array fields
  const processedData = {
    ...rawData,
    medium: formData.getAll('medium[]'),
    suitable_programs: formData.getAll('suitable_programs[]'),
    has_auditorium: rawData.has_auditorium === 'true',
    has_smart_class: rawData.has_smart_class === 'true',
    has_ground: rawData.has_ground === 'true',
    has_parking: rawData.has_parking === 'true',
    has_library: rawData.has_library === 'true',
  }

  const validated = schoolFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schools')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating school:', error)
    console.error('Attempted to insert with chapter_id:', chapterId)
    return {
      success: false,
      message: `Failed to create school: ${error.message}`,
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/schools/${data.id}`)
}

export async function updateSchool(
  schoolId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    medium: formData.getAll('medium[]'),
    suitable_programs: formData.getAll('suitable_programs[]'),
    has_auditorium: rawData.has_auditorium === 'true',
    has_smart_class: rawData.has_smart_class === 'true',
    has_ground: rawData.has_ground === 'true',
    has_parking: rawData.has_parking === 'true',
    has_library: rawData.has_library === 'true',
  }

  const validated = schoolFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('schools')
    .update(validated.data)
    .eq('id', schoolId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating school:', error)
    return {
      success: false,
      message: 'Failed to update school. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'School updated successfully' }
}

export async function deleteSchool(schoolId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('schools')
    .delete()
    .eq('id', schoolId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting school:', error)
    return {
      success: false,
      message: 'Failed to delete school. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/schools')
}

// ============================================================================
// COLLEGE ACTIONS
// ============================================================================

export async function createCollege(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    departments: formData.getAll('departments[]'),
    accreditation: formData.getAll('accreditation[]'),
    suitable_activities: formData.getAll('suitable_activities[]'),
    available_resources: formData.getAll('available_resources[]'),
    has_yuva_chapter: rawData.has_yuva_chapter === 'true',
  }

  const validated = collegeFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('colleges')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating college:', error)
    return {
      success: false,
      message: 'Failed to create college. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/colleges/${data.id}`)
}

export async function updateCollege(
  collegeId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    departments: formData.getAll('departments[]'),
    accreditation: formData.getAll('accreditation[]'),
    suitable_activities: formData.getAll('suitable_activities[]'),
    available_resources: formData.getAll('available_resources[]'),
    has_yuva_chapter: rawData.has_yuva_chapter === 'true',
  }

  const validated = collegeFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('colleges')
    .update(validated.data)
    .eq('id', collegeId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating college:', error)
    return {
      success: false,
      message: 'Failed to update college. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'College updated successfully' }
}

export async function deleteCollege(collegeId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('colleges')
    .delete()
    .eq('id', collegeId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting college:', error)
    return {
      success: false,
      message: 'Failed to delete college. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/colleges')
}

// ============================================================================
// INDUSTRY ACTIONS
// ============================================================================

export async function createIndustry(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    csr_focus_areas: formData.getAll('csr_focus_areas[]'),
    collaboration_interests: formData.getAll('collaboration_interests[]'),
    available_resources: formData.getAll('available_resources[]'),
    has_csr_program: rawData.has_csr_program === 'true',
    can_provide_internships: rawData.can_provide_internships === 'true',
    can_provide_mentorship: rawData.can_provide_mentorship === 'true',
  }

  const validated = industryFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('industries')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating industry:', error)
    return {
      success: false,
      message: 'Failed to create industry. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/industries/${data.id}`)
}

export async function updateIndustry(
  industryId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    csr_focus_areas: formData.getAll('csr_focus_areas[]'),
    collaboration_interests: formData.getAll('collaboration_interests[]'),
    available_resources: formData.getAll('available_resources[]'),
    has_csr_program: rawData.has_csr_program === 'true',
    can_provide_internships: rawData.can_provide_internships === 'true',
    can_provide_mentorship: rawData.can_provide_mentorship === 'true',
  }

  const validated = industryFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('industries')
    .update(validated.data)
    .eq('id', industryId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating industry:', error)
    return {
      success: false,
      message: 'Failed to update industry. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Industry updated successfully' }
}

export async function deleteIndustry(industryId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('industries')
    .delete()
    .eq('id', industryId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting industry:', error)
    return {
      success: false,
      message: 'Failed to delete industry. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/industries')
}

// ============================================================================
// GOVERNMENT STAKEHOLDER ACTIONS
// ============================================================================

export async function createGovernmentStakeholder(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    key_responsibilities: formData.getAll('key_responsibilities[]'),
    decision_making_authority: formData.getAll('decision_making_authority[]'),
    areas_of_support: formData.getAll('areas_of_support[]'),
    protocol_requirements: formData.getAll('protocol_requirements[]'),
    is_elected: rawData.is_elected === 'true',
    can_provide_permissions: rawData.can_provide_permissions === 'true',
    can_provide_funding: rawData.can_provide_funding === 'true',
    can_provide_venue: rawData.can_provide_venue === 'true',
  }

  const validated = governmentStakeholderFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('government_stakeholders')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating government stakeholder:', error)
    return {
      success: false,
      message: 'Failed to create government stakeholder. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/government/${data.id}`)
}

export async function updateGovernmentStakeholder(
  stakeholderId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    key_responsibilities: formData.getAll('key_responsibilities[]'),
    decision_making_authority: formData.getAll('decision_making_authority[]'),
    areas_of_support: formData.getAll('areas_of_support[]'),
    protocol_requirements: formData.getAll('protocol_requirements[]'),
    is_elected: rawData.is_elected === 'true',
    can_provide_permissions: rawData.can_provide_permissions === 'true',
    can_provide_funding: rawData.can_provide_funding === 'true',
    can_provide_venue: rawData.can_provide_venue === 'true',
  }

  const validated = governmentStakeholderFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('government_stakeholders')
    .update(validated.data)
    .eq('id', stakeholderId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating government stakeholder:', error)
    return {
      success: false,
      message: 'Failed to update government stakeholder. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Government stakeholder updated successfully' }
}

export async function deleteGovernmentStakeholder(stakeholderId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('government_stakeholders')
    .delete()
    .eq('id', stakeholderId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting government stakeholder:', error)
    return {
      success: false,
      message: 'Failed to delete government stakeholder. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/government')
}

// ============================================================================
// NGO ACTIONS
// ============================================================================

export async function createNGO(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    focus_areas: formData.getAll('focus_areas[]'),
    target_beneficiaries: formData.getAll('target_beneficiaries[]'),
    partnership_type: formData.getAll('partnership_type[]'),
    collaboration_areas: formData.getAll('collaboration_areas[]'),
    resources_they_can_provide: formData.getAll('resources_they_can_provide[]'),
    resources_they_need: formData.getAll('resources_they_need[]'),
    is_registered: rawData.is_registered === 'true',
  }

  const validated = ngoFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ngos')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating NGO:', error)
    return {
      success: false,
      message: 'Failed to create NGO. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/ngos/${data.id}`)
}

export async function updateNGO(
  ngoId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    focus_areas: formData.getAll('focus_areas[]'),
    target_beneficiaries: formData.getAll('target_beneficiaries[]'),
    partnership_type: formData.getAll('partnership_type[]'),
    collaboration_areas: formData.getAll('collaboration_areas[]'),
    resources_they_can_provide: formData.getAll('resources_they_can_provide[]'),
    resources_they_need: formData.getAll('resources_they_need[]'),
    is_registered: rawData.is_registered === 'true',
  }

  const validated = ngoFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('ngos')
    .update(validated.data)
    .eq('id', ngoId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating NGO:', error)
    return {
      success: false,
      message: 'Failed to update NGO. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'NGO updated successfully' }
}

export async function deleteNGO(ngoId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('ngos')
    .delete()
    .eq('id', ngoId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting NGO:', error)
    return {
      success: false,
      message: 'Failed to delete NGO. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/ngos')
}

// ============================================================================
// VENDOR ACTIONS
// ============================================================================

export async function createVendor(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    services_offered: formData.getAll('services_offered[]'),
    serves_locations: formData.getAll('serves_locations[]'),
    accepts_negotiation: rawData.accepts_negotiation === 'true',
    has_gst_certificate: rawData.has_gst_certificate === 'true',
    has_service_agreement: rawData.has_service_agreement === 'true',
  }

  const validated = vendorFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vendors')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating vendor:', error)
    return {
      success: false,
      message: 'Failed to create vendor. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/vendors/${data.id}`)
}

export async function updateVendor(
  vendorId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    services_offered: formData.getAll('services_offered[]'),
    serves_locations: formData.getAll('serves_locations[]'),
    accepts_negotiation: rawData.accepts_negotiation === 'true',
    has_gst_certificate: rawData.has_gst_certificate === 'true',
    has_service_agreement: rawData.has_service_agreement === 'true',
  }

  const validated = vendorFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('vendors')
    .update(validated.data)
    .eq('id', vendorId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating vendor:', error)
    return {
      success: false,
      message: 'Failed to update vendor. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Vendor updated successfully' }
}

export async function deleteVendor(vendorId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('vendors')
    .delete()
    .eq('id', vendorId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting vendor:', error)
    return {
      success: false,
      message: 'Failed to delete vendor. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/vendors')
}

// ============================================================================
// SPEAKER ACTIONS
// ============================================================================

export async function createSpeaker(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    expertise_areas: formData.getAll('expertise_areas[]'),
    suitable_topics: formData.getAll('suitable_topics[]'),
    target_audience: formData.getAll('target_audience[]'),
    session_formats: formData.getAll('session_formats[]'),
    organizations_associated: formData.getAll('organizations_associated[]'),
    notable_achievements: formData.getAll('notable_achievements[]'),
    requires_av_equipment: formData.getAll('requires_av_equipment[]'),
    language_proficiency: formData.getAll('language_proficiency[]'),
    preferred_days: formData.getAll('preferred_days[]'),
    preferred_time_slots: formData.getAll('preferred_time_slots[]'),
    special_requirements: formData.getAll('special_requirements[]'),
    charges_fee: rawData.charges_fee === 'true',
    accommodation_required: rawData.accommodation_required === 'true',
  }

  const validated = speakerFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('speakers')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating speaker:', error)
    return {
      success: false,
      message: 'Failed to create speaker. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect(`/stakeholders/speakers/${data.id}`)
}

export async function updateSpeaker(
  speakerId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    expertise_areas: formData.getAll('expertise_areas[]'),
    suitable_topics: formData.getAll('suitable_topics[]'),
    target_audience: formData.getAll('target_audience[]'),
    session_formats: formData.getAll('session_formats[]'),
    organizations_associated: formData.getAll('organizations_associated[]'),
    notable_achievements: formData.getAll('notable_achievements[]'),
    requires_av_equipment: formData.getAll('requires_av_equipment[]'),
    language_proficiency: formData.getAll('language_proficiency[]'),
    preferred_days: formData.getAll('preferred_days[]'),
    preferred_time_slots: formData.getAll('preferred_time_slots[]'),
    special_requirements: formData.getAll('special_requirements[]'),
    charges_fee: rawData.charges_fee === 'true',
    accommodation_required: rawData.accommodation_required === 'true',
  }

  const validated = speakerFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('speakers')
    .update(validated.data)
    .eq('id', speakerId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error updating speaker:', error)
    return {
      success: false,
      message: 'Failed to update speaker. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Speaker updated successfully' }
}

export async function deleteSpeaker(speakerId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('speakers')
    .delete()
    .eq('id', speakerId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting speaker:', error)
    return {
      success: false,
      message: 'Failed to delete speaker. Please try again.',
    }
  }

  updateTag('stakeholders')
  redirect('/stakeholders/speakers')
}

// ============================================================================
// SHARED RELATIONSHIP ACTIONS
// ============================================================================

export async function createContact(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    is_primary_contact: rawData.is_primary_contact === 'true',
    is_decision_maker: rawData.is_decision_maker === 'true',
  }

  const validated = contactFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('stakeholder_contacts')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })

  if (error) {
    console.error('Error creating contact:', error)
    return {
      success: false,
      message: 'Failed to create contact. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Contact added successfully' }
}

export async function createInteraction(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  const supabase = await createClient()

  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    attended_by_members: formData.getAll('attended_by_members[]'),
    tags: formData.getAll('tags[]'),
    requires_follow_up: rawData.requires_follow_up === 'true',
  }

  const validated = interactionFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const { error } = await supabase
    .from('stakeholder_interactions')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
      created_by: user.id,
    })

  if (error) {
    console.error('Error creating interaction:', error)
    return {
      success: false,
      message: 'Failed to create interaction. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Interaction logged successfully' }
}

export async function createMou(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    key_deliverables: formData.getAll('key_deliverables[]'),
    compliance_requirements: formData.getAll('compliance_requirements[]'),
  }

  const validated = mouFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('stakeholder_mous')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
    })

  if (error) {
    console.error('Error creating MoU:', error)
    return {
      success: false,
      message: 'Failed to create MoU. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'MoU created successfully' }
}

export async function createDocument(prevState: FormState, formData: FormData): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  const supabase = await createClient()

  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const rawData = Object.fromEntries(formData)

  const processedData = {
    ...rawData,
    tags: formData.getAll('tags[]'),
  }

  const validated = documentFormSchema.safeParse(processedData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    }
  }

  const { error } = await supabase
    .from('stakeholder_documents')
    .insert({
      ...validated.data,
      chapter_id: chapterId,
      uploaded_by: user.id,
    })

  if (error) {
    console.error('Error creating document:', error)
    return {
      success: false,
      message: 'Failed to upload document. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Document uploaded successfully' }
}

export async function deleteContact(contactId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('stakeholder_contacts')
    .delete()
    .eq('id', contactId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting contact:', error)
    return {
      success: false,
      message: 'Failed to delete contact. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Contact deleted successfully' }
}

export async function deleteDocument(documentId: string): Promise<FormState> {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) {
    return { success: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('stakeholder_documents')
    .delete()
    .eq('id', documentId)
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('Error deleting document:', error)
    return {
      success: false,
      message: 'Failed to delete document. Please try again.',
    }
  }

  updateTag('stakeholders')
  return { success: true, message: 'Document deleted successfully' }
}
