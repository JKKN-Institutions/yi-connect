'use server'

/**
 * Skill-Will Assessment Server Actions
 *
 * Server actions for managing skill-will assessments.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  startAssessmentSchema,
  updateAssessmentAnswersSchema,
  completeAssessmentSchema,
  assignVerticalSchema,
  assignMentorSchema,
  updateRoadmapSchema,
} from '@/lib/validations/assessment'
import {
  calculateSkillScore,
  calculateWillScore,
  calculateCategory,
} from '@/types/assessment'
import type {
  SkillWillAssessment,
  SkillWillCategory,
  AlternativeVertical,
  RoadmapMilestone,
} from '@/types/assessment'

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> = {
  success: true
  data?: T
} | {
  success: false
  error: string
}

// ============================================================================
// Assessment Lifecycle Actions
// ============================================================================

/**
 * Start a new assessment for a member
 */
export async function startAssessment(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = startAssessmentSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    // Check for existing in-progress assessment
    const { data: existing } = await supabase
      .from('skill_will_assessments')
      .select('id')
      .eq('member_id', validated.member_id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'An assessment is already in progress for this member' }
    }

    // Get the latest version number
    const { data: latestVersion } = await supabase
      .from('skill_will_assessments')
      .select('version')
      .eq('member_id', validated.member_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newVersion = (latestVersion?.version || 0) + 1

    // Create new assessment
    const { data, error } = await supabase
      .from('skill_will_assessments')
      .insert({
        member_id: validated.member_id,
        chapter_id: validated.chapter_id,
        status: 'in_progress',
        version: newVersion,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to start assessment: ${error.message}`)
    }

    revalidatePath('/members')
    revalidatePath(`/members/${validated.member_id}`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Start assessment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start assessment',
    }
  }
}

/**
 * Update assessment answers (save progress)
 */
export async function updateAssessmentAnswers(
  input: unknown
): Promise<ActionResult> {
  try {
    const validated = updateAssessmentAnswersSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (validated.q1_energy_focus !== undefined) {
      updateData.q1_energy_focus = validated.q1_energy_focus
    }
    if (validated.q2_age_group !== undefined) {
      updateData.q2_age_group = validated.q2_age_group
    }
    if (validated.q3_skill_level !== undefined) {
      updateData.q3_skill_level = validated.q3_skill_level
    }
    if (validated.q4_time_commitment !== undefined) {
      updateData.q4_time_commitment = validated.q4_time_commitment
    }
    if (validated.q5_travel_willingness !== undefined) {
      updateData.q5_travel_willingness = validated.q5_travel_willingness
    }

    const { error } = await supabase
      .from('skill_will_assessments')
      .update(updateData)
      .eq('id', validated.id)
      .eq('status', 'in_progress')

    if (error) {
      throw new Error(`Failed to update assessment: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Update assessment answers error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update assessment',
    }
  }
}

/**
 * Complete an assessment and calculate scores
 */
export async function completeAssessment(
  input: unknown
): Promise<ActionResult<{ category: SkillWillCategory }>> {
  try {
    const validated = completeAssessmentSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    // Get current assessment
    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('id', validated.id)
      .eq('status', 'in_progress')
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found or already completed' }
    }

    // Validate all questions are answered
    if (
      !assessment.q1_energy_focus ||
      !assessment.q2_age_group ||
      !assessment.q3_skill_level ||
      !assessment.q4_time_commitment ||
      !assessment.q5_travel_willingness
    ) {
      return { success: false, error: 'Please answer all questions before completing the assessment' }
    }

    // Calculate scores
    const skillScore = calculateSkillScore(assessment.q3_skill_level)
    const willScore = calculateWillScore(assessment.q4_time_commitment)
    const category = calculateCategory(skillScore, willScore)

    // Get vertical recommendations based on energy focus and age group
    const verticalRecommendations = await getVerticalRecommendations(
      supabase,
      assessment.chapter_id,
      assessment.q1_energy_focus,
      assessment.q2_age_group
    )

    // Generate development roadmap
    const roadmap = generateRoadmap(category, assessment.q1_energy_focus)

    // Update assessment with results
    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        skill_score: skillScore,
        will_score: willScore,
        category,
        recommended_vertical_id: verticalRecommendations.primary?.vertical_id || null,
        recommended_match_pct: verticalRecommendations.primary?.match_pct || null,
        alternative_verticals: verticalRecommendations.alternatives,
        roadmap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.id)

    if (updateError) {
      throw new Error(`Failed to complete assessment: ${updateError.message}`)
    }

    // Update member's skill_will_category
    const { error: memberUpdateError } = await supabase
      .from('members')
      .update({ skill_will_category: category })
      .eq('id', assessment.member_id)

    if (memberUpdateError) {
      console.error('Failed to update member category:', memberUpdateError)
    }

    revalidatePath('/members')
    revalidatePath(`/members/${assessment.member_id}`)

    return { success: true, data: { category } }
  } catch (error) {
    console.error('Complete assessment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete assessment',
    }
  }
}

// ============================================================================
// Assignment Actions
// ============================================================================

/**
 * Assign a vertical to a member based on assessment
 */
export async function assignVertical(
  input: unknown
): Promise<ActionResult> {
  try {
    const validated = assignVerticalSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    // Get assessment to find member_id
    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('member_id')
      .eq('id', validated.assessment_id)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    // Update assessment
    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        assigned_vertical_id: validated.vertical_id,
        assigned_by: validated.assigned_by,
        assigned_at: new Date().toISOString(),
        assignment_notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.assessment_id)

    if (updateError) {
      throw new Error(`Failed to assign vertical: ${updateError.message}`)
    }

    // Add member to vertical_members
    const { error: insertError } = await supabase
      .from('vertical_members')
      .upsert({
        vertical_id: validated.vertical_id,
        member_id: assessment.member_id,
        joined_date: new Date().toISOString().split('T')[0],
        is_active: true,
      }, {
        onConflict: 'vertical_id,member_id',
      })

    if (insertError) {
      console.error('Failed to add member to vertical:', insertError)
    }

    revalidatePath('/members')
    revalidatePath(`/members/${assessment.member_id}`)
    revalidatePath('/verticals')

    return { success: true }
  } catch (error) {
    console.error('Assign vertical error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign vertical',
    }
  }
}

/**
 * Assign a mentor to a member
 */
export async function assignMentor(
  input: unknown
): Promise<ActionResult> {
  try {
    const validated = assignMentorSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    // Get assessment
    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('member_id, chapter_id')
      .eq('id', validated.assessment_id)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    // Verify mentor is a Star in the same chapter
    const { data: mentorAssessment } = await supabase
      .from('skill_will_assessments')
      .select('category')
      .eq('member_id', validated.mentor_id)
      .eq('chapter_id', assessment.chapter_id)
      .eq('status', 'completed')
      .eq('category', 'star')
      .maybeSingle()

    if (!mentorAssessment) {
      return { success: false, error: 'Selected mentor is not a Star member in this chapter' }
    }

    // Update assessment
    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        mentor_id: validated.mentor_id,
        mentor_assigned_at: new Date().toISOString(),
        mentor_notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.assessment_id)

    if (updateError) {
      throw new Error(`Failed to assign mentor: ${updateError.message}`)
    }

    revalidatePath('/members')
    revalidatePath(`/members/${assessment.member_id}`)

    return { success: true }
  } catch (error) {
    console.error('Assign mentor error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign mentor',
    }
  }
}

/**
 * Update the development roadmap
 */
export async function updateRoadmap(
  input: unknown
): Promise<ActionResult> {
  try {
    const validated = updateRoadmapSchema.parse(input)
    const supabase = await createServerSupabaseClient()

    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('member_id')
      .eq('id', validated.assessment_id)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        roadmap: validated.roadmap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.assessment_id)

    if (updateError) {
      throw new Error(`Failed to update roadmap: ${updateError.message}`)
    }

    revalidatePath(`/members/${assessment.member_id}`)

    return { success: true }
  } catch (error) {
    console.error('Update roadmap error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update roadmap',
    }
  }
}

/**
 * Mark a roadmap milestone as completed
 */
export async function completeRoadmapMilestone(
  assessmentId: string,
  milestoneMonth: number
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('member_id, roadmap')
      .eq('id', assessmentId)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    const roadmap = (assessment.roadmap || []) as RoadmapMilestone[]
    const milestoneIndex = roadmap.findIndex((m) => m.month === milestoneMonth)

    if (milestoneIndex === -1) {
      return { success: false, error: 'Milestone not found' }
    }

    roadmap[milestoneIndex] = {
      ...roadmap[milestoneIndex],
      completed: true,
      completed_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        roadmap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)

    if (updateError) {
      throw new Error(`Failed to complete milestone: ${updateError.message}`)
    }

    revalidatePath(`/members/${assessment.member_id}`)

    return { success: true }
  } catch (error) {
    console.error('Complete milestone error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete milestone',
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get vertical recommendations based on assessment answers
 */
async function getVerticalRecommendations(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  chapterId: string,
  energyFocus: string,
  ageGroup: string
): Promise<{
  primary: AlternativeVertical | null
  alternatives: AlternativeVertical[]
}> {
  // Get all active verticals for the chapter
  const { data: verticals } = await supabase
    .from('verticals')
    .select('id, name, description')
    .eq('chapter_id', chapterId)
    .eq('is_active', true)

  if (!verticals || verticals.length === 0) {
    return { primary: null, alternatives: [] }
  }

  // Score each vertical based on energy focus and age group match
  const scoredVerticals: AlternativeVertical[] = verticals.map((v: { id: string; name: string }) => {
    let matchScore = 50 // Base score

    // Match energy focus to vertical type
    const verticalName = v.name.toLowerCase()

    if (energyFocus === 'teaching_mentoring') {
      if (verticalName.includes('thalir') || verticalName.includes('yuva') || verticalName.includes('masoom')) {
        matchScore += 30
      }
    } else if (energyFocus === 'organizing_events') {
      if (verticalName.includes('youth') || verticalName.includes('program')) {
        matchScore += 30
      }
    } else if (energyFocus === 'fieldwork') {
      if (verticalName.includes('road') || verticalName.includes('safety') || verticalName.includes('community')) {
        matchScore += 30
      }
    }

    // Match age group to vertical
    if (ageGroup === 'children_5_12') {
      if (verticalName.includes('thalir') || verticalName.includes('masoom')) {
        matchScore += 20
      }
    } else if (ageGroup === 'teenagers_15_22') {
      if (verticalName.includes('yuva')) {
        matchScore += 20
      }
    } else if (ageGroup === 'adults_25_plus') {
      if (verticalName.includes('road') || verticalName.includes('business')) {
        matchScore += 20
      }
    } else if (ageGroup === 'all_ages') {
      matchScore += 10 // Flexible, works with any vertical
    }

    return {
      vertical_id: v.id,
      vertical_name: v.name,
      match_pct: Math.min(100, matchScore),
      reason: generateMatchReason(v.name, energyFocus, ageGroup),
    }
  })

  // Sort by match percentage
  scoredVerticals.sort((a, b) => b.match_pct - a.match_pct)

  return {
    primary: scoredVerticals[0] || null,
    alternatives: scoredVerticals.slice(1, 4), // Top 3 alternatives
  }
}

/**
 * Generate a reason for vertical match
 */
function generateMatchReason(
  verticalName: string,
  energyFocus: string,
  ageGroup: string
): string {
  const focusMap: Record<string, string> = {
    teaching_mentoring: 'teaching and mentoring skills',
    organizing_events: 'event organization abilities',
    corporate_partnerships: 'corporate relationship skills',
    fieldwork: 'hands-on fieldwork experience',
    creative_work: 'creative and innovative approach',
  }

  const ageMap: Record<string, string> = {
    children_5_12: 'children aged 5-12',
    teenagers_15_22: 'teenagers aged 15-22',
    adults_25_plus: 'adults aged 25+',
    all_ages: 'all age groups',
  }

  return `Based on your ${focusMap[energyFocus] || 'skills'} and preference for working with ${ageMap[ageGroup] || 'various ages'}.`
}

/**
 * Generate development roadmap based on category
 */
function generateRoadmap(
  category: SkillWillCategory,
  energyFocus: string
): RoadmapMilestone[] {
  const roadmaps: Record<SkillWillCategory, RoadmapMilestone[]> = {
    star: [
      {
        month: 1,
        title: 'Lead a Session',
        description: 'Take ownership of conducting a session independently',
        tasks: ['Select session topic', 'Prepare materials', 'Conduct session', 'Collect feedback'],
        completed: false,
      },
      {
        month: 2,
        title: 'Mentor an Enthusiast',
        description: 'Guide a new member through their development',
        tasks: ['Connect with assigned mentee', 'Create development plan', 'Weekly check-ins'],
        completed: false,
      },
      {
        month: 3,
        title: 'Process Improvement',
        description: 'Identify and implement one process improvement',
        tasks: ['Document current process', 'Identify improvement area', 'Implement change', 'Measure impact'],
        completed: false,
      },
      {
        month: 4,
        title: 'Training Module',
        description: 'Create a training module for new members',
        tasks: ['Identify knowledge gap', 'Create training content', 'Pilot with small group', 'Refine based on feedback'],
        completed: false,
      },
      {
        month: 5,
        title: 'Cross-Vertical Initiative',
        description: 'Lead a collaboration between verticals',
        tasks: ['Identify collaboration opportunity', 'Coordinate with vertical heads', 'Execute initiative'],
        completed: false,
      },
      {
        month: 6,
        title: 'Leadership Preparation',
        description: 'Prepare for EC or vertical head role',
        tasks: ['Shadow current leader', 'Understand responsibilities', 'Create vision document'],
        completed: false,
      },
    ],
    enthusiast: [
      {
        month: 1,
        title: 'Shadow a Star',
        description: 'Observe and learn from experienced members',
        tasks: ['Connect with mentor', 'Attend 2-3 sessions as observer', 'Take notes and ask questions'],
        completed: false,
      },
      {
        month: 2,
        title: 'Assist in Session',
        description: 'Take supporting role in a session',
        tasks: ['Volunteer for logistics', 'Help with attendee coordination', 'Support trainer during session'],
        completed: false,
      },
      {
        month: 3,
        title: 'Co-Lead Session',
        description: 'Partner with experienced member to lead',
        tasks: ['Prepare content together', 'Deliver part of session', 'Handle Q&A section'],
        completed: false,
      },
      {
        month: 4,
        title: 'Independent Session',
        description: 'Conduct your first solo session',
        tasks: ['Choose familiar topic', 'Prepare thoroughly', 'Conduct session', 'Get feedback from mentor'],
        completed: false,
      },
      {
        month: 5,
        title: 'Skill Building',
        description: 'Complete relevant certification or training',
        tasks: ['Identify skill gap', 'Enroll in training', 'Complete certification', 'Apply learning'],
        completed: false,
      },
      {
        month: 6,
        title: 'Take Initiative',
        description: 'Propose and execute a new idea',
        tasks: ['Identify improvement opportunity', 'Create proposal', 'Get approval', 'Execute with support'],
        completed: false,
      },
    ],
    cynic: [
      {
        month: 1,
        title: 'One-on-One Discussion',
        description: 'Understand blockers and concerns',
        tasks: ['Meet with chapter chair', 'Share concerns openly', 'Identify specific blockers'],
        completed: false,
      },
      {
        month: 2,
        title: 'Flexible Contribution',
        description: 'Find contribution method that works',
        tasks: ['Explore different roles', 'Try time-bound tasks', 'Identify preferred contribution style'],
        completed: false,
      },
      {
        month: 3,
        title: 'Recognition Milestone',
        description: 'Get recognized for contributions',
        tasks: ['Complete assigned tasks', 'Document contributions', 'Receive acknowledgment'],
        completed: false,
      },
      {
        month: 4,
        title: 'Mentoring Role',
        description: 'Share expertise with others',
        tasks: ['Identify mentee', 'Share knowledge in area of expertise', 'Build relationship'],
        completed: false,
      },
      {
        month: 5,
        title: 'Own Initiative',
        description: 'Lead a project of choice',
        tasks: ['Propose project aligned with interests', 'Get resources', 'Execute independently'],
        completed: false,
      },
      {
        month: 6,
        title: 'Re-Engagement Review',
        description: 'Evaluate engagement improvement',
        tasks: ['Self-assessment', 'Meet with chair', 'Plan next steps'],
        completed: false,
      },
    ],
    dead_wood: [
      {
        month: 1,
        title: 'Honest Conversation',
        description: 'Discuss engagement and interests',
        tasks: ['Meet with chapter chair', 'Discuss current situation', 'Explore interests'],
        completed: false,
      },
      {
        month: 2,
        title: 'Trial Period',
        description: 'Try different roles and activities',
        tasks: ['Attend different types of events', 'Try various roles', 'Report on preferences'],
        completed: false,
      },
      {
        month: 3,
        title: 'Decision Point',
        description: 'Decide on continued engagement',
        tasks: ['Review trial period', 'Discuss findings', 'Make commitment or graceful exit'],
        completed: false,
      },
      {
        month: 4,
        title: 'If Continuing: Basic Training',
        description: 'Complete foundational training',
        tasks: ['Attend orientation', 'Complete basic modules', 'Pass assessment'],
        completed: false,
      },
      {
        month: 5,
        title: 'Supported Activity',
        description: 'Participate with full support',
        tasks: ['Join activity with buddy', 'Complete assigned tasks', 'Regular check-ins'],
        completed: false,
      },
      {
        month: 6,
        title: 'Progress Review',
        description: 'Assess improvement and path forward',
        tasks: ['Self-assessment', 'Chair review', 'Plan continuation or transition'],
        completed: false,
      },
    ],
  }

  return roadmaps[category] || []
}
