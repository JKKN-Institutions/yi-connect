// ============================================================================
// Module 6: Take Pride Award Automation - Type Definitions
// ============================================================================

import { Database } from './database'

// Database table types
type AwardCategoryRow = Database['public']['Tables']['award_categories']['Row']
type AwardCycleRow = Database['public']['Tables']['award_cycles']['Row']
type NominationRow = Database['public']['Tables']['nominations']['Row']
type JuryMemberRow = Database['public']['Tables']['jury_members']['Row']
type JuryScoreRow = Database['public']['Tables']['jury_scores']['Row']
type AwardWinnerRow = Database['public']['Tables']['award_winners']['Row']

// Enums
export type AwardFrequency = Database['public']['Enums']['award_frequency']
export type AwardCycleStatus = Database['public']['Enums']['award_cycle_status']
export type NominationStatus = Database['public']['Enums']['nomination_status']

// ============================================================================
// Award Category
// ============================================================================

export interface AwardCategory extends AwardCategoryRow {
  _count?: {
    cycles?: number
    nominations?: number
  }
}

export interface ScoringCriteria {
  name: string
  weight: number
  description?: string
}

export interface ScoringWeights {
  impact: number
  innovation: number
  participation: number
  consistency: number
  leadership: number
}

// ============================================================================
// Award Cycle
// ============================================================================

export interface AwardCycle extends AwardCycleRow {
  category?: AwardCategory
  _count?: {
    nominations?: number
    jury_members?: number
    winners?: number
  }
}

export interface AwardCycleWithDetails extends AwardCycle {
  nominations?: NominationWithDetails[]
  jury_members?: JuryMemberWithDetails[]
  winners?: AwardWinnerWithDetails[]
}

// ============================================================================
// Nomination
// ============================================================================

export type Nomination = NominationRow

export interface NominationWithDetails extends Nomination {
  cycle?: AwardCycle
  nominee?: {
    id: string
    full_name: string
    avatar_url?: string
    company?: string
    designation?: string
  }
  nominator?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  jury_scores?: JuryScore[]
  winner?: AwardWinner
  // Calculated score fields (added when fetching with scores)
  average_score?: number | null
  weighted_average_score?: number | null
  submitted_at?: string | null
}

export interface SupportingDocument {
  name: string
  url: string
  type: string
  size: number
}

// ============================================================================
// Jury Members & Scores
// ============================================================================

export type JuryMember = JuryMemberRow

export interface JuryMemberWithDetails extends JuryMember {
  member?: {
    id: string
    full_name: string
    avatar_url?: string
    company?: string
    designation?: string
  }
  cycle?: AwardCycle
}

export type JuryScore = JuryScoreRow

export interface JuryScoreWithDetails extends JuryScore {
  nomination?: NominationWithDetails
  jury_member?: JuryMemberWithDetails
}

// ============================================================================
// Award Winners
// ============================================================================

export type AwardWinner = AwardWinnerRow

export interface AwardWinnerWithDetails extends AwardWinner {
  cycle?: AwardCycle
  nomination?: NominationWithDetails
  announced_by_member?: {
    id: string
    full_name: string
  }
}

// ============================================================================
// API Response Types
// ============================================================================

export interface NominationScoreCalculation {
  avg_impact: number
  avg_innovation: number
  avg_participation: number
  avg_consistency: number
  avg_leadership: number
  avg_total: number
  avg_weighted: number
  score_count: number
  score_variance: number
}

export interface RankedNomination {
  nomination_id: string
  nominee_id: string
  nominee_name: string
  average_weighted_score: number
  rank_position: number
  total_jury_scores: number
}

export interface EligibilityCheck {
  is_eligible: boolean
  reason: string
}

export interface LeaderboardEntry {
  member_id: string
  member_name: string
  total_wins: number
  first_place_count: number
  second_place_count: number
  third_place_count: number
  latest_win_date: string
  cycles_won: string[]
}

export interface ScoreAnomaly {
  has_anomaly: boolean
  variance: number
  min_score: number
  max_score: number
  score_range: number
  jury_count: number
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface CreateAwardCategoryData {
  chapter_id: string
  name: string
  description?: string
  criteria?: ScoringCriteria[]
  scoring_weights?: ScoringWeights
  frequency: AwardFrequency
  icon?: string
  color?: string
  sort_order?: number
  is_active?: boolean
}

export interface UpdateAwardCategoryData extends Partial<CreateAwardCategoryData> {
  id: string
}

export interface CreateAwardCycleData {
  category_id: string
  cycle_name: string
  year: number
  period_identifier: string
  start_date: string
  end_date: string
  nomination_deadline: string
  jury_deadline: string
  status?: AwardCycleStatus
  description?: string
  max_nominations_per_member?: number
}

export interface UpdateAwardCycleData extends Partial<CreateAwardCycleData> {
  id: string
}

export interface CreateNominationData {
  cycle_id: string
  nominee_id: string
  nominator_id: string
  justification: string
  supporting_documents?: SupportingDocument[]
  status?: NominationStatus
}

export interface UpdateNominationData extends Partial<CreateNominationData> {
  id: string
}

export interface CreateJuryScoreData {
  nomination_id: string
  jury_member_id: string
  impact_score: number
  innovation_score: number
  participation_score: number
  consistency_score: number
  leadership_score: number
  comments?: string
}

export interface UpdateJuryScoreData extends Partial<CreateJuryScoreData> {
  id: string
}

export interface CreateAwardWinnerData {
  cycle_id: string
  nomination_id: string
  rank: number
  final_score: number
  announced_by?: string
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface AwardCategoryFilters {
  chapter_id?: string
  is_active?: boolean
  frequency?: AwardFrequency
  search?: string
}

export interface AwardCycleFilters {
  category_id?: string
  status?: AwardCycleStatus
  year?: number
  search?: string
}

export interface NominationFilters {
  cycle_id?: string
  nominee_id?: string
  nominator_id?: string
  status?: NominationStatus
  search?: string
}

export interface JuryMemberFilters {
  cycle_id?: string
  member_id?: string
  completed?: boolean
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

export interface AwardStatistics {
  total_categories: number
  total_cycles: number
  total_nominations: number
  total_winners: number
  active_cycles: number
  pending_nominations: number
  pending_jury_scores: number
}

export interface CycleStatistics {
  total_nominations: number
  total_jury_members: number
  total_jury_scores: number
  jury_completion_rate: number
  average_score: number
  highest_score: number
  lowest_score: number
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  AwardCategoryRow,
  AwardCycleRow,
  NominationRow,
  JuryMemberRow,
  JuryScoreRow,
  AwardWinnerRow,
}
