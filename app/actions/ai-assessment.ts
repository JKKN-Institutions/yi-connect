'use server'

/**
 * AI Assessment Server Actions
 *
 * Server actions for the AI-adaptive Skill-Will assessment.
 * Integrates with Claude API for intelligent analysis.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentChapterId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  analyzeAssessment,
  getQuestionSuggestion,
  generateRoadmap,
  algorithmicScoring,
} from '@/lib/ai-assessment'
import type {
  SkillWillAssessment,
  AssessmentFormInput,
  StartAssessmentInput,
  SubmitAnswerInput,
  CompleteAssessmentInput,
  AssignVerticalInput,
  AssignMentorInput,
  AISuggestionRequest,
  AIAnalysisRequest,
} from '@/types/ai-assessment'

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Assessment Actions
// ============================================================================

/**
 * Start a new assessment for a member
 */
export async function startAssessment(
  input?: StartAssessmentInput
): Promise<ActionResult<{ assessment_id: string }>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const memberId = input?.member_id || user.id
    const chapterId = input?.chapter_id || await getCurrentChapterId()

    if (!chapterId) {
      return { success: false, error: 'Chapter ID not found' }
    }

    // Check for existing active assessment
    const { data: existing } = await supabase
      .from('skill_will_assessments')
      .select('id, status')
      .eq('member_id', memberId)
      .in('status', ['pending', 'in_progress'])
      .single()

    if (existing) {
      // Return existing assessment
      return { success: true, data: { assessment_id: existing.id } }
    }

    // Create new assessment
    const { data, error } = await supabase
      .from('skill_will_assessments')
      .insert({
        member_id: memberId,
        chapter_id: chapterId,
        status: 'pending',
        version: 1,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating assessment:', error)
      return { success: false, error: 'Failed to start assessment' }
    }

    revalidatePath('/assessment')
    return { success: true, data: { assessment_id: data.id } }
  } catch (error) {
    console.error('Error in startAssessment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Submit an answer for a specific question
 */
export async function submitAnswer(
  input: SubmitAnswerInput
): Promise<ActionResult<{ ai_suggestion?: { suggestion: string; reason: string } }>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get current assessment
    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('id', input.assessment_id)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    // Verify ownership
    if (assessment.member_id !== user.id) {
      return { success: false, error: 'Not authorized to update this assessment' }
    }

    // Verify status
    if (!['pending', 'in_progress'].includes(assessment.status)) {
      return { success: false, error: 'Assessment is not active' }
    }

    // Build update object
    const columnMap: Record<number, string> = {
      1: 'q1_energy_focus',
      2: 'q2_age_group',
      3: 'q3_skill_level',
      4: 'q4_time_commitment',
      5: 'q5_travel_willingness',
    }

    const column = columnMap[input.question_number]
    if (!column) {
      return { success: false, error: 'Invalid question number' }
    }

    const updateData: Record<string, unknown> = {
      [column]: input.answer,
      status: 'in_progress',
      started_at: assessment.started_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Update assessment
    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update(updateData)
      .eq('id', input.assessment_id)

    if (updateError) {
      console.error('Error updating assessment:', updateError)
      return { success: false, error: 'Failed to save answer' }
    }

    // Get AI suggestion for next question if not last
    let aiSuggestion = undefined
    if (input.question_number < 5) {
      try {
        const previousAnswers: Partial<AssessmentFormInput> = {}
        if (assessment.q1_energy_focus) previousAnswers.q1_energy_focus = assessment.q1_energy_focus
        if (assessment.q2_age_group) previousAnswers.q2_age_group = assessment.q2_age_group
        if (assessment.q3_skill_level) previousAnswers.q3_skill_level = assessment.q3_skill_level
        if (assessment.q4_time_commitment) previousAnswers.q4_time_commitment = assessment.q4_time_commitment

        // Add current answer
        previousAnswers[column as keyof AssessmentFormInput] = input.answer as never

        const suggestion = await getQuestionSuggestion({
          question_number: (input.question_number + 1) as 1 | 2 | 3 | 4 | 5,
          previous_answers: previousAnswers,
        })

        aiSuggestion = {
          suggestion: suggestion.suggestion,
          reason: suggestion.reason,
        }

        // Store AI suggestion
        const aiColumn = `q${input.question_number + 1}_ai_suggestion`
        const reasonColumn = `q${input.question_number + 1}_ai_reason`

        await supabase
          .from('skill_will_assessments')
          .update({
            [aiColumn]: suggestion.suggestion,
            [reasonColumn]: suggestion.reason,
          })
          .eq('id', input.assessment_id)

      } catch {
        // AI suggestion failed, continue without it
        console.warn('AI suggestion failed, continuing without')
      }
    }

    revalidatePath('/assessment')
    return { success: true, data: { ai_suggestion: aiSuggestion } }
  } catch (error) {
    console.error('Error in submitAnswer:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Complete the assessment and get AI analysis
 */
export async function completeAssessment(
  input: CompleteAssessmentInput
): Promise<ActionResult<{
  category: string
  skill_score: number
  will_score: number
  recommended_vertical?: string
  recommended_match_pct?: number
}>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get assessment with all answers
    const { data: assessment, error: fetchError } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('id', input.assessment_id)
      .single()

    if (fetchError || !assessment) {
      return { success: false, error: 'Assessment not found' }
    }

    // Verify ownership
    if (assessment.member_id !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    // Verify all questions are answered
    if (!assessment.q1_energy_focus || !assessment.q2_age_group ||
        !assessment.q3_skill_level || !assessment.q4_time_commitment ||
        !assessment.q5_travel_willingness) {
      return { success: false, error: 'Please answer all questions before completing' }
    }

    // Get member data
    const { data: member } = await supabase
      .from('members')
      .select('full_name, join_date')
      .eq('id', user.id)
      .single()

    // Get verticals
    const { data: verticals } = await supabase
      .from('verticals')
      .select('id, name, description')
      .eq('chapter_id', assessment.chapter_id)

    // Prepare AI analysis request
    const analysisRequest: AIAnalysisRequest = {
      assessment_id: input.assessment_id,
      member_data: {
        name: member?.full_name || 'Member',
        join_date: member?.join_date,
      },
      answers: {
        q1_energy_focus: assessment.q1_energy_focus,
        q2_age_group: assessment.q2_age_group,
        q3_skill_level: assessment.q3_skill_level,
        q4_time_commitment: assessment.q4_time_commitment,
        q5_travel_willingness: assessment.q5_travel_willingness,
      },
      verticals: (verticals || []).map(v => ({
        id: v.id,
        name: v.name,
        description: v.description || '',
        focus_areas: [],
      })),
    }

    // Get AI analysis
    const aiResult = await analyzeAssessment(analysisRequest)

    // Get top vertical recommendation
    const topRecommendation = aiResult.vertical_recommendations[0]

    // Generate roadmap
    const roadmap = await generateRoadmap(
      aiResult.combined_analysis.category,
      topRecommendation?.vertical_name || 'General',
      aiResult.combined_analysis.final_skill_score,
      aiResult.combined_analysis.final_will_score
    )

    // Update assessment with results
    const { error: updateError } = await supabase
      .from('skill_will_assessments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        skill_score: aiResult.combined_analysis.final_skill_score,
        will_score: aiResult.combined_analysis.final_will_score,
        category: aiResult.combined_analysis.category,
        ai_scoring_result: aiResult,
        ai_classification_confidence: aiResult.combined_analysis.confidence,
        recommended_vertical_id: topRecommendation?.vertical_id,
        recommended_match_pct: topRecommendation?.match_percentage,
        alternative_verticals: aiResult.vertical_recommendations.slice(1).map(r => ({
          vertical_name: r.vertical_name,
          match_pct: r.match_percentage,
          reason: r.reasons[0] || '',
        })),
        roadmap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.assessment_id)

    if (updateError) {
      console.error('Error completing assessment:', updateError)
      return { success: false, error: 'Failed to save results' }
    }

    revalidatePath('/assessment')
    revalidatePath('/members')

    return {
      success: true,
      data: {
        category: aiResult.combined_analysis.category,
        skill_score: aiResult.combined_analysis.final_skill_score,
        will_score: aiResult.combined_analysis.final_will_score,
        recommended_vertical: topRecommendation?.vertical_name,
        recommended_match_pct: topRecommendation?.match_percentage,
      },
    }
  } catch (error) {
    console.error('Error in completeAssessment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get assessment by ID
 */
export async function getAssessment(
  assessmentId: string
): Promise<ActionResult<SkillWillAssessment>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('id', assessmentId)
      .single()

    if (error || !data) {
      return { success: false, error: 'Assessment not found' }
    }

    return { success: true, data: data as SkillWillAssessment }
  } catch (error) {
    console.error('Error in getAssessment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get current member's assessment
 */
export async function getMyAssessment(): Promise<ActionResult<SkillWillAssessment | null>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows" error, which is fine
      console.error('Error fetching assessment:', error)
    }

    return { success: true, data: data as SkillWillAssessment | null }
  } catch (error) {
    console.error('Error in getMyAssessment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// Admin Actions
// ============================================================================

/**
 * Assign a vertical to a member based on assessment
 */
export async function assignVertical(
  input: AssignVerticalInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('skill_will_assessments')
      .update({
        assigned_vertical_id: input.vertical_id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        assignment_notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.assessment_id)

    if (error) {
      console.error('Error assigning vertical:', error)
      return { success: false, error: 'Failed to assign vertical' }
    }

    revalidatePath('/assessment')
    revalidatePath('/members')
    return { success: true }
  } catch (error) {
    console.error('Error in assignVertical:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Assign a mentor to a member
 */
export async function assignMentor(
  input: AssignMentorInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('skill_will_assessments')
      .update({
        mentor_id: input.mentor_id,
        mentor_assigned_at: new Date().toISOString(),
        mentor_notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.assessment_id)

    if (error) {
      console.error('Error assigning mentor:', error)
      return { success: false, error: 'Failed to assign mentor' }
    }

    revalidatePath('/assessment')
    revalidatePath('/members')
    return { success: true }
  } catch (error) {
    console.error('Error in assignMentor:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Handle member's change request
 */
export async function reviewChangeRequest(
  assessmentId: string,
  decision: 'approved' | 'denied',
  newVerticalId?: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const updateData: Record<string, unknown> = {
      change_reviewed_by: user.id,
      change_reviewed_at: new Date().toISOString(),
      change_decision: decision,
      updated_at: new Date().toISOString(),
    }

    if (decision === 'approved' && newVerticalId) {
      updateData.assigned_vertical_id = newVerticalId
      updateData.assigned_by = user.id
      updateData.assigned_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('skill_will_assessments')
      .update(updateData)
      .eq('id', assessmentId)

    if (error) {
      console.error('Error reviewing change request:', error)
      return { success: false, error: 'Failed to process change request' }
    }

    revalidatePath('/assessment')
    revalidatePath('/members')
    return { success: true }
  } catch (error) {
    console.error('Error in reviewChangeRequest:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Accept or request change for recommendation
 */
export async function respondToRecommendation(
  assessmentId: string,
  accepted: boolean,
  changeReason?: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const updateData: Record<string, unknown> = {
      recommendation_accepted: accepted,
      updated_at: new Date().toISOString(),
    }

    if (!accepted) {
      updateData.change_requested = true
      updateData.change_request_reason = changeReason
    }

    const { error } = await supabase
      .from('skill_will_assessments')
      .update(updateData)
      .eq('id', assessmentId)
      .eq('member_id', user.id)

    if (error) {
      console.error('Error responding to recommendation:', error)
      return { success: false, error: 'Failed to save response' }
    }

    revalidatePath('/assessment')
    return { success: true }
  } catch (error) {
    console.error('Error in respondToRecommendation:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get assessment statistics for dashboard
 */
export async function getAssessmentStats(
  chapterId?: string
): Promise<ActionResult<{
  total: number
  completed: number
  pending: number
  by_category: Record<string, number>
}>> {
  try {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('skill_will_assessments')
      .select('status, category')

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stats:', error)
      return { success: false, error: 'Failed to fetch statistics' }
    }

    const stats = {
      total: data.length,
      completed: data.filter(a => a.status === 'completed').length,
      pending: data.filter(a => ['pending', 'in_progress'].includes(a.status)).length,
      by_category: {
        star: data.filter(a => a.category === 'star').length,
        enthusiast: data.filter(a => a.category === 'enthusiast').length,
        cynic: data.filter(a => a.category === 'cynic').length,
        dead_wood: data.filter(a => a.category === 'dead_wood').length,
      },
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error in getAssessmentStats:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
