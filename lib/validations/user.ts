/**
 * User Management Validation Schemas
 *
 * Zod schemas for validating user management operations
 */

import { z } from 'zod'

// ============================================================================
// User Profile Validation
// ============================================================================

/**
 * Update user profile schema
 */
export const updateUserProfileSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  phone: z
    .string()
    .regex(/^[+\d\s()-]*$/, 'Invalid phone number format')
    .min(10, 'Phone number must be at least 10 digits')
    .max(20, 'Phone number must be less than 20 characters')
    .optional()
    .or(z.literal(''))
    .nullable(),
  chapter_id: z.string().uuid('Invalid chapter ID').optional().nullable(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable()
})

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>

// ============================================================================
// Role Assignment Validation
// ============================================================================

/**
 * Assign role to user schema
 */
export const assignRoleSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role_id: z.string().uuid('Invalid role ID'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type AssignRoleInput = z.infer<typeof assignRoleSchema>

/**
 * Remove role from user schema
 */
export const removeRoleSchema = z.object({
  user_role_id: z.string().uuid('Invalid user role ID'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type RemoveRoleInput = z.infer<typeof removeRoleSchema>

/**
 * Bulk assign role schema
 */
export const bulkAssignRoleSchema = z.object({
  user_ids: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'Select at least one user')
    .max(100, 'Cannot assign roles to more than 100 users at once'),
  role_id: z.string().uuid('Invalid role ID'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type BulkAssignRoleInput = z.infer<typeof bulkAssignRoleSchema>

/**
 * Bulk remove role schema
 */
export const bulkRemoveRoleSchema = z.object({
  user_ids: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'Select at least one user')
    .max(100, 'Cannot remove roles from more than 100 users at once'),
  role_id: z.string().uuid('Invalid role ID'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type BulkRemoveRoleInput = z.infer<typeof bulkRemoveRoleSchema>

// ============================================================================
// User Status Validation
// ============================================================================

/**
 * Change user status (activate/deactivate) schema
 */
export const changeUserStatusSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  is_active: z.boolean(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type ChangeUserStatusInput = z.infer<typeof changeUserStatusSchema>

/**
 * Bulk deactivate users schema
 */
export const bulkDeactivateUsersSchema = z.object({
  user_ids: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'Select at least one user')
    .max(100, 'Cannot deactivate more than 100 users at once'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type BulkDeactivateUsersInput = z.infer<typeof bulkDeactivateUsersSchema>

// ============================================================================
// Bulk Chapter Assignment Validation
// ============================================================================

/**
 * Bulk assign chapter schema
 */
export const bulkAssignChapterSchema = z.object({
  user_ids: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'Select at least one user')
    .max(100, 'Cannot assign chapter to more than 100 users at once'),
  chapter_id: z.string().uuid('Invalid chapter ID').nullable(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type BulkAssignChapterInput = z.infer<typeof bulkAssignChapterSchema>

// ============================================================================
// Query Parameter Validation
// ============================================================================

/**
 * User query parameters schema
 */
export const userQueryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role_id: z.string().uuid().optional(),
  role_name: z.string().optional(),
  chapter_id: z.string().uuid().optional(),
  hierarchy_level: z.coerce.number().int().min(1).max(7).optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  has_member_record: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort_field: z
    .enum([
      'full_name',
      'email',
      'created_at',
      'updated_at',
      'approved_at',
      'role',
      'chapter'
    ])
    .optional(),
  sort_direction: z.enum(['asc', 'desc']).default('desc')
})

export type UserQueryParamsInput = z.infer<typeof userQueryParamsSchema>

// ============================================================================
// Export Configuration Validation
// ============================================================================

/**
 * User export configuration schema
 */
export const userExportConfigSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  fields: z
    .array(
      z.enum([
        'email',
        'full_name',
        'phone',
        'chapter_name',
        'roles',
        'hierarchy_level',
        'is_active',
        'has_member',
        'created_at',
        'last_login'
      ])
    )
    .optional(),
  include_inactive: z.boolean().default(false),
  user_ids: z.array(z.string().uuid()).optional() // For exporting selected users
})

export type UserExportConfigInput = z.infer<typeof userExportConfigSchema>

// ============================================================================
// User Invite Validation (Future Feature)
// ============================================================================

/**
 * Invite user schema
 */
export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  chapter_id: z.string().uuid('Invalid chapter ID').optional().nullable(),
  role_ids: z
    .array(z.string().uuid('Invalid role ID'))
    .optional(),
  send_email: z.boolean().default(true),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>
