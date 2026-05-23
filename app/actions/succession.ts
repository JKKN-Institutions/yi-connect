'use server'

// ============================================================================
// MODULE 5: SUCCESSION & LEADERSHIP PIPELINE - SERVER ACTIONS (STUBBED)
// ============================================================================
// STATUS: All succession_* tables are missing from production database.
// The original implementation referenced 14 succession_* tables that were
// never migrated. To prevent runtime 500 errors when forms are submitted,
// every action returns a graceful error so the user sees a clear message
// rather than a server crash. Function signatures are preserved so 46
// consumer files do not break.
//
// When the succession schema is provisioned in production:
//   1. Restore from git history: pre-stub version is at git HEAD before
//      commit "fix(succession): stub data layer to prevent runtime crashes"
//   2. Apply succession_* migrations in supabase/migrations/
//   3. Run `npx tsc --noEmit` to verify all consumers still compile
//
// Audit trail: 0 succession_* tables in any DB schema (verified via
// information_schema.tables on project bkmpbcoxbjyafieabxao, 2026-05-23).
// ============================================================================

import { z } from 'zod'

type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

const STUB_ERROR: ActionResult = {
  success: false,
  error:
    'Succession module is not yet available. Database schema has not been provisioned. Please contact the administrator.',
}

// Helper to keep all stubbed actions identical shape
const stub = async <T = unknown>(): Promise<ActionResult<T>> =>
  STUB_ERROR as ActionResult<T>

// ============================================================================
// CYCLE ACTIONS
// ============================================================================

export async function createSuccessionCycle(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateSuccessionCycle(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function advanceSuccessionStatus(
  _input: z.infer<any> | unknown
): Promise<ActionResult> {
  return stub()
}

export async function deleteSuccessionCycle(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// POSITION ACTIONS
// ============================================================================

export async function createSuccessionPosition(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateSuccessionPosition(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function togglePositionStatus(
  _id: string,
  _isActive: boolean
): Promise<ActionResult> {
  return stub()
}

export async function deleteSuccessionPosition(
  _id: string
): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// ELIGIBILITY ACTIONS
// ============================================================================

export async function calculateCycleEligibility(
  _cycleId: string
): Promise<ActionResult<{ count: number }>> {
  return stub<{ count: number }>()
}

// ============================================================================
// NOMINATION ACTIONS
// ============================================================================

export async function submitNomination(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateNomination(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function withdrawNomination(
  _id: string,
  _reason?: string
): Promise<ActionResult> {
  return stub()
}

export async function reviewNomination(
  _id: string,
  _decision: 'approved' | 'rejected',
  _reviewNotes?: string
): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// APPLICATION ACTIONS
// ============================================================================

export async function submitApplication(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateApplication(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function withdrawApplication(
  _id: string,
  _reason?: string
): Promise<ActionResult> {
  return stub()
}

export async function reviewApplication(
  _id: string,
  _decision: 'approved' | 'rejected' | 'shortlisted',
  _reviewNotes?: string
): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// EVALUATION CRITERIA ACTIONS
// ============================================================================

export async function createEvaluationCriteria(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateEvaluationCriteria(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function deleteEvaluationCriteria(
  _id: string
): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// EVALUATOR ACTIONS
// ============================================================================

export async function assignEvaluator(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function removeEvaluator(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// EVALUATION SCORES ACTIONS
// ============================================================================

export async function submitEvaluationScores(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// TIMELINE STEPS ACTIONS
// ============================================================================

export async function createTimelineStep(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateTimelineStep(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateTimelineStepStatus(
  _id: string,
  _status: string
): Promise<ActionResult> {
  return stub()
}

export async function deleteTimelineStep(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// CANDIDATE APPROACH ACTIONS
// ============================================================================

export async function createApproach(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateApproach(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateApproachResponse(
  _id: string,
  _responseStatus: string,
  _conditionsText?: string,
  _notes?: string
): Promise<ActionResult> {
  return stub()
}

export async function deleteApproach(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// MEETING ACTIONS
// ============================================================================

export async function createMeeting(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateMeeting(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateMeetingStatus(
  _id: string,
  _status: string
): Promise<ActionResult> {
  return stub()
}

export async function deleteMeeting(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// VOTE ACTIONS
// ============================================================================

export async function submitVote(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function updateVote(
  _id: string,
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}

export async function deleteVote(_id: string): Promise<ActionResult> {
  return stub()
}

// ============================================================================
// SEED / AUTO-CREATE HELPERS
// ============================================================================

export async function seedTimelineSteps(
  _cycleId: string,
  _cycleStartDate?: Date
): Promise<ActionResult<{ count: number }>> {
  return stub<{ count: number }>()
}

export async function autoCreateSuccessionCycle(
  _formData: FormData | unknown
): Promise<ActionResult> {
  return stub()
}
