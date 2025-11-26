/**
 * AI-Adaptive Assessment Library
 *
 * Claude API integration for Skill-Will assessment analysis.
 * Provides adaptive question suggestions and scoring.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AssessmentFormInput,
  AIScoringResult,
  AISuggestion,
  AssessmentOption,
  SkillWillCategory,
  VerticalRecommendation,
  AIAnalysisRequest,
  AISuggestionRequest,
  ASSESSMENT_QUESTIONS,
} from '@/types/ai-assessment'

// ============================================================================
// CLAUDE CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-20250514'

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

const SKILL_WEIGHTS = {
  skill_level: 0.5,       // Q3: Experience level
  energy_focus: 0.25,     // Q1: Domain expertise indicator
  age_group: 0.25,        // Q2: Specialization indicator
}

const WILL_WEIGHTS = {
  time_commitment: 0.4,   // Q4: Time availability
  travel_willingness: 0.3, // Q5: Flexibility
  energy_focus: 0.3,      // Q1: Passion indicator
}

// ============================================================================
// BASE SCORE MAPPINGS
// ============================================================================

const SKILL_LEVEL_SCORES: Record<string, number> = {
  none: 0.1,
  beginner: 0.3,
  intermediate: 0.6,
  expert: 0.9,
}

const TIME_COMMITMENT_SCORES: Record<string, number> = {
  under_2_hours: 0.2,
  hours_5_10: 0.5,
  hours_10_15: 0.75,
  hours_15_plus: 0.95,
}

const TRAVEL_WILLINGNESS_SCORES: Record<string, number> = {
  city_only: 0.3,
  district: 0.5,
  neighboring: 0.75,
  all_state: 1.0,
}

// ============================================================================
// VERTICAL MAPPING
// ============================================================================

const ENERGY_TO_VERTICAL: Record<string, string[]> = {
  teaching_mentoring: ['Yuva', 'Thalir', 'YEA'],
  organizing_events: ['Events', 'YEA'],
  corporate_partnerships: ['Industry', 'YEA'],
  fieldwork: ['Yuva', 'Thalir', 'Industry'],
  creative_work: ['Communications', 'YEA'],
}

const AGE_TO_VERTICAL: Record<string, string[]> = {
  children_5_12: ['Thalir'],
  teenagers_15_22: ['Yuva', 'YEA'],
  adults_25_plus: ['Industry', 'YEA'],
  all_ages: ['Yuva', 'Thalir', 'Industry', 'YEA'],
}

// ============================================================================
// AI ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze assessment answers using Claude API
 *
 * Returns comprehensive scoring and vertical recommendations.
 */
export async function analyzeAssessment(
  request: AIAnalysisRequest
): Promise<AIScoringResult> {
  const systemPrompt = `You are an expert in volunteer management and skill assessment for Yi (Young Indians), a youth organization part of CII. Your role is to analyze assessment responses and provide accurate skill-will categorization and vertical recommendations.

Yi Verticals:
1. Yuva - Youth engagement in schools and colleges (15-22 age group)
2. Thalir - Children's development programs (5-12 age group)
3. Industry - Corporate partnerships and industry connections
4. YEA - Young Entrepreneurs Alliance for business mentorship

Skill-Will Categories:
- Star: High skill (0.6+) + High will (0.6+) - Leaders and mentors
- Enthusiast: Low skill (<0.6) + High will (0.6+) - Eager learners
- Cynic: High skill (0.6+) + Low will (<0.6) - Needs engagement
- Dead Wood: Low skill (<0.6) + Low will (<0.6) - Needs reassessment

Respond ONLY with valid JSON matching this structure:
{
  "skill_analysis": {
    "experience_score": <0-1>,
    "expertise_score": <0-1>,
    "contribution_potential": <0-1>,
    "factors": ["factor1", "factor2"]
  },
  "will_analysis": {
    "commitment_score": <0-1>,
    "enthusiasm_score": <0-1>,
    "flexibility_score": <0-1>,
    "factors": ["factor1", "factor2"]
  },
  "combined_analysis": {
    "final_skill_score": <0-1>,
    "final_will_score": <0-1>,
    "category": "star|enthusiast|cynic|dead_wood",
    "confidence": <0-1>,
    "reasoning": "explanation"
  },
  "vertical_recommendations": [
    {
      "vertical_id": "id",
      "vertical_name": "name",
      "match_percentage": <0-100>,
      "reasons": ["reason1", "reason2"],
      "development_areas": ["area1"]
    }
  ]
}`

  const userPrompt = `Analyze this Yi member's assessment:

Member: ${request.member_data.name}
${request.member_data.join_date ? `Joined: ${request.member_data.join_date}` : ''}
${request.member_data.previous_experience?.length ? `Previous Experience: ${request.member_data.previous_experience.join(', ')}` : ''}
${request.member_data.skills?.length ? `Skills: ${request.member_data.skills.join(', ')}` : ''}

Assessment Responses:
Q1 - Energy Focus: ${formatAnswer(request.answers.q1_energy_focus)}
Q2 - Age Group Preference: ${formatAnswer(request.answers.q2_age_group)}
Q3 - Skill Level: ${formatAnswer(request.answers.q3_skill_level)}
Q4 - Time Commitment: ${formatAnswer(request.answers.q4_time_commitment)}
Q5 - Travel Willingness: ${formatAnswer(request.answers.q5_travel_willingness)}

Available Verticals:
${request.verticals.map(v => `- ${v.name}: ${v.description} (Focus: ${v.focus_areas.join(', ')})`).join('\n')}

Provide detailed analysis and recommendations.`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    const result = JSON.parse(textBlock.text) as AIScoringResult

    // Validate and normalize scores
    result.combined_analysis.final_skill_score = Math.max(0, Math.min(1, result.combined_analysis.final_skill_score))
    result.combined_analysis.final_will_score = Math.max(0, Math.min(1, result.combined_analysis.final_will_score))

    // Verify category matches scores
    result.combined_analysis.category = determineCategory(
      result.combined_analysis.final_skill_score,
      result.combined_analysis.final_will_score
    )

    return result

  } catch (error) {
    console.error('Claude API error:', error)
    // Fallback to algorithmic scoring
    return algorithmicScoring(request)
  }
}

/**
 * Get AI suggestion for a specific question
 *
 * Provides adaptive options based on previous answers.
 */
export async function getQuestionSuggestion(
  request: AISuggestionRequest
): Promise<AISuggestion & { adaptive_options?: AssessmentOption[] }> {
  const systemPrompt = `You are an AI assistant helping Yi members complete their Skill-Will assessment. Based on their previous answers, suggest the most appropriate answer for the current question and explain why.

Respond ONLY with valid JSON:
{
  "suggestion": "suggested_value",
  "reason": "brief explanation",
  "confidence": <0-1>,
  "alternative_options": ["option1", "option2"]
}`

  const userPrompt = `Based on these previous answers, suggest an answer for Question ${request.question_number}:

Previous Answers:
${Object.entries(request.previous_answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

${request.member_context ? `Member Context:
- Profession: ${request.member_context.profession || 'Not specified'}
- Interests: ${request.member_context.interests?.join(', ') || 'Not specified'}
- Availability: ${request.member_context.availability || 'Not specified'}` : ''}

Question ${request.question_number}: ${getQuestionText(request.question_number)}

What would be the most suitable answer based on the pattern of previous responses?`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const result = JSON.parse(textBlock.text)

    return {
      suggestion: result.suggestion,
      reason: result.reason,
      confidence: result.confidence,
      alternativeOptions: result.alternative_options,
    }

  } catch (error) {
    console.error('Claude API error for suggestion:', error)
    // Return default suggestion
    return getDefaultSuggestion(request)
  }
}

/**
 * Generate development roadmap using AI
 */
export async function generateRoadmap(
  category: SkillWillCategory,
  verticalName: string,
  skillScore: number,
  willScore: number
): Promise<Array<{ month: number; title: string; tasks: Array<{ id: string; description: string; completed: boolean }> }>> {
  const systemPrompt = `You are a mentor for Yi volunteers. Create a 3-month development roadmap based on the member's skill-will category.

Respond ONLY with valid JSON array:
[
  {
    "month": 1,
    "title": "Month 1 Title",
    "tasks": [
      {"id": "1-1", "description": "Task description", "completed": false}
    ]
  }
]`

  const userPrompt = `Create a development roadmap for:
- Category: ${category}
- Assigned Vertical: ${verticalName}
- Skill Score: ${(skillScore * 100).toFixed(0)}%
- Will Score: ${(willScore * 100).toFixed(0)}%

Focus areas based on category:
${getCategoryFocus(category)}

Create a realistic 3-month plan with 3-4 tasks per month.`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return JSON.parse(textBlock.text)

  } catch (error) {
    console.error('Claude API error for roadmap:', error)
    return getDefaultRoadmap(category, verticalName)
  }
}

// ============================================================================
// ALGORITHMIC FALLBACK
// ============================================================================

/**
 * Algorithmic scoring when AI is unavailable
 */
function algorithmicScoring(request: AIAnalysisRequest): AIScoringResult {
  const answers = request.answers

  // Calculate skill score
  const skillLevelScore = SKILL_LEVEL_SCORES[answers.q3_skill_level] || 0.5
  const energySkillBonus = answers.q1_energy_focus === 'teaching_mentoring' ? 0.1 :
                          answers.q1_energy_focus === 'corporate_partnerships' ? 0.15 : 0
  const skillScore = Math.min(1, skillLevelScore * SKILL_WEIGHTS.skill_level +
                              energySkillBonus * SKILL_WEIGHTS.energy_focus +
                              0.5 * SKILL_WEIGHTS.age_group)

  // Calculate will score
  const timeScore = TIME_COMMITMENT_SCORES[answers.q4_time_commitment] || 0.5
  const travelScore = TRAVEL_WILLINGNESS_SCORES[answers.q5_travel_willingness] || 0.5
  const energyWillBonus = ['teaching_mentoring', 'fieldwork'].includes(answers.q1_energy_focus) ? 0.1 : 0
  const willScore = Math.min(1, timeScore * WILL_WEIGHTS.time_commitment +
                             travelScore * WILL_WEIGHTS.travel_willingness +
                             (0.5 + energyWillBonus) * WILL_WEIGHTS.energy_focus)

  const category = determineCategory(skillScore, willScore)

  // Generate vertical recommendations
  const recommendations = generateVerticalRecommendations(answers, request.verticals)

  return {
    skill_analysis: {
      experience_score: skillLevelScore,
      expertise_score: skillScore,
      contribution_potential: (skillScore + willScore) / 2,
      factors: [`Skill level: ${answers.q3_skill_level}`, `Focus area: ${answers.q1_energy_focus}`],
    },
    will_analysis: {
      commitment_score: timeScore,
      enthusiasm_score: willScore,
      flexibility_score: travelScore,
      factors: [`Time: ${answers.q4_time_commitment}`, `Travel: ${answers.q5_travel_willingness}`],
    },
    combined_analysis: {
      final_skill_score: Math.round(skillScore * 100) / 100,
      final_will_score: Math.round(willScore * 100) / 100,
      category,
      confidence: 0.75,
      reasoning: `Based on ${answers.q3_skill_level} skill level with ${answers.q4_time_commitment} time commitment.`,
    },
    vertical_recommendations: recommendations,
  }
}

/**
 * Determine category from scores
 */
function determineCategory(skillScore: number, willScore: number): SkillWillCategory {
  const threshold = 0.6

  if (skillScore >= threshold && willScore >= threshold) return 'star'
  if (skillScore < threshold && willScore >= threshold) return 'enthusiast'
  if (skillScore >= threshold && willScore < threshold) return 'cynic'
  return 'dead_wood'
}

/**
 * Generate vertical recommendations algorithmically
 */
function generateVerticalRecommendations(
  answers: AssessmentFormInput,
  verticals: AIAnalysisRequest['verticals']
): VerticalRecommendation[] {
  const energyVerticals = ENERGY_TO_VERTICAL[answers.q1_energy_focus] || []
  const ageVerticals = AGE_TO_VERTICAL[answers.q2_age_group] || []

  return verticals
    .map(v => {
      let score = 0
      const reasons: string[] = []

      // Energy focus match
      if (energyVerticals.includes(v.name)) {
        score += 40
        reasons.push(`Matches ${answers.q1_energy_focus} focus`)
      }

      // Age group match
      if (ageVerticals.includes(v.name)) {
        score += 30
        reasons.push(`Suitable for ${answers.q2_age_group} preference`)
      }

      // Skill level bonus
      if (answers.q3_skill_level === 'expert') {
        score += 15
        reasons.push('Expert level skills valued')
      } else if (answers.q3_skill_level === 'intermediate') {
        score += 10
      }

      // Time commitment bonus
      if (['hours_10_15', 'hours_15_plus'].includes(answers.q4_time_commitment)) {
        score += 15
        reasons.push('High time availability')
      }

      return {
        vertical_id: v.id,
        vertical_name: v.name,
        match_percentage: Math.min(100, score),
        reasons,
        development_areas: score < 70 ? ['Training needed for full effectiveness'] : undefined,
      }
    })
    .sort((a, b) => b.match_percentage - a.match_percentage)
    .slice(0, 3)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatAnswer(answer: string): string {
  return answer.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getQuestionText(questionNumber: number): string {
  const questions: Record<number, string> = {
    1: 'Where do you feel most energized to focus your efforts?',
    2: 'Which age group do you prefer working with?',
    3: 'How would you rate your experience in your chosen area?',
    4: 'How much time can you commit per week?',
    5: 'How far are you willing to travel for activities?',
  }
  return questions[questionNumber] || ''
}

function getDefaultSuggestion(request: AISuggestionRequest): AISuggestion {
  const defaults: Record<number, AISuggestion> = {
    1: { suggestion: 'teaching_mentoring', reason: 'Most impactful for youth development', confidence: 0.6 },
    2: { suggestion: 'teenagers_15_22', reason: 'Matches most Yi activities', confidence: 0.6 },
    3: { suggestion: 'intermediate', reason: 'Common starting point', confidence: 0.5 },
    4: { suggestion: 'hours_5_10', reason: 'Balanced commitment', confidence: 0.6 },
    5: { suggestion: 'district', reason: 'Good flexibility', confidence: 0.6 },
  }
  return defaults[request.question_number] || { suggestion: '', reason: '', confidence: 0.5 }
}

function getCategoryFocus(category: SkillWillCategory): string {
  const focuses: Record<SkillWillCategory, string> = {
    star: 'Leadership development, mentoring others, strategic projects',
    enthusiast: 'Skill building, structured training, guided activities',
    cynic: 'Finding meaningful engagement, high-impact short projects',
    dead_wood: 'Exploration, understanding motivations, finding the right fit',
  }
  return focuses[category]
}

function getDefaultRoadmap(
  category: SkillWillCategory,
  verticalName: string
): Array<{ month: number; title: string; tasks: Array<{ id: string; description: string; completed: boolean }> }> {
  return [
    {
      month: 1,
      title: 'Orientation & Onboarding',
      tasks: [
        { id: '1-1', description: `Complete ${verticalName} vertical orientation`, completed: false },
        { id: '1-2', description: 'Shadow an experienced trainer in 2 sessions', completed: false },
        { id: '1-3', description: 'Review training materials and guidelines', completed: false },
      ],
    },
    {
      month: 2,
      title: 'Active Participation',
      tasks: [
        { id: '2-1', description: 'Co-facilitate at least 2 sessions', completed: false },
        { id: '2-2', description: 'Attend vertical team meeting', completed: false },
        { id: '2-3', description: 'Complete feedback form for sessions attended', completed: false },
      ],
    },
    {
      month: 3,
      title: 'Independent Contribution',
      tasks: [
        { id: '3-1', description: 'Lead an independent session', completed: false },
        { id: '3-2', description: 'Mentor a new volunteer', completed: false },
        { id: '3-3', description: 'Submit monthly activity report', completed: false },
      ],
    },
  ]
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  determineCategory,
  algorithmicScoring,
  SKILL_LEVEL_SCORES,
  TIME_COMMITMENT_SCORES,
  TRAVEL_WILLINGNESS_SCORES,
}
