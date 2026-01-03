/**
 * Module 9: Vertical Performance Tracker
 * Zod Validation Schemas
 *
 * This file contains all Zod validation schemas for the vertical performance tracking module.
 * These schemas are used for form validation and data integrity in Server Actions.
 */

import { z } from 'zod'
import {
  VERTICAL_STATUSES,
  PLAN_STATUSES,
  METRIC_TYPES,
  ACTIVITY_TYPES,
  ACHIEVEMENT_CATEGORIES,
  REVIEW_STATUSES,
  QUARTERS,
} from '@/types/vertical'

// ============================================================================
// BASE FIELD VALIDATORS
// ============================================================================

/**
 * UUID validator
 */
const uuidSchema = z.string().uuid('Invalid UUID format')

/**
 * Calendar year validator (2020-2099)
 */
const calendarYearSchema = z
  .number()
  .int('Calendar year must be an integer')
  .min(2020, 'Calendar year must be 2020 or later')
  .max(2099, 'Calendar year must be 2099 or earlier')

/**
 * Quarter validator (1-4)
 */
const quarterSchema = z
  .number()
  .int('Quarter must be an integer')
  .min(1, 'Quarter must be between 1 and 4')
  .max(4, 'Quarter must be between 1 and 4')

/**
 * Date string validator (YYYY-MM-DD format)
 */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

/**
 * Rating validator (0-5)
 */
const ratingSchema = z
  .number()
  .min(0, 'Rating must be between 0 and 5')
  .max(5, 'Rating must be between 0 and 5')

/**
 * Percentage validator (0-100)
 */
const percentageSchema = z
  .number()
  .min(0, 'Percentage must be between 0 and 100')
  .max(100, 'Percentage must be between 0 and 100')

/**
 * Currency amount validator (non-negative)
 */
const currencySchema = z
  .number()
  .nonnegative('Amount must be non-negative')

/**
 * Slug validator (lowercase alphanumeric with hyphens)
 */
const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')

/**
 * Color validator (hex color code)
 */
const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g., #3b82f6)')
  .optional()
  .nullable()

/**
 * Icon name validator (Lucide icon names)
 */
const iconSchema = z
  .string()
  .min(1, 'Icon name must be at least 1 character')
  .max(50, 'Icon name must be at most 50 characters')
  .optional()
  .nullable()

// ============================================================================
// VERTICAL SCHEMAS
// ============================================================================

/**
 * Create vertical schema
 */
export const createVerticalSchema = z.object({
  chapter_id: uuidSchema,
  name: z
    .string()
    .min(2, 'Vertical name must be at least 2 characters')
    .max(100, 'Vertical name must be at most 100 characters')
    .trim(),
  slug: slugSchema,
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .optional()
    .nullable(),
  color: colorSchema,
  icon: iconSchema,
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
})

/**
 * Update vertical schema (all fields optional)
 */
export const updateVerticalSchema = z.object({
  name: z
    .string()
    .min(2, 'Vertical name must be at least 2 characters')
    .max(100, 'Vertical name must be at most 100 characters')
    .trim()
    .optional(),
  slug: slugSchema.optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .optional()
    .nullable(),
  color: colorSchema,
  icon: iconSchema,
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
})

/**
 * Delete vertical schema (requires ID)
 */
export const deleteVerticalSchema = z.object({
  id: uuidSchema,
})

// ============================================================================
// VERTICAL CHAIR SCHEMAS
// ============================================================================

/**
 * Assign vertical chair schema
 */
export const assignVerticalChairSchema = z
  .object({
    vertical_id: uuidSchema,
    member_id: uuidSchema,
    role: z.enum(['chair', 'co_chair']).default('chair'),
    start_date: dateStringSchema,
    end_date: dateStringSchema.optional().nullable(),
    notes: z.string().max(1000).trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

/**
 * Update vertical chair schema
 */
export const updateVerticalChairSchema = z
  .object({
    role: z.enum(['chair', 'co_chair']).optional(),
    start_date: dateStringSchema.optional(),
    end_date: dateStringSchema.optional().nullable(),
    notes: z.string().max(1000).trim().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.end_date && data.start_date) {
        return new Date(data.end_date) > new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

// ============================================================================
// VERTICAL PLAN SCHEMAS
// ============================================================================

/**
 * KPI item schema for plan creation
 */
const kpiItemSchema = z.object({
  kpi_name: z
    .string()
    .min(3, 'KPI name must be at least 3 characters')
    .max(255, 'KPI name must be at most 255 characters')
    .trim(),
  metric_type: z.enum([
    METRIC_TYPES.COUNT,
    METRIC_TYPES.PERCENTAGE,
    METRIC_TYPES.AMOUNT,
    METRIC_TYPES.HOURS,
    METRIC_TYPES.SCORE,
  ]),
  target_q1: z.number().nonnegative('Q1 target must be non-negative').default(0),
  target_q2: z.number().nonnegative('Q2 target must be non-negative').default(0),
  target_q3: z.number().nonnegative('Q3 target must be non-negative').default(0),
  target_q4: z.number().nonnegative('Q4 target must be non-negative').default(0),
  weight: z
    .number()
    .min(0, 'Weight must be between 0 and 100')
    .max(100, 'Weight must be between 0 and 100')
    .default(10),
  display_order: z.number().int().min(0).default(0),
})

/**
 * Create vertical plan schema
 * Database columns: plan_name, vision, mission, q1_budget, q2_budget, q3_budget, q4_budget
 * Note: total_budget is a generated column (computed from quarterly budgets) - do not insert
 */
export const createVerticalPlanSchema = z
  .object({
    vertical_id: uuidSchema,
    calendar_year: calendarYearSchema,
    plan_name: z
      .string()
      .min(3, 'Plan name must be at least 3 characters')
      .max(200, 'Plan name must be at most 200 characters')
      .trim(),
    mission: z.string().max(2000).trim().optional().nullable(),
    vision: z.string().max(1000).trim().optional().nullable(),
    q1_budget: currencySchema.default(0),
    q2_budget: currencySchema.default(0),
    q3_budget: currencySchema.default(0),
    q4_budget: currencySchema.default(0),
    status: z
      .enum([
        PLAN_STATUSES.DRAFT,
        PLAN_STATUSES.SUBMITTED,
        PLAN_STATUSES.APPROVED,
        PLAN_STATUSES.ACTIVE,
        PLAN_STATUSES.COMPLETED,
      ])
      .default(PLAN_STATUSES.DRAFT),
    kpis: z.array(kpiItemSchema).optional(),
  })
  .refine(
    (data) => {
      // If KPIs are provided, ensure total weight equals 100
      if (data.kpis && data.kpis.length > 0) {
        const totalWeight = data.kpis.reduce((sum, kpi) => sum + kpi.weight, 0)
        return Math.abs(totalWeight - 100) < 0.01 // Allow small floating point differences
      }
      return true
    },
    {
      message: 'Total KPI weights must equal 100%',
      path: ['kpis'],
    }
  )

/**
 * Update vertical plan schema
 * Database columns: plan_name, vision, mission, q1_budget, q2_budget, q3_budget, q4_budget
 * Note: total_budget is a generated column (computed from quarterly budgets) - do not update
 */
export const updateVerticalPlanSchema = z.object({
  plan_name: z
    .string()
    .min(3, 'Plan name must be at least 3 characters')
    .max(200, 'Plan name must be at most 200 characters')
    .trim()
    .optional(),
  mission: z.string().max(2000).trim().optional().nullable(),
  vision: z.string().max(1000).trim().optional().nullable(),
  q1_budget: currencySchema.optional(),
  q2_budget: currencySchema.optional(),
  q3_budget: currencySchema.optional(),
  q4_budget: currencySchema.optional(),
  status: z
    .enum([
      PLAN_STATUSES.DRAFT,
      PLAN_STATUSES.SUBMITTED,
      PLAN_STATUSES.APPROVED,
      PLAN_STATUSES.ACTIVE,
      PLAN_STATUSES.COMPLETED,
    ])
    .optional(),
})

/**
 * Approve vertical plan schema
 */
export const approveVerticalPlanSchema = z.object({
  plan_id: uuidSchema,
  approved_by: uuidSchema,
})

// ============================================================================
// KPI SCHEMAS
// ============================================================================

/**
 * Create KPI schema
 */
export const createKPISchema = z.object({
  plan_id: uuidSchema,
  kpi_name: z
    .string()
    .min(3, 'KPI name must be at least 3 characters')
    .max(255, 'KPI name must be at most 255 characters')
    .trim(),
  metric_type: z.enum([
    METRIC_TYPES.COUNT,
    METRIC_TYPES.PERCENTAGE,
    METRIC_TYPES.AMOUNT,
    METRIC_TYPES.HOURS,
    METRIC_TYPES.SCORE,
  ]),
  target_q1: z.number().nonnegative('Q1 target must be non-negative').default(0),
  target_q2: z.number().nonnegative('Q2 target must be non-negative').default(0),
  target_q3: z.number().nonnegative('Q3 target must be non-negative').default(0),
  target_q4: z.number().nonnegative('Q4 target must be non-negative').default(0),
  weight: z
    .number()
    .min(0, 'Weight must be between 0 and 100')
    .max(100, 'Weight must be between 0 and 100')
    .default(10),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

/**
 * Update KPI schema
 */
export const updateKPISchema = z.object({
  kpi_name: z
    .string()
    .min(3, 'KPI name must be at least 3 characters')
    .max(255, 'KPI name must be at most 255 characters')
    .trim()
    .optional(),
  metric_type: z
    .enum([
      METRIC_TYPES.COUNT,
      METRIC_TYPES.PERCENTAGE,
      METRIC_TYPES.AMOUNT,
      METRIC_TYPES.HOURS,
      METRIC_TYPES.SCORE,
    ])
    .optional(),
  target_q1: z.number().nonnegative('Q1 target must be non-negative').optional(),
  target_q2: z.number().nonnegative('Q2 target must be non-negative').optional(),
  target_q3: z.number().nonnegative('Q3 target must be non-negative').optional(),
  target_q4: z.number().nonnegative('Q4 target must be non-negative').optional(),
  weight: z
    .number()
    .min(0, 'Weight must be between 0 and 100')
    .max(100, 'Weight must be between 0 and 100')
    .optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

/**
 * Record KPI actual value schema
 */
/**
 * Record KPI actual schema
 * Database columns: kpi_id, quarter, actual_value, recorded_by, recorded_at, notes, supporting_event_ids
 * Note: recorded_at is a timestamp, not a date string
 */
export const recordKPIActualSchema = z.object({
  kpi_id: uuidSchema,
  quarter: quarterSchema,
  actual_value: z.number({ message: 'Actual value is required' }),
  notes: z.string().max(1000).trim().optional().nullable(),
  recorded_by: uuidSchema,
  supporting_event_ids: z.array(uuidSchema).optional().nullable(),
})

/**
 * Update KPI actual schema
 * Database columns: actual_value, notes, supporting_event_ids
 */
export const updateKPIActualSchema = z.object({
  actual_value: z.number({ message: 'Actual value is required' }).optional(),
  notes: z.string().max(1000).trim().optional().nullable(),
  supporting_event_ids: z.array(uuidSchema).optional().nullable(),
})

// ============================================================================
// VERTICAL MEMBER SCHEMAS
// ============================================================================

/**
 * Add vertical member schema
 */
export const addVerticalMemberSchema = z
  .object({
    vertical_id: uuidSchema,
    member_id: uuidSchema,
    role: z.string().max(100).trim().optional().nullable(),
    joined_date: dateStringSchema.optional(),
    contribution_notes: z.string().max(1000).trim().optional().nullable(),
  })

/**
 * Update vertical member schema
 */
export const updateVerticalMemberSchema = z.object({
  role: z.string().max(100).trim().optional().nullable(),
  left_date: dateStringSchema.optional().nullable(),
  is_active: z.boolean().optional(),
  contribution_notes: z.string().max(1000).trim().optional().nullable(),
})

/**
 * Remove vertical member schema
 */
export const removeVerticalMemberSchema = z.object({
  id: uuidSchema,
  left_date: dateStringSchema.optional(),
})

// ============================================================================
// ACTIVITY SCHEMAS
// ============================================================================

/**
 * Create vertical activity schema
 */
/**
 * Create activity schema
 * Database columns: vertical_id, event_id, activity_date, activity_title, activity_type,
 * description, beneficiaries_count, volunteer_count, volunteer_hours, cost_incurred,
 * photos_count, report_url, impact_summary, quarter, created_by
 */
export const createActivitySchema = z.object({
  vertical_id: uuidSchema,
  event_id: uuidSchema.optional().nullable(),
  activity_date: dateStringSchema,
  activity_title: z
    .string()
    .min(3, 'Activity title must be at least 3 characters')
    .max(255, 'Activity title must be at most 255 characters')
    .trim(),
  activity_type: z.enum([
    ACTIVITY_TYPES.EVENT,
    ACTIVITY_TYPES.MEETING,
    ACTIVITY_TYPES.CAMPAIGN,
    ACTIVITY_TYPES.WORKSHOP,
    ACTIVITY_TYPES.OUTREACH,
    ACTIVITY_TYPES.OTHER,
  ]),
  description: z.string().max(2000).trim().optional().nullable(),
  beneficiaries_count: z.number().int().nonnegative('Beneficiaries count must be non-negative').default(0),
  volunteer_count: z.number().int().nonnegative('Volunteer count must be non-negative').default(0),
  volunteer_hours: z.number().nonnegative('Volunteer hours must be non-negative').default(0),
  cost_incurred: currencySchema.default(0),
  photos_count: z.number().int().nonnegative().default(0),
  report_url: z.string().url('Invalid report URL').optional().nullable(),
  impact_summary: z.string().max(1000).trim().optional().nullable(),
  quarter: quarterSchema.optional(),
  created_by: uuidSchema,
})

/**
 * Update activity schema
 */
/**
 * Update activity schema
 * Database columns match createActivitySchema
 */
export const updateActivitySchema = z.object({
  activity_date: dateStringSchema.optional(),
  activity_title: z
    .string()
    .min(3, 'Activity title must be at least 3 characters')
    .max(255, 'Activity title must be at most 255 characters')
    .trim()
    .optional(),
  activity_type: z
    .enum([
      ACTIVITY_TYPES.EVENT,
      ACTIVITY_TYPES.MEETING,
      ACTIVITY_TYPES.CAMPAIGN,
      ACTIVITY_TYPES.WORKSHOP,
      ACTIVITY_TYPES.OUTREACH,
      ACTIVITY_TYPES.OTHER,
    ])
    .optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  beneficiaries_count: z.number().int().nonnegative('Beneficiaries count must be non-negative').optional(),
  volunteer_count: z.number().int().nonnegative('Volunteer count must be non-negative').optional(),
  volunteer_hours: z.number().nonnegative('Volunteer hours must be non-negative').optional(),
  cost_incurred: currencySchema.optional(),
  photos_count: z.number().int().nonnegative().optional(),
  report_url: z.string().url('Invalid report URL').optional().nullable(),
  impact_summary: z.string().max(1000).trim().optional().nullable(),
  quarter: quarterSchema.optional(),
})

// ============================================================================
// PERFORMANCE REVIEW SCHEMAS
// ============================================================================

/**
 * Create performance review schema
 */
export const createPerformanceReviewSchema = z.object({
  vertical_id: uuidSchema,
  chair_id: uuidSchema,
  calendar_year: calendarYearSchema,
  quarter: quarterSchema,
  overall_rating: ratingSchema,
  kpi_achievement_rate: percentageSchema.optional(),
  budget_utilization_rate: percentageSchema.optional(),
  event_completion_rate: percentageSchema.optional(),
  strengths: z.string().max(2000).trim().optional().nullable(),
  areas_for_improvement: z.string().max(2000).trim().optional().nullable(),
  recommendations: z.string().max(2000).trim().optional().nullable(),
  reviewed_by: uuidSchema,
  status: z
    .enum([REVIEW_STATUSES.PENDING, REVIEW_STATUSES.COMPLETED, REVIEW_STATUSES.PUBLISHED])
    .default(REVIEW_STATUSES.COMPLETED),
})

/**
 * Update performance review schema
 */
export const updatePerformanceReviewSchema = z.object({
  overall_rating: ratingSchema.optional(),
  kpi_achievement_rate: percentageSchema.optional(),
  budget_utilization_rate: percentageSchema.optional(),
  event_completion_rate: percentageSchema.optional(),
  strengths: z.string().max(2000).trim().optional().nullable(),
  areas_for_improvement: z.string().max(2000).trim().optional().nullable(),
  recommendations: z.string().max(2000).trim().optional().nullable(),
  status: z
    .enum([REVIEW_STATUSES.PENDING, REVIEW_STATUSES.COMPLETED, REVIEW_STATUSES.PUBLISHED])
    .optional(),
})

/**
 * Publish performance review schema
 */
export const publishPerformanceReviewSchema = z.object({
  id: uuidSchema,
})

// ============================================================================
// ACHIEVEMENT SCHEMAS
// ============================================================================

/**
 * Create achievement schema
 */
export const createAchievementSchema = z.object({
  vertical_id: uuidSchema,
  achievement_date: dateStringSchema,
  title: z
    .string()
    .min(3, 'Achievement title must be at least 3 characters')
    .max(255, 'Achievement title must be at most 255 characters')
    .trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  category: z.enum([
    ACHIEVEMENT_CATEGORIES.AWARD,
    ACHIEVEMENT_CATEGORIES.MILESTONE,
    ACHIEVEMENT_CATEGORIES.RECOGNITION,
    ACHIEVEMENT_CATEGORIES.IMPACT,
    ACHIEVEMENT_CATEGORIES.INNOVATION,
  ]),
  impact_metrics: z.record(z.string(), z.any()).optional().nullable(),
  recognition_type: z.string().max(100).trim().optional().nullable(),
  photo_urls: z.array(z.string().url('Invalid photo URL')).optional().nullable(),
  created_by: uuidSchema,
})

/**
 * Update achievement schema
 */
export const updateAchievementSchema = z.object({
  achievement_date: dateStringSchema.optional(),
  title: z
    .string()
    .min(3, 'Achievement title must be at least 3 characters')
    .max(255, 'Achievement title must be at most 255 characters')
    .trim()
    .optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  category: z
    .enum([
      ACHIEVEMENT_CATEGORIES.AWARD,
      ACHIEVEMENT_CATEGORIES.MILESTONE,
      ACHIEVEMENT_CATEGORIES.RECOGNITION,
      ACHIEVEMENT_CATEGORIES.IMPACT,
      ACHIEVEMENT_CATEGORIES.INNOVATION,
    ])
    .optional(),
  impact_metrics: z.record(z.string(), z.any()).optional().nullable(),
  recognition_type: z.string().max(100).trim().optional().nullable(),
  photo_urls: z.array(z.string().url('Invalid photo URL')).optional().nullable(),
})

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

/**
 * Vertical filters schema (for query params)
 */
export const verticalFiltersSchema = z.object({
  chapter_id: uuidSchema.optional(),
  is_active: z.boolean().optional(),
  search: z.string().trim().optional(),
  has_current_chair: z.boolean().optional(),
  has_active_plan: z.boolean().optional(),
})

/**
 * KPI filters schema (for query params)
 */
export const kpiFiltersSchema = z.object({
  plan_id: uuidSchema.optional(),
  vertical_id: uuidSchema.optional(),
  calendar_year: calendarYearSchema.optional(),
  metric_type: z
    .enum([
      METRIC_TYPES.COUNT,
      METRIC_TYPES.PERCENTAGE,
      METRIC_TYPES.AMOUNT,
      METRIC_TYPES.HOURS,
      METRIC_TYPES.SCORE,
    ])
    .optional(),
  is_active: z.boolean().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'at_risk']).optional(),
})

/**
 * Activity filters schema (for query params)
 */
export const activityFiltersSchema = z.object({
  vertical_id: uuidSchema.optional(),
  calendar_year: calendarYearSchema.optional(),
  quarter: quarterSchema.optional(),
  activity_type: z
    .enum([
      ACTIVITY_TYPES.EVENT,
      ACTIVITY_TYPES.MEETING,
      ACTIVITY_TYPES.CAMPAIGN,
      ACTIVITY_TYPES.WORKSHOP,
      ACTIVITY_TYPES.OUTREACH,
      ACTIVITY_TYPES.OTHER,
    ])
    .optional(),
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  has_event: z.boolean().optional(),
  created_by: uuidSchema.optional(),
  min_beneficiaries: z.number().int().nonnegative().optional(),
})

/**
 * Review filters schema (for query params)
 */
export const reviewFiltersSchema = z.object({
  vertical_id: uuidSchema.optional(),
  calendar_year: calendarYearSchema.optional(),
  quarter: quarterSchema.optional(),
  status: z.enum([REVIEW_STATUSES.PENDING, REVIEW_STATUSES.COMPLETED, REVIEW_STATUSES.PUBLISHED]).optional(),
  reviewed_by: uuidSchema.optional(),
  min_rating: ratingSchema.optional(),
})

/**
 * Pagination schema (for query params)
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(10),
})

/**
 * Sort schema (for query params)
 */
export const sortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

// ============================================================================
// TYPE EXPORTS (for use in Server Actions)
// ============================================================================

export type CreateVerticalInput = z.infer<typeof createVerticalSchema>
export type UpdateVerticalInput = z.infer<typeof updateVerticalSchema>
export type AssignVerticalChairInput = z.infer<typeof assignVerticalChairSchema>
export type UpdateVerticalChairInput = z.infer<typeof updateVerticalChairSchema>
export type CreateVerticalPlanInput = z.infer<typeof createVerticalPlanSchema>
export type UpdateVerticalPlanInput = z.infer<typeof updateVerticalPlanSchema>
export type CreateKPIInput = z.infer<typeof createKPISchema>
export type UpdateKPIInput = z.infer<typeof updateKPISchema>
export type RecordKPIActualInput = z.infer<typeof recordKPIActualSchema>
export type UpdateKPIActualInput = z.infer<typeof updateKPIActualSchema>
export type AddVerticalMemberInput = z.infer<typeof addVerticalMemberSchema>
export type UpdateVerticalMemberInput = z.infer<typeof updateVerticalMemberSchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>
export type UpdatePerformanceReviewInput = z.infer<typeof updatePerformanceReviewSchema>
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>
export type UpdateAchievementInput = z.infer<typeof updateAchievementSchema>
