/**
 * AI-Adaptive Assessment Types
 *
 * TypeScript types for the 5-question adaptive Skill-Will assessment
 * powered by Claude API.
 */

// ============================================================================
// ASSESSMENT ENUMS
// ============================================================================

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'expired'

export type EnergyFocus =
  | 'teaching_mentoring'
  | 'organizing_events'
  | 'corporate_partnerships'
  | 'fieldwork'
  | 'creative_work'

export type AgeGroupPreference =
  | 'children_5_12'
  | 'teenagers_15_22'
  | 'adults_25_plus'
  | 'all_ages'

export type SkillLevel = 'none' | 'beginner' | 'intermediate' | 'expert'

export type TimeCommitment =
  | 'under_2_hours'
  | 'hours_5_10'
  | 'hours_10_15'
  | 'hours_15_plus'

export type TravelWillingness = 'city_only' | 'district' | 'neighboring' | 'all_state'

export type SkillWillCategory = 'star' | 'enthusiast' | 'cynic' | 'dead_wood'

// ============================================================================
// ASSESSMENT QUESTIONS
// ============================================================================

export interface AssessmentQuestion {
  id: number
  question: string
  type: 'single_choice' | 'multiple_choice'
  options: AssessmentOption[]
  aiSuggestion?: string
  aiReason?: string
  adaptiveOptions?: AssessmentOption[]
}

export interface AssessmentOption {
  value: string
  label: string
  description?: string
  icon?: string
}

// ============================================================================
// AI HELPER SUGGESTION
// ============================================================================

export interface AISuggestion {
  suggestion: string
  reason: string
  confidence: number
  alternativeOptions?: string[]
}

export interface AIHelperSuggestions {
  q1?: AISuggestion
  q2?: AISuggestion
  q3?: AISuggestion
  q4?: AISuggestion
  q5?: AISuggestion
}

// ============================================================================
// ASSESSMENT DATA
// ============================================================================

export interface SkillWillAssessment {
  id: string
  member_id: string
  chapter_id: string

  // Status
  status: AssessmentStatus
  version: number
  started_at?: string
  completed_at?: string
  expires_at: string

  // Question 1: Energy Focus
  q1_energy_focus?: EnergyFocus
  q1_ai_suggestion?: string
  q1_ai_reason?: string

  // Question 2: Age Group
  q2_age_group?: AgeGroupPreference
  q2_ai_suggestion?: string
  q2_ai_reason?: string
  q2_adaptive_options?: AssessmentOption[]

  // Question 3: Skill Level
  q3_skill_level?: SkillLevel
  q3_adaptive_options?: AssessmentOption[]

  // Question 4: Time Commitment
  q4_time_commitment?: TimeCommitment
  q4_adaptive_options?: AssessmentOption[]

  // Question 5: Travel Willingness
  q5_travel_willingness?: TravelWillingness
  q5_adaptive_options?: AssessmentOption[]

  // AI Analysis
  ai_helper_suggestions?: AIHelperSuggestions
  ai_scoring_result?: AIScoringResult
  ai_classification_confidence?: number
  profile_bonus_score?: number

  // Scores
  skill_score?: number
  will_score?: number
  category?: SkillWillCategory

  // Vertical Recommendation
  recommended_vertical_id?: string
  recommended_match_pct?: number
  alternative_verticals?: AlternativeVertical[]

  // Assignment
  assigned_vertical_id?: string
  assigned_by?: string
  assigned_at?: string
  assignment_notes?: string

  // Mentor
  mentor_id?: string
  mentor_assigned_at?: string
  mentor_notes?: string

  // Roadmap
  roadmap?: RoadmapItem[]

  // Member Response
  recommendation_accepted?: boolean
  change_requested?: boolean
  change_request_reason?: string
  change_reviewed_by?: string
  change_reviewed_at?: string
  change_decision?: 'approved' | 'denied'

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// AI SCORING
// ============================================================================

export interface AIScoringResult {
  skill_analysis: {
    experience_score: number
    expertise_score: number
    contribution_potential: number
    factors: string[]
  }
  will_analysis: {
    commitment_score: number
    enthusiasm_score: number
    flexibility_score: number
    factors: string[]
  }
  combined_analysis: {
    final_skill_score: number
    final_will_score: number
    category: SkillWillCategory
    confidence: number
    reasoning: string
  }
  vertical_recommendations: VerticalRecommendation[]
}

export interface VerticalRecommendation {
  vertical_id: string
  vertical_name: string
  match_percentage: number
  reasons: string[]
  development_areas?: string[]
}

export interface AlternativeVertical {
  vertical_name: string
  match_pct: number
  reason: string
}

// ============================================================================
// DEVELOPMENT ROADMAP
// ============================================================================

export interface RoadmapItem {
  month: number
  title: string
  tasks: RoadmapTask[]
  completed: boolean
}

export interface RoadmapTask {
  id: string
  description: string
  completed: boolean
  completed_at?: string
}

// ============================================================================
// ASSESSMENT FORM INPUT
// ============================================================================

export interface AssessmentFormInput {
  q1_energy_focus: EnergyFocus
  q2_age_group: AgeGroupPreference
  q3_skill_level: SkillLevel
  q4_time_commitment: TimeCommitment
  q5_travel_willingness: TravelWillingness
}

export interface StartAssessmentInput {
  member_id: string
  chapter_id: string
}

export interface SubmitAnswerInput {
  assessment_id: string
  question_number: 1 | 2 | 3 | 4 | 5
  answer: string
}

export interface CompleteAssessmentInput {
  assessment_id: string
}

export interface AssignVerticalInput {
  assessment_id: string
  vertical_id: string
  notes?: string
}

export interface AssignMentorInput {
  assessment_id: string
  mentor_id: string
  notes?: string
}

// ============================================================================
// AI REQUEST/RESPONSE TYPES
// ============================================================================

export interface AIAnalysisRequest {
  assessment_id: string
  member_data: {
    name: string
    join_date?: string
    previous_experience?: string[]
    skills?: string[]
  }
  answers: {
    q1_energy_focus: EnergyFocus
    q2_age_group: AgeGroupPreference
    q3_skill_level: SkillLevel
    q4_time_commitment: TimeCommitment
    q5_travel_willingness: TravelWillingness
  }
  verticals: Array<{
    id: string
    name: string
    description: string
    focus_areas: string[]
  }>
}

export interface AIAnalysisResponse {
  success: boolean
  result?: AIScoringResult
  error?: string
}

export interface AISuggestionRequest {
  question_number: 1 | 2 | 3 | 4 | 5
  previous_answers: Partial<AssessmentFormInput>
  member_context?: {
    profession?: string
    interests?: string[]
    availability?: string
  }
}

export interface AISuggestionResponse {
  success: boolean
  suggestion?: AISuggestion
  adaptive_options?: AssessmentOption[]
  error?: string
}

// ============================================================================
// CATEGORY DESCRIPTIONS
// ============================================================================

export const CATEGORY_DESCRIPTIONS: Record<SkillWillCategory, {
  name: string
  description: string
  characteristics: string[]
  development_focus: string
  mentoring_approach: string
}> = {
  star: {
    name: 'Star',
    description: 'High skill, high will - ideal for leadership roles',
    characteristics: [
      'Expert-level skills',
      'Strong commitment',
      'Self-motivated',
      'Can mentor others',
    ],
    development_focus: 'Leadership development and strategic initiatives',
    mentoring_approach: 'Peer mentoring, leadership opportunities',
  },
  enthusiast: {
    name: 'Enthusiast',
    description: 'Low skill, high will - eager to learn and contribute',
    characteristics: [
      'Highly motivated',
      'Willing to learn',
      'Flexible schedule',
      'Open to various roles',
    ],
    development_focus: 'Skill building and structured training',
    mentoring_approach: 'Active mentorship with regular check-ins',
  },
  cynic: {
    name: 'Cynic',
    description: 'High skill, low will - needs motivation and engagement',
    characteristics: [
      'Strong expertise',
      'Limited availability',
      'May be disengaged',
      'Valuable when engaged',
    ],
    development_focus: 'Re-engagement and finding meaningful roles',
    mentoring_approach: 'Find roles matching their expertise and interests',
  },
  dead_wood: {
    name: 'Observer',
    description: 'Low skill, low will - needs assessment of fit',
    characteristics: [
      'New to volunteering',
      'Uncertain about commitment',
      'May need different role',
      'Support system needed',
    ],
    development_focus: 'Understanding motivations and finding suitable entry point',
    mentoring_approach: 'Exploratory conversations, low-commitment tasks',
  },
}

// ============================================================================
// QUESTION DEFINITIONS
// ============================================================================

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    question: 'Where do you feel most energized to focus your efforts?',
    type: 'single_choice',
    options: [
      {
        value: 'teaching_mentoring',
        label: 'Teaching & Mentoring',
        description: 'Conducting sessions, training youth, sharing knowledge',
        icon: 'GraduationCap',
      },
      {
        value: 'organizing_events',
        label: 'Organizing Events',
        description: 'Planning activities, managing logistics, coordinating teams',
        icon: 'Calendar',
      },
      {
        value: 'corporate_partnerships',
        label: 'Corporate Partnerships',
        description: 'Building relationships with industries, MoUs, opportunities',
        icon: 'Building',
      },
      {
        value: 'fieldwork',
        label: 'Fieldwork',
        description: 'School/college visits, community engagement, ground activities',
        icon: 'Users',
      },
      {
        value: 'creative_work',
        label: 'Creative Work',
        description: 'Content creation, design, social media, communications',
        icon: 'Palette',
      },
    ],
  },
  {
    id: 2,
    question: 'Which age group do you prefer working with?',
    type: 'single_choice',
    options: [
      {
        value: 'children_5_12',
        label: 'Children (5-12 years)',
        description: 'Primary school students, fun-based learning',
        icon: 'Baby',
      },
      {
        value: 'teenagers_15_22',
        label: 'Teenagers (15-22 years)',
        description: 'High school & college students, career guidance',
        icon: 'GraduationCap',
      },
      {
        value: 'adults_25_plus',
        label: 'Adults (25+ years)',
        description: 'Young professionals, industry stakeholders',
        icon: 'Briefcase',
      },
      {
        value: 'all_ages',
        label: 'All Age Groups',
        description: 'Comfortable working with any age group',
        icon: 'Users',
      },
    ],
  },
  {
    id: 3,
    question: 'How would you rate your experience in your chosen area?',
    type: 'single_choice',
    options: [
      {
        value: 'none',
        label: 'No Experience',
        description: 'New to this area, eager to start',
      },
      {
        value: 'beginner',
        label: 'Beginner',
        description: '0-1 year of experience, learning the basics',
      },
      {
        value: 'intermediate',
        label: 'Intermediate',
        description: '1-3 years of experience, comfortable with tasks',
      },
      {
        value: 'expert',
        label: 'Expert',
        description: '3+ years of experience, can mentor others',
      },
    ],
  },
  {
    id: 4,
    question: 'How much time can you commit per week?',
    type: 'single_choice',
    options: [
      {
        value: 'under_2_hours',
        label: 'Under 2 hours',
        description: 'Limited availability, occasional tasks',
      },
      {
        value: 'hours_5_10',
        label: '5-10 hours',
        description: 'Regular involvement, weekend activities',
      },
      {
        value: 'hours_10_15',
        label: '10-15 hours',
        description: 'Significant commitment, multiple activities',
      },
      {
        value: 'hours_15_plus',
        label: '15+ hours',
        description: 'High commitment, leadership roles',
      },
    ],
  },
  {
    id: 5,
    question: 'How far are you willing to travel for activities?',
    type: 'single_choice',
    options: [
      {
        value: 'city_only',
        label: 'Within City Only',
        description: 'Activities within your city limits',
      },
      {
        value: 'district',
        label: 'Within District',
        description: 'Willing to travel within the district',
      },
      {
        value: 'neighboring',
        label: 'Neighboring Districts',
        description: 'Can travel to nearby districts',
      },
      {
        value: 'all_state',
        label: 'Anywhere in State',
        description: 'Willing to travel across the state',
      },
    ],
  },
]
