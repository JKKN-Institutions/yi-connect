'use client'

/**
 * Impersonation Logging Hook
 *
 * Provides a convenient way for client components to log actions
 * during impersonation sessions. Auto-captures route context and
 * handles the server action call.
 *
 * @example
 * ```tsx
 * function EventForm() {
 *   const { logAction, isImpersonating } = useImpersonationLogging()
 *
 *   const handleSubmit = async (data: EventFormData) => {
 *     const result = await createEvent(data)
 *
 *     // Log the action (only logs if impersonating)
 *     logAction('create', {
 *       eventName: data.title,
 *       eventDate: data.start_date,
 *     }, 'events', result.id)
 *   }
 *
 *   return (
 *     <>
 *       {isImpersonating && (
 *         <Banner>Actions are being logged for audit purposes</Banner>
 *       )}
 *       <form>...</form>
 *     </>
 *   )
 * }
 * ```
 */

import { useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useIsImpersonating } from '@/contexts/impersonation-context'
import {
  logImpersonationAction,
  type ImpersonationActionType,
} from '@/app/actions/impersonation'

/**
 * Action details that can be logged
 */
export interface ActionDetails {
  [key: string]: unknown
}

/**
 * Options for the logAction function
 */
export interface LogActionOptions {
  /** Skip the current route from being included in details */
  skipRouteContext?: boolean
  /** Additional metadata to include */
  metadata?: Record<string, unknown>
}

/**
 * Return type for the useImpersonationLogging hook
 */
export interface UseImpersonationLoggingReturn {
  /**
   * Log an action during impersonation.
   * Safe to call when not impersonating - will be a no-op.
   */
  logAction: (
    actionType: ImpersonationActionType,
    actionDetails: ActionDetails,
    resourceType: string,
    resourceId?: string,
    options?: LogActionOptions
  ) => Promise<void>

  /**
   * Whether the current session is impersonating another user
   */
  isImpersonating: boolean

  /**
   * Quick helper to log a create action
   */
  logCreate: (
    resourceType: string,
    resourceId: string,
    details?: ActionDetails
  ) => Promise<void>

  /**
   * Quick helper to log an update action
   */
  logUpdate: (
    resourceType: string,
    resourceId: string,
    details?: ActionDetails
  ) => Promise<void>

  /**
   * Quick helper to log a delete action
   */
  logDelete: (
    resourceType: string,
    resourceId: string,
    details?: ActionDetails
  ) => Promise<void>

  /**
   * Quick helper to log a view action (e.g., viewing sensitive data)
   */
  logView: (
    resourceType: string,
    resourceId?: string,
    details?: ActionDetails
  ) => Promise<void>
}

/**
 * Hook for logging actions during impersonation sessions
 *
 * This hook provides convenient methods for client components to log
 * actions taken during impersonation. It automatically captures the
 * current route context and provides typed action helpers.
 *
 * The hook is safe to use regardless of impersonation state - when not
 * impersonating, all log calls are no-ops.
 */
export function useImpersonationLogging(): UseImpersonationLoggingReturn {
  const isImpersonating = useIsImpersonating()
  const pathname = usePathname()

  /**
   * Main logging function
   */
  const logAction = useCallback(
    async (
      actionType: ImpersonationActionType,
      actionDetails: ActionDetails,
      resourceType: string,
      resourceId?: string,
      options?: LogActionOptions
    ): Promise<void> => {
      // Early exit if not impersonating - no need to call server action
      if (!isImpersonating) {
        return
      }

      const details: ActionDetails = {
        ...actionDetails,
        ...(options?.metadata || {}),
      }

      // Add route context unless explicitly skipped
      if (!options?.skipRouteContext && pathname) {
        details.route = pathname
      }

      // Add timestamp
      details.logged_at = new Date().toISOString()

      try {
        await logImpersonationAction({
          action_type: actionType,
          action_details: details,
          affected_resource_type: resourceType,
          affected_resource_id: resourceId,
        })
      } catch (error) {
        // Swallow errors - logging should never break the user flow
        console.error('[ImpersonationLogging] Failed to log action:', error)
      }
    },
    [isImpersonating, pathname]
  )

  /**
   * Quick helper for create actions
   */
  const logCreate = useCallback(
    async (
      resourceType: string,
      resourceId: string,
      details?: ActionDetails
    ): Promise<void> => {
      return logAction('create', details || {}, resourceType, resourceId)
    },
    [logAction]
  )

  /**
   * Quick helper for update actions
   */
  const logUpdate = useCallback(
    async (
      resourceType: string,
      resourceId: string,
      details?: ActionDetails
    ): Promise<void> => {
      return logAction('update', details || {}, resourceType, resourceId)
    },
    [logAction]
  )

  /**
   * Quick helper for delete actions
   */
  const logDelete = useCallback(
    async (
      resourceType: string,
      resourceId: string,
      details?: ActionDetails
    ): Promise<void> => {
      return logAction('delete', details || {}, resourceType, resourceId)
    },
    [logAction]
  )

  /**
   * Quick helper for view actions (viewing sensitive resources)
   */
  const logView = useCallback(
    async (
      resourceType: string,
      resourceId?: string,
      details?: ActionDetails
    ): Promise<void> => {
      return logAction('view', details || {}, resourceType, resourceId)
    },
    [logAction]
  )

  return useMemo(
    () => ({
      logAction,
      isImpersonating,
      logCreate,
      logUpdate,
      logDelete,
      logView,
    }),
    [logAction, isImpersonating, logCreate, logUpdate, logDelete, logView]
  )
}

/**
 * Higher-order function to wrap a server action with impersonation logging
 *
 * Use this to automatically log actions from server action calls.
 *
 * @example
 * ```tsx
 * const createEventWithLogging = withImpersonationLogging(
 *   createEvent,
 *   'create',
 *   'events',
 *   (result) => result.id,
 *   (data, result) => ({ title: data.title, date: data.start_date })
 * )
 *
 * // Then use it like the original action:
 * const result = await createEventWithLogging(formData)
 * ```
 */
export function withImpersonationLogging<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  actionType: ImpersonationActionType,
  resourceType: string,
  getResourceId?: (result: TResult) => string | undefined,
  getDetails?: (args: TArgs, result: TResult) => ActionDetails
) {
  return async (...args: TArgs): Promise<TResult> => {
    const result = await action(...args)

    // Log after successful action
    try {
      await logImpersonationAction({
        action_type: actionType,
        affected_resource_type: resourceType,
        affected_resource_id: getResourceId?.(result),
        action_details: getDetails?.(args, result),
      })
    } catch (error) {
      console.error('[ImpersonationLogging] Failed to log action:', error)
    }

    return result
  }
}

export default useImpersonationLogging
