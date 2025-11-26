/**
 * AI Assessment Edge Function
 *
 * Processes Skill-Will assessments using Claude API.
 * Called from the application when completing an assessment.
 *
 * Endpoints:
 * - POST /analyze: Analyze assessment and generate scores
 * - POST /suggest: Get AI suggestion for next question
 * - POST /roadmap: Generate development roadmap
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0'

// Types
interface AnalyzeRequest {
  assessment_id: string
  member_data: {
    name: string
    join_date?: string
    previous_experience?: string[]
    skills?: string[]
  }
  answers: {
    q1_energy_focus: string
    q2_age_group: string
    q3_skill_level: string
    q4_time_commitment: string
    q5_travel_willingness: string
  }
  verticals: Array<{
    id: string
    name: string
    description: string
    focus_areas: string[]
  }>
}

interface SuggestionRequest {
  question_number: number
  previous_answers: Record<string, string>
  member_context?: {
    profession?: string
    interests?: string[]
    availability?: string
  }
}

interface RoadmapRequest {
  category: string
  vertical_name: string
  skill_score: number
  will_score: number
}

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
})

const MODEL = 'claude-sonnet-4-20250514'

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  // Verify authorization
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    const body = await req.json()

    switch (path) {
      case 'analyze':
        return await handleAnalyze(body as AnalyzeRequest)

      case 'suggest':
        return await handleSuggest(body as SuggestionRequest)

      case 'roadmap':
        return await handleRoadmap(body as RoadmapRequest)

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
    }
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Analyze assessment and generate scores
 */
async function handleAnalyze(request: AnalyzeRequest): Promise<Response> {
  const systemPrompt = `You are an expert in volunteer management and skill assessment for Yi (Young Indians), a youth organization. Analyze assessment responses and provide skill-will categorization and vertical recommendations.

Yi Verticals:
1. Yuva - Youth engagement (15-22 age)
2. Thalir - Children's programs (5-12 age)
3. Industry - Corporate partnerships
4. YEA - Young Entrepreneurs Alliance

Categories (based on skill 0-1 and will 0-1 scores):
- Star: skill>=0.6 AND will>=0.6
- Enthusiast: skill<0.6 AND will>=0.6
- Cynic: skill>=0.6 AND will<0.6
- Dead Wood: skill<0.6 AND will<0.6

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
      "reasons": ["reason1"],
      "development_areas": ["area1"]
    }
  ]
}`

  const userPrompt = `Analyze this Yi member's assessment:

Member: ${request.member_data.name}
${request.member_data.join_date ? `Joined: ${request.member_data.join_date}` : ''}

Assessment Responses:
Q1 - Energy Focus: ${request.answers.q1_energy_focus}
Q2 - Age Group Preference: ${request.answers.q2_age_group}
Q3 - Skill Level: ${request.answers.q3_skill_level}
Q4 - Time Commitment: ${request.answers.q4_time_commitment}
Q5 - Travel Willingness: ${request.answers.q5_travel_willingness}

Available Verticals:
${request.verticals.map(v => `- ${v.name} (${v.id}): ${v.description}`).join('\n')}

Provide analysis and recommendations.`

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

    const result = JSON.parse(textBlock.text)

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Claude API error:', error)

    // Fallback to algorithmic scoring
    const fallbackResult = algorithmicScoring(request)

    return new Response(JSON.stringify({
      success: true,
      result: fallbackResult,
      fallback: true,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

/**
 * Get AI suggestion for next question
 */
async function handleSuggest(request: SuggestionRequest): Promise<Response> {
  const questionTexts: Record<number, string> = {
    1: 'Energy focus area',
    2: 'Age group preference',
    3: 'Skill/experience level',
    4: 'Time commitment',
    5: 'Travel willingness',
  }

  const systemPrompt = `You are helping a Yi member complete their Skill-Will assessment. Based on previous answers, suggest the most appropriate answer for the current question.

Respond ONLY with valid JSON:
{
  "suggestion": "suggested_value",
  "reason": "brief explanation",
  "confidence": <0-1>
}`

  const userPrompt = `Based on these previous answers, suggest for Question ${request.question_number} (${questionTexts[request.question_number]}):

Previous Answers:
${Object.entries(request.previous_answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

What would be the most suitable answer?`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response')
    }

    const result = JSON.parse(textBlock.text)

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Suggestion error:', error)

    return new Response(JSON.stringify({
      success: true,
      suggestion: getDefaultSuggestion(request.question_number),
      reason: 'Default suggestion',
      confidence: 0.5,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

/**
 * Generate development roadmap
 */
async function handleRoadmap(request: RoadmapRequest): Promise<Response> {
  const systemPrompt = `Create a 3-month development roadmap for a Yi volunteer.

Respond ONLY with valid JSON array:
[
  {
    "month": 1,
    "title": "Month Title",
    "tasks": [
      {"id": "1-1", "description": "Task", "completed": false}
    ]
  }
]`

  const userPrompt = `Create roadmap for:
- Category: ${request.category}
- Vertical: ${request.vertical_name}
- Skill: ${(request.skill_score * 100).toFixed(0)}%
- Will: ${(request.will_score * 100).toFixed(0)}%

Create realistic 3-month plan with 3-4 tasks per month.`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response')
    }

    const result = JSON.parse(textBlock.text)

    return new Response(JSON.stringify({ success: true, roadmap: result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Roadmap error:', error)

    return new Response(JSON.stringify({
      success: true,
      roadmap: getDefaultRoadmap(request.category, request.vertical_name),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

// ============================================================================
// Fallback Functions
// ============================================================================

function algorithmicScoring(request: AnalyzeRequest) {
  const skillScores: Record<string, number> = {
    none: 0.1, beginner: 0.3, intermediate: 0.6, expert: 0.9,
  }
  const timeScores: Record<string, number> = {
    under_2_hours: 0.2, hours_5_10: 0.5, hours_10_15: 0.75, hours_15_plus: 0.95,
  }
  const travelScores: Record<string, number> = {
    city_only: 0.3, district: 0.5, neighboring: 0.75, all_state: 1.0,
  }

  const skillScore = skillScores[request.answers.q3_skill_level] || 0.5
  const willScore = (
    (timeScores[request.answers.q4_time_commitment] || 0.5) * 0.5 +
    (travelScores[request.answers.q5_travel_willingness] || 0.5) * 0.5
  )

  const category =
    skillScore >= 0.6 && willScore >= 0.6 ? 'star' :
    skillScore < 0.6 && willScore >= 0.6 ? 'enthusiast' :
    skillScore >= 0.6 && willScore < 0.6 ? 'cynic' : 'dead_wood'

  return {
    skill_analysis: {
      experience_score: skillScore,
      expertise_score: skillScore,
      contribution_potential: (skillScore + willScore) / 2,
      factors: [`Skill level: ${request.answers.q3_skill_level}`],
    },
    will_analysis: {
      commitment_score: timeScores[request.answers.q4_time_commitment] || 0.5,
      enthusiasm_score: willScore,
      flexibility_score: travelScores[request.answers.q5_travel_willingness] || 0.5,
      factors: [`Time: ${request.answers.q4_time_commitment}`],
    },
    combined_analysis: {
      final_skill_score: Math.round(skillScore * 100) / 100,
      final_will_score: Math.round(willScore * 100) / 100,
      category,
      confidence: 0.75,
      reasoning: 'Algorithmic fallback scoring',
    },
    vertical_recommendations: request.verticals.map((v, i) => ({
      vertical_id: v.id,
      vertical_name: v.name,
      match_percentage: Math.max(30, 90 - i * 15),
      reasons: ['Based on profile'],
      development_areas: [],
    })).slice(0, 3),
  }
}

function getDefaultSuggestion(questionNumber: number): string {
  const defaults: Record<number, string> = {
    1: 'teaching_mentoring',
    2: 'teenagers_15_22',
    3: 'intermediate',
    4: 'hours_5_10',
    5: 'district',
  }
  return defaults[questionNumber] || ''
}

function getDefaultRoadmap(category: string, verticalName: string) {
  return [
    {
      month: 1,
      title: 'Orientation',
      tasks: [
        { id: '1-1', description: `Complete ${verticalName} orientation`, completed: false },
        { id: '1-2', description: 'Shadow 2 sessions', completed: false },
      ],
    },
    {
      month: 2,
      title: 'Participation',
      tasks: [
        { id: '2-1', description: 'Co-facilitate 2 sessions', completed: false },
        { id: '2-2', description: 'Attend team meeting', completed: false },
      ],
    },
    {
      month: 3,
      title: 'Contribution',
      tasks: [
        { id: '3-1', description: 'Lead independent session', completed: false },
        { id: '3-2', description: 'Submit activity report', completed: false },
      ],
    },
  ]
}
